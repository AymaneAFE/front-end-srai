// Mock data for the Incident Copilot dashboard (V2)
//
// Major changes in this iteration, driven by review feedback:
//
// 1. Severity follows Centreon/Nagios primitives: ok | warning | critical |
//    unknown. We lose the old high/medium/low granularity on purpose — the
//    upstream sources don't produce those, so inventing them in our own
//    layer was pretending to precision we don't have. If priority becomes
//    a separate dimension later, it will be its own field.
//
// 2. IncidentStatus models the *human* review loop. The AI never resolves
//    an incident; the SRE drives transitions. `aborted` exists because
//    alerts routinely disappear from the source systems mid-investigation
//    (auto-healing, false positive, deploy window rolls forward) — we
//    need a terminal state that reflects "symptoms vanished, nothing to
//    validate here".
//
// 3. No assignees. The app is not a ticketing system; it doesn't know who
//    is working on what. Removing the field forces the UI to stop faking
//    ownership it doesn't actually track.
//
// 4. Correlation rationale is now first-class on every Alert. The SRE
//    needs to see *why* an alert was grouped into an incident, not just
//    that it was — otherwise the correlation engine is a black box.
//
// 5. Hypothesis/InvestigationEvent types model the Resolve.ai-style
//    threaded conversation on the incident: every AI hypothesis is
//    challenge-able, and each challenge (accept / contest / ask for more
//    evidence) becomes an auditable timeline entry.

export type Severity = "ok" | "warning" | "critical" | "unknown"

/**
 * Incident-level severity excludes "ok" — an OK alert never creates an
 * incident, so the incident type system rejects it at compile time.
 */
export type IncidentSeverity = Exclude<Severity, "ok">

/**
 * Incident state machine:
 *
 *   detected ─▶ investigating ─▶ waiting_for_review ─┬─▶ validated
 *                                    ▲               │
 *                                    └── reinvestigating ◀─┘
 *
 *   (any non-terminal state) ─▶ aborted   (source alerts disappeared)
 *
 *  - `detected`           — created by the correlation engine; no human
 *                           involvement yet.
 *  - `investigating`      — SRE engaged / initial agent run happening.
 *  - `waiting_for_review` — agent produced a hypothesis; awaiting SRE
 *                           verdict (accept / contest / ask for evidence).
 *  - `reinvestigating`    — SRE contested or requested more evidence; a
 *                           new agent iteration is running with the human
 *                           feedback in its context.
 *  - `validated`          — SRE accepted the hypothesis. Terminal.
 *  - `aborted`            — source alerts went quiet before validation.
 *                           Terminal. Often happens with transient issues.
 */
export type IncidentStatus =
  | "detected"
  | "investigating"
  | "waiting_for_review"
  | "reinvestigating"
  | "validated"
  | "aborted"

export type AlertSource = "dynatrace" | "centreon"

/**
 * Validation status for AI-generated artefacts (investigation hypotheses,
 * post-mortems). Maps 1:1 to the vector-store confidence tags described in
 * CLAUDE.md §4.4 — the system only retrieves content weighted by this tag,
 * so the UI MUST expose it and let a human move an artefact along this
 * pipeline.
 */
export type ValidationStatus = "draft" | "reviewed" | "validated" | "corrected"

export interface ValidationEvent {
  at: Date
  actor: string
  from: ValidationStatus
  to: ValidationStatus
  note?: string
}

// ---------------------------------------------------------------------------
// Alerts + correlation metadata
// ---------------------------------------------------------------------------

export interface AlertCorrelation {
  /** 0–100 — how confident the deterministic engine was that this alert
   *  belongs to the incident cluster. Below ~70 is where the LLM qualifier
   *  gets invoked per CLAUDE.md §4.2. */
  score: number
  /** Human-readable explanation: which rule / topology edge / time window
   *  caused the inclusion. Shown inline in the UI so correlation is not a
   *  black box. */
  rationale: string
  /** When true, the deterministic engine wasn't confident and the LLM
   *  qualifier was asked to weigh in. Surface it — it changes how much
   *  the SRE should trust the grouping. */
  viaLlmQualifier?: boolean
}

export interface Alert {
  id: string
  title: string
  description: string
  source: AlertSource
  severity: Severity
  timestamp: Date
  affectedService: string
  /** Undefined for standalone alerts not tied to any incident. */
  correlation?: AlertCorrelation
  /** True when the upstream source no longer reports this alert.
   *  Drives `aborted` state transitions. */
  clearedAtSource?: boolean
  rawData?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Hypotheses — Resolve.ai-style threaded investigation
// ---------------------------------------------------------------------------

/**
 * A single piece of evidence backing an AI claim. Rendered inline in the
 * hypothesis so the SRE can click through to the source. Never just a
 * plain string — the citation is the trust primitive.
 */
export interface EvidenceCitation {
  kind: "alert" | "commit" | "log" | "metric" | "runbook"
  label: string
  /** External link (e.g. Dynatrace/GitLab/ELK URL) or internal anchor. */
  href: string
  /** Which tool the evidence came from, used for the source badge. */
  source: string
}

export type HypothesisDecision =
  | "pending"
  | "accepted"
  | "contested"
  | "more_evidence_requested"

export interface Hypothesis {
  id: string
  /** Iteration number inside this incident's investigation — 1 = first
   *  agent run, 2 = first reinvestigation, etc. */
  iteration: number
  /** Markdown — the hypothesis body. Rendered via <Markdown />. */
  content: string
  /** Root-cause likelihood, 0–100. Distinct from correlation score. */
  confidence: number
  evidence: EvidenceCitation[]
  createdAt: Date
  decision: HypothesisDecision
  /** The SRE's comment when `decision === "contested"` or
   *  `more_evidence_requested`. Feeds the next agent iteration. */
  humanFeedback?: string
  /** Links this hypothesis to the ValidationStatus pipeline — mirrors the
   *  post-mortem workflow so the vector store gets consistent tagging. */
  validation: ValidationStatus
}

/**
 * A timeline entry visible on the investigation page. Interleaves agent
 * hypotheses, human feedback events, and status transitions.
 */
export type InvestigationEvent =
  | { kind: "hypothesis"; at: Date; hypothesis: Hypothesis }
  | {
      kind: "human_feedback"
      at: Date
      actor: string
      /** Which hypothesis the feedback is about. */
      hypothesisId: string
      decision: Exclude<HypothesisDecision, "pending">
      comment?: string
    }
  | {
      kind: "status_change"
      at: Date
      actor: string
      from: IncidentStatus
      to: IncidentStatus
      /** Auto-reason for `aborted` transitions (alerts vanished at source). */
      auto?: boolean
    }

// ---------------------------------------------------------------------------
// Incident
// ---------------------------------------------------------------------------

export interface Incident {
  id: string
  title: string
  status: IncidentStatus
  severity: IncidentSeverity
  createdAt: Date
  updatedAt: Date
  alerts: Alert[]
  affectedServices: string[]
  /** Short AI-generated synopsis for cards. Always treated as `draft`
   *  until the SRE validates the corresponding hypothesis. */
  aiSummary?: string
  /** Threaded hypothesis conversation. First element = oldest. */
  investigation: InvestigationEvent[]
  /** Root cause validated by the human — set once status === "validated". */
  rootCause?: string
  resolution?: string
  relatedCommits?: GitCommit[]
  relatedTickets?: SalesforceTicket[]
  /** True when ALL source alerts for this incident have cleared. Drives
   *  the "→ aborted" automatic transition prompt. */
  allAlertsCleared?: boolean
}

export interface GitCommit {
  sha: string
  message: string
  author: string
  timestamp: Date
  branch: string
  filesChanged: number
}

export interface SalesforceTicket {
  id: string
  subject: string
  status: string
  priority: string
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface MetricSnapshot {
  openIncidents: number
  mttrMinutes: number
  /** % of incidents that reached `validated` (not `aborted`). */
  validationRate: number
  alertsToday: number
  criticalCount: number
  warningCount: number
  unknownCount: number
  /** Ratio of raw alerts collapsed into incidents (correlation efficiency).
   *  Value is a percentage. This is the one metric that justifies the
   *  existence of the product to an SRE — it belongs above MTTR. */
  noiseReductionPct: number
  /** Incidents where the deterministic engine wasn't confident and the
   *  LLM qualifier was invoked (CLAUDE.md §4.2). */
  aiAssistedCount: number
}

// ---------------------------------------------------------------------------
// Mock incidents
// ---------------------------------------------------------------------------

const now = Date.now()
const mins = (n: number) => new Date(now - n * 60 * 1000)
const hours = (n: number) => new Date(now - n * 60 * 60 * 1000)
const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000)

export const mockIncidents: Incident[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // INC-2024-001 — critical, in the Resolve-ai "waiting for review" state.
  // Two hypothesis iterations exist: the first was contested, the second is
  // awaiting the SRE's verdict. Demonstrates the full threaded loop.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "INC-2024-001",
    title: "Database connection pool exhaustion on prod-db-01",
    status: "waiting_for_review",
    severity: "critical",
    createdAt: mins(15),
    updatedAt: mins(2),
    alerts: [
      {
        id: "ALT-001",
        title: "High connection count on prod-db-01",
        description: "Connection count exceeded 90% threshold (98/100)",
        source: "dynatrace",
        severity: "critical",
        timestamp: mins(15),
        affectedService: "prod-db-01",
        correlation: {
          score: 98,
          rationale:
            "Seed alert for this cluster — all subsequent alerts grouped against its timestamp and service topology.",
        },
      },
      {
        id: "ALT-002",
        title: "API p99 latency degradation",
        description: "p99 latency increased from 200ms to 2.5s",
        source: "dynatrace",
        severity: "warning",
        timestamp: mins(14),
        affectedService: "api-gateway",
        correlation: {
          score: 91,
          rationale:
            "api-gateway has a known topology edge to prod-db-01 (1-hop). Latency spike window (14:32→14:34) overlaps seed alert by 62s.",
        },
      },
      {
        id: "ALT-003",
        title: "MySQL service health check failing",
        description: "Health check timing out on mysql-prod",
        source: "centreon",
        severity: "critical",
        timestamp: mins(13),
        affectedService: "mysql-prod",
        correlation: {
          score: 88,
          rationale:
            "Same service group as prod-db-01 (mysql-cluster). Within 180s correlation window.",
        },
      },
      {
        id: "ALT-007",
        title: "user-service 5xx error rate up",
        description: "HTTP 500 rate climbed from 0.1% to 12%",
        source: "dynatrace",
        severity: "warning",
        timestamp: mins(12),
        affectedService: "user-service",
        correlation: {
          score: 64,
          rationale:
            "No direct topology edge to prod-db-01, but deploy-time proximity (2h) and shared connection-pool library suggested by LLM qualifier.",
          viaLlmQualifier: true,
        },
      },
    ],
    affectedServices: ["prod-db-01", "api-gateway", "mysql-prod", "user-service"],
    aiSummary:
      "Database connection pool exhaustion propagating to api-gateway and user-service. Two competing hypotheses — first contested, second pending review.",
    investigation: [
      {
        kind: "status_change",
        at: mins(15),
        actor: "correlation-engine",
        from: "detected",
        to: "detected",
        auto: true,
      },
      {
        kind: "status_change",
        at: mins(14),
        actor: "correlation-engine",
        from: "detected",
        to: "investigating",
        auto: true,
      },
      {
        kind: "hypothesis",
        at: mins(13),
        hypothesis: {
          id: "HYP-001-1",
          iteration: 1,
          content:
            "**Root cause hypothesis (iteration 1):** the connection pool is saturated because `api-gateway` is opening connections but never releasing them under the new batch-import path shipped in `a3f2b1c`.\n\nThe new code path in `BatchImportService.importUsers()` does not use the pooled client — each row opens a fresh connection.",
          confidence: 71,
          evidence: [
            {
              kind: "commit",
              label: "a3f2b1c — feat: add batch user import functionality",
              href: "https://gitlab.example.com/platform/user-service/-/commit/a3f2b1c",
              source: "GitLab",
            },
            {
              kind: "alert",
              label: "ALT-001 — High connection count on prod-db-01",
              href: "#alert-ALT-001",
              source: "Dynatrace",
            },
            {
              kind: "log",
              label:
                'ELK: "Too many connections" — 47 occurrences in last 10 min',
              href: "https://elk.example.com/app/discover#/search?q=prod-db-01+connections",
              source: "ELK",
            },
          ],
          createdAt: mins(13),
          decision: "contested",
          humanFeedback:
            "This deploy was reverted 10 min ago and the pool is still saturated. Look at the payment-service side instead — they deployed something around the same time.",
          validation: "corrected",
        },
      },
      {
        kind: "human_feedback",
        at: mins(8),
        actor: "fajr.aymane@gmail.com",
        hypothesisId: "HYP-001-1",
        decision: "contested",
        comment:
          "This deploy was reverted 10 min ago and the pool is still saturated. Look at the payment-service side instead.",
      },
      {
        kind: "status_change",
        at: mins(8),
        actor: "fajr.aymane@gmail.com",
        from: "waiting_for_review",
        to: "reinvestigating",
      },
      {
        kind: "hypothesis",
        at: mins(4),
        hypothesis: {
          id: "HYP-001-2",
          iteration: 2,
          content:
            "**Root cause hypothesis (iteration 2):** you're right — the user-service rollback completed at 14:28, but the pool saturation continues past that. Re-running with payment-service in scope.\n\nThe `payment-service` deploy at 14:22 (`b7d4e2f`) added a new retry-on-failure loop in the transaction processor. Each retry opens a fresh short-lived connection against `prod-db-01`. With the current error rate on downstream calls, this produces a connection burst of ~15 conn/s.\n\nELK confirms: 312 new `payment-service` DB connections opened in the last 10 minutes, all short-lived, never pooled.",
          confidence: 89,
          evidence: [
            {
              kind: "commit",
              label:
                "b7d4e2f — feat(payments): retry on transient DB failure",
              href: "https://gitlab.example.com/platform/payment-service/-/commit/b7d4e2f",
              source: "GitLab",
            },
            {
              kind: "log",
              label:
                "ELK: payment-service DB connections — 312 new in 10 min",
              href: "https://elk.example.com/app/discover#/search?q=payment-service+connection",
              source: "ELK",
            },
            {
              kind: "metric",
              label:
                "Dynatrace: prod-db-01 connections by caller — payment-service contributes 83%",
              href: "https://dynatrace.example.com/#dashboard;id=prod-db-01-connections",
              source: "Dynatrace",
            },
            {
              kind: "runbook",
              label: "Runbook: DB connection pool saturation — triage steps",
              href: "/knowledge/runbooks/db-pool-saturation",
              source: "Knowledge base",
            },
          ],
          createdAt: mins(4),
          decision: "pending",
          validation: "draft",
        },
      },
      {
        kind: "status_change",
        at: mins(4),
        actor: "copilot-agent",
        from: "reinvestigating",
        to: "waiting_for_review",
        auto: true,
      },
    ],
    relatedCommits: [
      {
        sha: "a3f2b1c",
        message: "feat: add batch user import functionality",
        author: "user-service team",
        timestamp: hours(2),
        branch: "main",
        filesChanged: 12,
      },
      {
        sha: "b7d4e2f",
        message: "feat(payments): retry on transient DB failure",
        author: "payment-service team",
        timestamp: hours(1),
        branch: "main",
        filesChanged: 4,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INC-2024-002 — warning, still in first investigation round.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "INC-2024-002",
    title: "Memory growth detected in payment-service",
    status: "investigating",
    severity: "warning",
    createdAt: mins(45),
    updatedAt: mins(10),
    alerts: [
      {
        id: "ALT-004",
        title: "Memory usage above threshold",
        description: "payment-service memory at 87% (sustained 30 min)",
        source: "dynatrace",
        severity: "warning",
        timestamp: mins(45),
        affectedService: "payment-service",
        correlation: {
          score: 100,
          rationale: "Seed alert — only alert in this cluster.",
        },
      },
    ],
    affectedServices: ["payment-service"],
    aiSummary:
      "Gradual memory increase over the past 2h. Pattern matches INC-2024-089 (validated) — suggest heap dump.",
    investigation: [
      {
        kind: "status_change",
        at: mins(45),
        actor: "correlation-engine",
        from: "detected",
        to: "detected",
        auto: true,
      },
      {
        kind: "status_change",
        at: mins(30),
        actor: "correlation-engine",
        from: "detected",
        to: "investigating",
        auto: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INC-2024-003 — validated (terminal good state), 3h old.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "INC-2024-003",
    title: "CDN cache invalidation delays on static-assets",
    status: "validated",
    severity: "warning",
    createdAt: hours(3),
    updatedAt: hours(1),
    alerts: [
      {
        id: "ALT-005",
        title: "Cache hit ratio dropped to 45%",
        description: "CDN edge cache hit ratio below baseline (normal: 96%)",
        source: "dynatrace",
        severity: "warning",
        timestamp: hours(3),
        affectedService: "cdn-edge",
        correlation: {
          score: 100,
          rationale: "Seed alert.",
        },
      },
    ],
    affectedServices: ["cdn-edge", "static-assets"],
    rootCause:
      "Stale cache entries left behind after automated deployment to the static-assets bucket. TTL on index.html was too high.",
    resolution:
      "Manually purged stale cache entries and reduced TTL on index.html from 24h to 1h.",
    aiSummary:
      "Cache invalidation triggered by automated deployment. Resolved after manual cache purge.",
    investigation: [
      {
        kind: "status_change",
        at: hours(3),
        actor: "correlation-engine",
        from: "detected",
        to: "investigating",
        auto: true,
      },
      {
        kind: "hypothesis",
        at: hours(2),
        hypothesis: {
          id: "HYP-003-1",
          iteration: 1,
          content:
            "**Root cause hypothesis:** the automated deployment job at 11:42 bumped the static-assets bucket without invalidating the CDN. TTL on `index.html` is 24h, so edges continued serving the stale version until the next purge.",
          confidence: 93,
          evidence: [
            {
              kind: "commit",
              label: "e9f2b1c — ci: deploy static-assets",
              href: "#",
              source: "GitLab",
            },
            {
              kind: "metric",
              label: "Dynatrace: cdn-edge hit ratio — drop at 11:44",
              href: "#",
              source: "Dynatrace",
            },
          ],
          createdAt: hours(2),
          decision: "accepted",
          validation: "validated",
        },
      },
      {
        kind: "human_feedback",
        at: hours(1.5),
        actor: "fajr.aymane@gmail.com",
        hypothesisId: "HYP-003-1",
        decision: "accepted",
      },
      {
        kind: "status_change",
        at: hours(1),
        actor: "fajr.aymane@gmail.com",
        from: "waiting_for_review",
        to: "validated",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INC-2024-004 — unknown severity. Long-tail SSL expiry, no urgency.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "INC-2024-004",
    title: "SSL certificate expiring soon on auth.example.com",
    status: "detected",
    severity: "unknown",
    createdAt: hours(24),
    updatedAt: hours(12),
    alerts: [
      {
        id: "ALT-006",
        title: "SSL certificate expires in 7 days",
        description:
          "Certificate for auth.example.com expires in 7 days; auto-renewal status unknown.",
        source: "centreon",
        severity: "unknown",
        timestamp: hours(24),
        affectedService: "auth-service",
        correlation: {
          score: 100,
          rationale: "Seed alert — standalone.",
        },
      },
    ],
    affectedServices: ["auth-service"],
    aiSummary:
      "Certificate renewal pending. Auto-renewal configured but Let's Encrypt ACME challenge status is unknown — verify reachability.",
    investigation: [
      {
        kind: "status_change",
        at: hours(24),
        actor: "correlation-engine",
        from: "detected",
        to: "detected",
        auto: true,
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INC-2024-005 — aborted. Alerts went quiet before validation could
  // complete. Demonstrates the "symptoms vanished" terminal state.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "INC-2024-005",
    title: "Intermittent timeouts on notifications-service",
    status: "aborted",
    severity: "warning",
    createdAt: hours(5),
    updatedAt: hours(4),
    alerts: [
      {
        id: "ALT-008",
        title: "notifications-service timeout rate",
        description: "Timeout rate climbed to 4% briefly",
        source: "dynatrace",
        severity: "warning",
        timestamp: hours(5),
        affectedService: "notifications-service",
        correlation: { score: 100, rationale: "Seed alert." },
        clearedAtSource: true,
      },
    ],
    affectedServices: ["notifications-service"],
    allAlertsCleared: true,
    aiSummary:
      "Transient timeout burst — symptoms cleared at source before any hypothesis was validated.",
    investigation: [
      {
        kind: "status_change",
        at: hours(5),
        actor: "correlation-engine",
        from: "detected",
        to: "investigating",
        auto: true,
      },
      {
        kind: "hypothesis",
        at: hours(4.5),
        hypothesis: {
          id: "HYP-005-1",
          iteration: 1,
          content:
            "**Hypothesis:** AWS SQS throttling on the notifications queue during peak minute. Confidence low — no clear upstream trigger.",
          confidence: 42,
          evidence: [
            {
              kind: "metric",
              label: "Dynatrace: notifications-service timeout rate",
              href: "#",
              source: "Dynatrace",
            },
          ],
          createdAt: hours(4.5),
          decision: "pending",
          validation: "draft",
        },
      },
      {
        kind: "status_change",
        at: hours(4),
        actor: "source-poller",
        from: "waiting_for_review",
        to: "aborted",
        auto: true,
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Aggregate metrics
// ---------------------------------------------------------------------------

export const mockMetrics: MetricSnapshot = {
  openIncidents: mockIncidents.filter(
    (i) => i.status !== "validated" && i.status !== "aborted",
  ).length,
  mttrMinutes: 47,
  validationRate: 87.4,
  alertsToday: 234,
  criticalCount: mockIncidents.filter((i) => i.severity === "critical").length,
  warningCount: mockIncidents.filter((i) => i.severity === "warning").length,
  unknownCount: mockIncidents.filter((i) => i.severity === "unknown").length,
  noiseReductionPct: 92.7,
  aiAssistedCount: mockIncidents.filter((i) =>
    i.alerts.some((a) => a.correlation?.viaLlmQualifier),
  ).length,
}

// ---------------------------------------------------------------------------
// Trend data — charts on the command-center dashboard
// ---------------------------------------------------------------------------

export const incidentTrendData = [
  { time: "00:00", incidents: 2, resolved: 1 },
  { time: "04:00", incidents: 1, resolved: 2 },
  { time: "08:00", incidents: 4, resolved: 1 },
  { time: "12:00", incidents: 6, resolved: 3 },
  { time: "16:00", incidents: 3, resolved: 4 },
  { time: "20:00", incidents: 2, resolved: 2 },
  { time: "Now", incidents: 2, resolved: 1 },
]

export const alertsBySourceData = [
  { source: "Dynatrace", count: 156, fill: "var(--chart-1)" },
  { source: "Centreon", count: 89, fill: "var(--chart-2)" },
]

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  suggestions?: string[]
}

export const initialChatMessages: ChatMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hello! I'm your Incident Copilot. I can help you investigate incidents, correlate alerts, and propose remediation steps. I propose, I never execute — you stay in control.",
    timestamp: mins(5),
    suggestions: [
      "Summarize the current critical incident",
      "What could cause the database connection issue?",
      "Show similar past incidents",
      "Propose diagnostic steps for affected services",
    ],
  },
]

export interface ChatThread {
  id: string
  title: string
  lastMessageAt: Date
  preview: string
  incidentId?: string
  messages: ChatMessage[]
}

export const mockChatThreads: ChatThread[] = [
  {
    id: "thr-active",
    title: "Prod DB pool exhaustion — triage",
    lastMessageAt: mins(4),
    preview: "Could the payment-service retry loop have saturated the pool?",
    incidentId: "INC-2024-001",
    messages: [],
  },
  {
    id: "thr-memleak",
    title: "payment-service memory growth",
    lastMessageAt: mins(55),
    preview: "Pattern matches INC-2024-089 — suggest heap dump analysis.",
    incidentId: "INC-2024-002",
    messages: [],
  },
  {
    id: "thr-ssl",
    title: "SSL renewal — auth.example.com",
    lastMessageAt: hours(6),
    preview:
      "Verify the ACME challenge endpoint is reachable from Let's Encrypt.",
    incidentId: "INC-2024-004",
    messages: [],
  },
  {
    id: "thr-postmortem",
    title: "CDN cache invalidation — post-mortem",
    lastMessageAt: hours(1),
    preview: "Root cause validated; writing lessons learned.",
    incidentId: "INC-2024-003",
    messages: [],
  },
  {
    id: "thr-runbook",
    title: "Runbook search: Kafka rebalance storm",
    lastMessageAt: days(3),
    preview: "Found 2 matching runbooks in the knowledge base.",
    messages: [],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

/**
 * Severity styling — Nagios-native vocabulary.
 * Static class map (not interpolation) so Tailwind's JIT extracts them.
 */
export function getSeverityLabel(severity: Severity): string {
  const labels: Record<Severity, string> = {
    ok: "OK",
    warning: "Warning",
    critical: "Critical",
    unknown: "Unknown",
  }
  return labels[severity]
}

export function getSeverityBadgeClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    ok: "bg-severity-ok/15 text-severity-ok border border-severity-ok/30",
    warning:
      "bg-severity-warning/15 text-severity-warning border border-severity-warning/30",
    critical:
      "bg-severity-critical/15 text-severity-critical border border-severity-critical/30",
    unknown:
      "bg-severity-unknown/15 text-severity-unknown border border-severity-unknown/30",
  }
  return classes[severity]
}

export function getSeverityDotClass(severity: Severity): string {
  const dots: Record<Severity, string> = {
    ok: "bg-severity-ok",
    warning: "bg-severity-warning",
    critical: "bg-severity-critical",
    unknown: "bg-severity-unknown",
  }
  return dots[severity]
}

/**
 * Status styling — pill is always neutral (grey), only the dot carries
 * colour. This keeps status from fighting severity for attention.
 */
export function getStatusLabel(status: IncidentStatus): string {
  const labels: Record<IncidentStatus, string> = {
    detected: "Detected",
    investigating: "Investigating",
    waiting_for_review: "Waiting for review",
    reinvestigating: "Reinvestigating",
    validated: "Validated",
    aborted: "Aborted",
  }
  return labels[status]
}

export function getStatusDotClass(status: IncidentStatus): string {
  const dots: Record<IncidentStatus, string> = {
    detected: "bg-status-detected",
    investigating: "bg-status-investigating",
    waiting_for_review: "bg-status-review",
    reinvestigating: "bg-status-reinvestigating",
    validated: "bg-status-validated",
    aborted: "bg-status-aborted",
  }
  return dots[status]
}

/**
 * True when an incident is in a terminal state — nothing more to do.
 * Callers use this to disable transition buttons and strip from "open"
 * counts.
 */
export function isTerminal(status: IncidentStatus): boolean {
  return status === "validated" || status === "aborted"
}

export function getSourceIcon(source: AlertSource): string {
  const icons: Record<AlertSource, string> = {
    dynatrace: "D",
    centreon: "C",
  }
  return icons[source]
}

/**
 * Visual tokens for AI-artefact validation status.
 * Separate palette from severity/status — the meaning is different:
 * "draft" is not a warning, "validated" is not the same as incident
 * status `validated` (different axes).
 */
export function getValidationLabel(status: ValidationStatus): string {
  const labels: Record<ValidationStatus, string> = {
    draft: "AI draft",
    reviewed: "Reviewed",
    validated: "Human-validated",
    corrected: "Corrected",
  }
  return labels[status]
}

export function getValidationDotClass(status: ValidationStatus): string {
  const dots: Record<ValidationStatus, string> = {
    draft: "bg-validation-draft",
    reviewed: "bg-validation-reviewed",
    validated: "bg-validation-validated",
    corrected: "bg-validation-corrected",
  }
  return dots[status]
}

/**
 * Pull the latest hypothesis from an incident's investigation timeline,
 * or `null` if none exists yet.
 */
export function getLatestHypothesis(incident: Incident): Hypothesis | null {
  for (let i = incident.investigation.length - 1; i >= 0; i--) {
    const ev = incident.investigation[i]
    if (ev.kind === "hypothesis") return ev.hypothesis
  }
  return null
}

/**
 * Helper to compute "which status transitions are valid right now" — used
 * by the UI to disable buttons rather than rejecting at click time.
 */
export function allowedTransitions(
  status: IncidentStatus,
): IncidentStatus[] {
  switch (status) {
    case "detected":
      return ["investigating", "aborted"]
    case "investigating":
      return ["waiting_for_review", "aborted"]
    case "waiting_for_review":
      return ["reinvestigating", "validated", "aborted"]
    case "reinvestigating":
      return ["waiting_for_review", "aborted"]
    case "validated":
    case "aborted":
      return []
  }
}
