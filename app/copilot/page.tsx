"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Markdown } from "@/components/ui/markdown"
import {
  Send,
  Sparkles,
  User,
  Search,
  Plus,
  ShieldAlert,
  Clock,
} from "lucide-react"
import {
  mockIncidents,
  mockChatThreads,
  formatTimeAgo,
  type ChatMessage,
  type ChatThread,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import Link from "next/link"

/**
 * Copilot full-page chat.
 *
 * Three architectural points that shaped this layout, all tied to the
 * CLAUDE.md governance model:
 *
 * 1. **Conversations are archived, not ephemeral.** The left rail lists past
 *    threads from `mockChatThreads`. Per CLAUDE.md §4.4, every SRE-agent
 *    exchange is a candidate for the knowledge-base feedback loop; the chat
 *    UI should make that durability visible instead of pretending each
 *    session starts from nothing.
 *
 * 2. **Proposes, never executes.** The suggestion cards and the generated
 *    responses use the vocabulary of drafting/reviewing, not doing. "Run
 *    diagnostic queries" → "Read current connection counts". "Should I
 *    execute…" → "Want me to draft…for your review".
 *
 * 3. **No duplicate source list.** The old right rail repeated the Connected
 *    Sources card that's already in the global SidebarNav — noise, not
 *    context. Replaced with an active-incidents context panel scoped to the
 *    current thread.
 */

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `Welcome to Incident Copilot. I'm a **read-only assistant** — I propose, I never execute.

I can help you with:
- **Investigating incidents** — correlate alerts and analyse logs
- **Root cause analysis** — surface patterns and likely hypotheses
- **Remediation drafting** — propose commands and rollbacks for your review
- **Post-mortem generation** — draft structured reports from the timeline

What would you like to explore?`,
  timestamp: new Date(Date.now() - 5 * 60 * 1000),
}

/** Blank starter thread — lives in component state, not in mock-data. */
function newThread(): ChatThread {
  return {
    id: `thr-${Date.now()}`,
    title: "New conversation",
    lastMessageAt: new Date(),
    preview: "Start by asking a question or picking a suggestion.",
    messages: [WELCOME_MESSAGE],
  }
}

export default function CopilotPage() {
  // The thread list starts from the mock archive plus a live scratch thread.
  // We never mutate the mock array itself — each session has its own copy.
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const seeded = mockChatThreads.map((t) => ({ ...t }))
    // If the first thread has no messages, hydrate it with the welcome so
    // clicking it doesn't look broken.
    return seeded.map((t) =>
      t.messages.length === 0 ? { ...t, messages: [WELCOME_MESSAGE] } : t,
    )
  })
  const [activeThreadId, setActiveThreadId] = useState<string>(threads[0].id)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? threads[0],
    [threads, activeThreadId],
  )

  const linkedIncident = useMemo(() => {
    if (!activeThread.incidentId) return null
    return mockIncidents.find((i) => i.id === activeThread.incidentId) ?? null
  }, [activeThread])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activeThread.messages.length, isTyping])

  function pushMessage(threadId: string, message: ChatMessage) {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [...t.messages, message],
              lastMessageAt: message.timestamp,
              preview:
                message.role === "user"
                  ? message.content.slice(0, 120)
                  : t.preview,
              title:
                t.title === "New conversation" && message.role === "user"
                  ? message.content.slice(0, 60)
                  : t.title,
            }
          : t,
      ),
    )
  }

  const handleSend = async (content: string) => {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }

    pushMessage(activeThread.id, userMessage)
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const aiResponse = generateAIResponse(content)
      pushMessage(activeThread.id, aiResponse)
      setIsTyping(false)
    }, 1200)
  }

  const handleNewThread = () => {
    const fresh = newThread()
    setThreads((prev) => [fresh, ...prev])
    setActiveThreadId(fresh.id)
  }

  // ── date grouping for thread list ──────────────────────────────────────────
  const [threadSearch, setThreadSearch] = useState("")

  const filteredThreads = useMemo(() => {
    if (!threadSearch.trim()) return threads
    const q = threadSearch.toLowerCase()
    return threads.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.incidentId?.toLowerCase().includes(q),
    )
  }, [threads, threadSearch])

  const groupedThreads = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday)
    startOfYesterday.setDate(startOfYesterday.getDate() - 1)
    return {
      today: filteredThreads.filter((t) => t.lastMessageAt >= startOfToday),
      yesterday: filteredThreads.filter(
        (t) => t.lastMessageAt >= startOfYesterday && t.lastMessageAt < startOfToday,
      ),
      older: filteredThreads.filter((t) => t.lastMessageAt < startOfYesterday),
    }
  }, [filteredThreads])

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Incident Copilot"
          subtitle="Read-only assistant · proposes, never executes"
        />

        {/* Three-pane layout — fixed widths so the thread list is never squeezed */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Left rail: thread list ──────────────────────────────────────── */}
          <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-border bg-sidebar overflow-hidden">
            {/* New conversation — top CTA */}
            <div className="p-3 border-b border-border shrink-0">
              <Button
                className="w-full gap-2 justify-start"
                size="sm"
                onClick={handleNewThread}
              >
                <Plus className="w-3.5 h-3.5" />
                New conversation
              </Button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Search…"
                  className="pl-8 h-8 text-xs bg-secondary border-border"
                />
              </div>
            </div>

            {/* Thread list */}
            <ScrollArea className="flex-1">
              <div className="py-2">
                {(["today", "yesterday", "older"] as const).map((group) => {
                  const items = groupedThreads[group]
                  if (items.length === 0) return null
                  const label = group === "today" ? "Today" : group === "yesterday" ? "Yesterday" : "Older"
                  return (
                    <div key={group} className="mb-1">
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {label}
                      </p>
                      {items.map((thread) => {
                        const isActive = thread.id === activeThread.id
                        return (
                          <button
                            key={thread.id}
                            onClick={() => setActiveThreadId(thread.id)}
                            className={cn(
                              "w-full text-left px-3 py-2.5 transition-colors relative",
                              isActive
                                ? "bg-accent/10 text-foreground before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-accent before:rounded-r"
                                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                            )}
                          >
                            <p className={cn(
                              "text-[13px] leading-snug line-clamp-2 break-words",
                              isActive ? "font-medium text-foreground" : "font-normal",
                            )}>
                              {thread.title}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Clock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                              <span className="text-[11px] text-muted-foreground/70">
                                {formatTimeAgo(thread.lastMessageAt)}
                              </span>
                              {thread.incidentId && (
                                <span className="text-[11px] font-mono text-accent/60 truncate">
                                  · {thread.incidentId}
                                </span>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
                {filteredThreads.length === 0 && (
                  <p className="px-3 py-6 text-xs text-muted-foreground text-center">
                    No conversations match your search.
                  </p>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* ── Center: conversation window (no card border) ─────────────────── */}
          <section className="flex-1 flex flex-col overflow-hidden">

            {/* Thread header */}
            <div className="shrink-0 border-b border-border px-6 h-[52px] flex items-center justify-between gap-4 bg-background">
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {activeThread.title}
                </span>
                {linkedIncident && (
                  <Link
                    href={`/incidents/${linkedIncident.id}`}
                    className="ml-3 text-xs text-muted-foreground hover:text-accent transition-colors font-mono"
                  >
                    {linkedIncident.id}
                  </Link>
                )}
              </div>
              <Badge
                variant="outline"
                className="text-[10px] gap-1.5 bg-secondary/60 text-muted-foreground border-border shrink-0"
              >
                <ShieldAlert className="w-3 h-3" />
                Read-only
              </Badge>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1" ref={scrollRef}>
              <div className="py-8 px-6 space-y-6 max-w-3xl mx-auto">
                {activeThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" && "flex-row-reverse",
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        message.role === "assistant" ? "bg-accent/20" : "bg-secondary",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={cn("flex flex-col gap-1 max-w-[75%]", message.role === "user" && "items-end")}>
                      <div
                        className={cn(
                          "px-4 py-3 rounded-2xl text-sm text-left",
                          message.role === "assistant"
                            ? "bg-secondary text-foreground rounded-tl-sm"
                            : "bg-accent text-accent-foreground rounded-tr-sm",
                        )}
                      >
                        {message.role === "assistant" ? (
                          <Markdown content={message.content} />
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground/60 px-1">
                        {formatTimeAgo(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-secondary">
                      <div className="flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.15s" }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.3s" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="shrink-0 border-t border-border px-6 py-4 bg-background">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(input) }}
                className="max-w-3xl mx-auto"
              >
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about incidents, logs, deployments, or system health…"
                    className="flex-1 bg-secondary border-border h-10 rounded-xl"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isTyping}
                    className="h-10 w-10 rounded-xl shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/60 mt-2 text-center">
                  AI-generated — verify before acting. Copilot will not run anything on your behalf.
                </p>
              </form>
            </div>

          </section>

        </div>{/* end three-pane */}
      </div>
    </div>
  )
}

/**
 * Canned responses for the demo. Every string goes through the Markdown
 * renderer now, so `**bold**`, `` `code` ``, and fenced blocks render
 * correctly.
 *
 * IMPORTANT: the vocabulary here has been rewritten to match CLAUDE.md §4.3
 * (proposes, never executes). No message ends in "Should I run…" or
 * "Should I execute…" — they end in "Want me to draft…" or "Want me to open
 * a playbook with these steps for your review?". The distinction looks
 * cosmetic but it directly shapes SRE expectations.
 */
function generateAIResponse(query: string): ChatMessage {
  const lowerQuery = query.toLowerCase()

  let content = ""

  if (
    lowerQuery.includes("summarize") ||
    lowerQuery.includes("summarise") ||
    lowerQuery.includes("current") ||
    lowerQuery.includes("active")
  ) {
    content = `**Active incidents snapshot**

I pulled the current feed from the Incidents service:

**Critical (1)**
- **INC-2024-001** — Database connection pool exhaustion on prod-db-01
  - Duration: 15 minutes
  - Affected services: api-gateway, user-service, mysql-prod, prod-db-01
  - Candidate root cause: recent deploy of the batch-import feature
  - Suggested remediation to review: rollback of commit \`a3f2b1c\`

**High (1)**
- **INC-2024-002** — Memory leak in payment-service
  - Duration: 45 minutes, owned by Alex Rivera
  - Similar pattern to INC-2024-089 (validated)

**Investigating (1)**
- **INC-2024-004** — SSL certificate expiring in 7 days on auth.example.com

Want me to open the investigation view for any of these?`
  } else if (
    lowerQuery.includes("log") ||
    lowerQuery.includes("search") ||
    lowerQuery.includes("elk")
  ) {
    content = `**ELK log search**

Queried the last hour of logs for connection-related errors.

Found **47 matching entries**:

\`\`\`
14:32:15 ERROR [api-gateway]   ConnectionTimeoutException: Unable to acquire connection from pool
14:32:14 ERROR [user-service]  Failed to process batch import: Connection pool exhausted
14:32:12 WARN  [api-gateway]   Connection pool utilization at 95%
14:32:10 INFO  [user-service]  Starting batch import job: 5000 users
14:31:58 ERROR [prod-db-01]    Too many connections (max: 100)
\`\`\`

**Pattern observed**
- The error spike aligns with the batch-import job start
- Pool hit 100% about two minutes after the user-service deploy
- All errors trace back to \`BatchImportService\`

Want me to draft a remediation proposal or widen the search window?`
  } else if (
    lowerQuery.includes("deploy") ||
    lowerQuery.includes("commit") ||
    lowerQuery.includes("git")
  ) {
    content = `**Recent deployments (last 24h)**

Pulled from GitLab and cross-referenced with the active incident timeline.

1. **user-service @ \`a3f2b1c\`** — 2h ago · HIGH correlation
   - Author: Mike Johnson
   - Added batch user-import functionality, 12 files
   - Risk hypothesis: no connection pooling in the new path

2. **api-gateway @ \`b7d4e2f\`** — 6h ago · LOW correlation
   - Author: Sarah Chen
   - Rate-limit config tweak

3. **payment-service @ \`c9a3f1d\`** — 12h ago · MEDIUM correlation
   - Author: Alex Rivera
   - Transaction-processor optimisation

**Hypothesis**
The user-service deploy is the most likely contributor to INC-2024-001.

Want me to draft the rollback command for \`a3f2b1c\` so you can review it before running it yourself?`
  } else if (
    lowerQuery.includes("post-mortem") ||
    lowerQuery.includes("postmortem") ||
    lowerQuery.includes("report")
  ) {
    content = `**Post-mortem draft · INC-2024-001**

I generated a first-pass draft. It's flagged as **AI draft** until you review it.

## Incident: Database connection pool exhaustion

**Severity:** Critical
**Duration:** ~15 minutes (ongoing)
**Estimated affected users:** ~12,000

### Impact
- API p95 latency: 2.5s (baseline 200ms)
- Four services cascading into degraded mode
- User-facing features intermittently unavailable

### Timeline
- 14:15 — user-service batch-import deploy
- 14:17 — first Dynatrace alert
- 14:18 — Centreon health-check failures
- 14:20 — on-call paged

### Root-cause hypothesis
The new batch-import path opens DB connections without pooling, saturating the pool for the whole cluster.

### Proposed action items
1. Review and roll back \`a3f2b1c\`
2. Add connection pooling to \`BatchImportService\`
3. Wire pool-utilisation alert in Dynatrace
4. Update the deployment checklist

Want me to open this in the full report editor so you can validate it?`
  } else if (
    lowerQuery.includes("health") ||
    lowerQuery.includes("database") ||
    lowerQuery.includes("diagnostic")
  ) {
    content = `**Database health snapshot**

Read the current pool stats across the fleet.

**prod-db-01 (MySQL primary)** — CRITICAL
- Active connections: 98/100 (98%)
- Query queue: 47 waiting
- Replication lag: 0ms
- Disk usage: 67%

**prod-db-02 (MySQL replica)** — HEALTHY
- Active connections: 23/100 (23%)
- Replication lag: 0ms
- Disk usage: 65%

**redis-cache-01** — HEALTHY
- Memory: 4.2GB / 8GB (52%)
- Hit rate: 94.7%
- Connected clients: 156

**Candidate remediations to review**
1. Drain idle connections on prod-db-01
2. Fail read traffic over to prod-db-02 temporarily
3. Audit long-running sessions on the primary

Want me to open a playbook with these steps so you can review and run them yourself?`
  } else if (
    lowerQuery.includes("performance") ||
    lowerQuery.includes("metric") ||
    lowerQuery.includes("analyze") ||
    lowerQuery.includes("analyse")
  ) {
    content = `**api-gateway · last 6 hours**

**Latency**
- p50: 145ms (baseline 120ms, +21%)
- p95: 890ms (baseline 450ms, +98%)
- p99: 2,847ms (baseline 800ms, +256%)

**Error rates**
- 5xx: 12.3% (baseline 0.1%)
- 4xx: 2.1% (baseline 1.8%)
- Timeouts: 8.7% (baseline 0.05%)

**Traffic**
- Requests/sec: 2,450 (within normal)
- Peak: 3,200 at 14:18 — aligns with the incident onset

**Resources**
- CPU: 78% (elevated)
- Memory: 4.1GB / 8GB (normal)
- Network I/O: normal

**Correlation**
Degradation starts at 14:17, two minutes after the user-service deploy. The p99 spike lines up with the 3s DB-connection timeout.

Want me to draft a detailed performance report or compare this window against last week's baseline?`
  } else {
    content = `I heard: "${query}".

Based on what I can read right now:

**System posture**
- 2 active incidents needing attention
- 1 critical (database connection pool)
- All integrations reporting healthy

**Ways I can help (read/draft only)**
- Search logs for specific error patterns
- Correlate recent deployments
- Draft diagnostic reports
- Draft post-mortems
- Propose remediation steps for your review

How would you like me to approach this?`
  }

  return {
    id: `m-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: new Date(),
  }
}
