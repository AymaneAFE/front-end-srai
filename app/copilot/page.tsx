"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  FileText,
  GitBranch,
  AlertTriangle,
  Database,
  Activity,
  Plus,
  MessageSquare,
  ShieldAlert,
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

const suggestedPrompts = [
  {
    icon: AlertTriangle,
    title: "Summarize active incidents",
    description: "Read the current feed",
    prompt: "Summarize all current active incidents and their status",
  },
  {
    icon: Search,
    title: "Investigate logs",
    description: "Search ELK for recent errors",
    prompt: "Search logs for connection timeout errors in the last hour",
  },
  {
    icon: GitBranch,
    title: "Correlate recent deployments",
    description: "Match commits to active incidents",
    prompt: "Show me deployments in the last 24 hours that might be related to current issues",
  },
  {
    icon: FileText,
    title: "Draft a post-mortem",
    description: "Propose a report template",
    prompt: "Draft a post-mortem for the database connection incident",
  },
  {
    icon: Database,
    title: "Database health snapshot",
    description: "Read current connection counts",
    prompt: "Show the health status of all database connections",
  },
  {
    icon: Activity,
    title: "Performance review",
    description: "Read the last 6 hours of metrics",
    prompt: "Summarise performance metrics for api-gateway over the last 6 hours",
  },
]

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

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Incident Copilot"
          subtitle="Read-only assistant · proposes, never executes"
        />

        <main className="flex-1 p-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-180px)]">
            {/* Thread history (left rail).
                Standard chat UX pattern — without this, the surface
                looks ephemeral and the SRE never believes their
                annotations feed the knowledge base. */}
            <aside className="lg:col-span-1 hidden lg:flex flex-col">
              <Card className="bg-card border-border flex-1 flex flex-col">
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Conversations
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    onClick={handleNewThread}
                    aria-label="Start new conversation"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-full">
                    <div className="px-2 pb-2 space-y-1">
                      {threads.map((thread) => (
                        <button
                          key={thread.id}
                          onClick={() => setActiveThreadId(thread.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md transition-colors",
                            "hover:bg-secondary/70",
                            thread.id === activeThread.id &&
                              "bg-secondary border-l-2 border-accent",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">
                                {thread.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {thread.preview}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                <span>{formatTimeAgo(thread.lastMessageAt)}</span>
                                {thread.incidentId && (
                                  <span className="font-mono">
                                    {thread.incidentId}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </aside>

            {/* Chat column */}
            <section className="lg:col-span-3 flex flex-col h-full">
              <Card className="bg-card border-border flex-1 flex flex-col">
                <CardContent className="flex-1 flex flex-col p-0">
                  {/* Thread header — makes the current context obvious */}
                  <div className="border-b border-border px-5 py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {activeThread.title}
                      </p>
                      {linkedIncident && (
                        <Link
                          href={`/incidents/${linkedIncident.id}`}
                          className="text-xs text-muted-foreground hover:text-accent transition-colors font-mono"
                        >
                          {linkedIncident.id} · {linkedIncident.title}
                        </Link>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1.5 bg-secondary text-muted-foreground border-border"
                    >
                      <ShieldAlert className="w-3 h-3" />
                      Read-only
                    </Badge>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-6" ref={scrollRef}>
                    <div className="space-y-6 max-w-3xl mx-auto">
                      {activeThread.messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-4",
                            message.role === "user" && "flex-row-reverse",
                          )}
                        >
                          <div
                            className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                              message.role === "assistant"
                                ? "bg-accent/20"
                                : "bg-secondary",
                            )}
                          >
                            {message.role === "assistant" ? (
                              <Sparkles className="w-4 h-4 text-accent" />
                            ) : (
                              <User className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div
                            className={cn(
                              "flex-1 max-w-2xl",
                              message.role === "user" && "text-right",
                            )}
                          >
                            <div
                              className={cn(
                                "inline-block px-4 py-3 rounded-xl text-left",
                                message.role === "assistant"
                                  ? "bg-secondary text-foreground"
                                  : "bg-accent text-accent-foreground",
                              )}
                            >
                              {message.role === "assistant" ? (
                                <Markdown content={message.content} />
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatTimeAgo(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}

                      {isTyping && (
                        <div className="flex gap-4">
                          <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-accent" />
                          </div>
                          <div className="px-4 py-3 rounded-xl bg-secondary">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                              <span
                                className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              />
                              <span
                                className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="p-4 border-t border-border">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSend(input)
                      }}
                      className="max-w-3xl mx-auto"
                    >
                      <div className="flex gap-3">
                        <Input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Ask about incidents, logs, deployments, or system health…"
                          className="flex-1 bg-secondary border-border h-11"
                        />
                        <Button
                          type="submit"
                          size="lg"
                          disabled={!input.trim() || isTyping}
                          className="h-11 px-5"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 text-center">
                        Responses are AI-generated. Verify before acting —
                        Copilot will not run anything on your behalf.
                      </p>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Context rail (right).
                Scoped to the current thread: suggestions + active-incident
                context. The old "Connected Sources" card was removed — it
                duplicated the global SidebarNav. */}
            <aside className="lg:col-span-1 space-y-4 overflow-y-auto">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Suggested Prompts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 px-2 pb-3">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(prompt.prompt)}
                      className="w-full text-left p-2.5 rounded-md hover:bg-secondary transition-colors group"
                    >
                      <div className="flex items-start gap-2.5">
                        <prompt.icon className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground leading-tight">
                            {prompt.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                            {prompt.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Open incidents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {mockIncidents
                    .filter((i) => i.status !== "validated" && i.status !== "aborted")
                    .slice(0, 3)
                    .map((incident) => (
                      <Link
                        key={incident.id}
                        href={`/incidents/${incident.id}`}
                        className="block p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge
                            className={cn(
                              "text-[10px]",
                              incident.severity === "critical"
                                ? "bg-severity-critical/15 text-severity-critical border border-severity-critical/30"
                                : incident.severity === "warning"
                                  ? "bg-severity-warning/15 text-severity-warning border border-severity-warning/30"
                                  : "bg-severity-unknown/15 text-severity-unknown border border-severity-unknown/30",
                            )}
                          >
                            {incident.severity}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {incident.id}
                          </span>
                        </div>
                        <p className="text-xs text-foreground line-clamp-2 leading-snug">
                          {incident.title}
                        </p>
                      </Link>
                    ))}
                </CardContent>
              </Card>
            </aside>
          </div>
        </main>
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
