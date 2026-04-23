"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Markdown } from "@/components/ui/markdown"
import {
  X,
  Send,
  Sparkles,
  User,
  Search,
  ClipboardList,
  FileText,
  GitBranch,
  Info,
} from "lucide-react"
import type { Incident, ChatMessage } from "@/lib/mock-data"
import { initialChatMessages, formatTimeAgo } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface CopilotSlideOverProps {
  isOpen: boolean
  onClose: () => void
  incident: Incident | null
}

/**
 * Quick-action chips.
 *
 * Labels are verbs *of reading* or *of proposing* — deliberately never
 * verbs of execution. Per CLAUDE.md §4.3 the V1 system proposes, it never
 * acts. "Run diagnostics" reads like a button that will trigger a remote
 * script; we reword it so the affordance matches reality.
 */
const quickActions = [
  { icon: Search, label: "Investigate logs", action: "investigate" },
  { icon: ClipboardList, label: "Propose diagnostic steps", action: "diagnose" },
  { icon: FileText, label: "Draft post-mortem", action: "report" },
  { icon: GitBranch, label: "Find related commits", action: "commits" },
]

export function CopilotSlideOver({ isOpen, onClose, incident }: CopilotSlideOverProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages)
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [isOpen, onClose])

  const handleSend = async (content: string) => {
    if (!content.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    setTimeout(() => {
      const aiResponse = generateAIResponse(content, incident)
      setMessages((prev) => [...prev, aiResponse])
      setIsTyping(false)
    }, 1500)
  }

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-label="Incident Copilot"
        className="fixed inset-y-0 right-0 w-full max-w-md bg-card border-l border-border z-50 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Incident Copilot
              </h3>
              <p className="text-xs text-muted-foreground">
                Read-only assistant · proposes, never executes
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close Copilot">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-3 border-b border-border">
          <p className="text-xs text-muted-foreground mb-2">Quick prompts</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.action}
                variant="secondary"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleSuggestionClick(action.label)}
              >
                <action.icon className="w-3 h-3 mr-1" />
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Context Banner */}
        {incident && (
          <div className="px-4 py-2 bg-secondary/50 border-b border-border flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Context:{" "}
              <span className="text-foreground font-medium">{incident.id}</span>
              {" · "}
              <span className="text-foreground">{incident.title}</span>
            </p>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" && "flex-row-reverse"
                )}
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                    message.role === "assistant"
                      ? "bg-accent/20"
                      : "bg-secondary"
                  )}
                >
                  {message.role === "assistant" ? (
                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 min-w-0",
                    message.role === "user" && "text-right"
                  )}
                >
                  <div
                    className={cn(
                      "inline-block px-3 py-2 rounded-lg text-left",
                      message.role === "assistant"
                        ? "bg-secondary text-foreground"
                        : "bg-accent text-accent-foreground"
                    )}
                  >
                    {message.role === "assistant" ? (
                      <Markdown content={message.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimeAgo(message.timestamp)}
                  </p>

                  {/* Suggestions */}
                  {message.role === "assistant" && message.suggestions && (
                    <div className="mt-3 space-y-1">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="block w-full text-left px-3 py-2 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
                <div className="px-3 py-2 rounded-lg bg-secondary">
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
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this incident..."
              className="flex-1 bg-secondary border-border"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || isTyping} aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Responses are AI-generated. Verify before acting.
          </p>
        </div>
      </div>
    </>
  )
}

/**
 * Canned assistant replies. Wording has been tightened so that the
 * recommendations read as *proposals* and the follow-up chips never imply
 * that the UI will run anything. "Execute recommended actions" became
 * "Show exact commands"; "Initiate rollback" became "Draft rollback steps".
 */
function generateAIResponse(query: string, incident: Incident | null): ChatMessage {
  const lowerQuery = query.toLowerCase()

  let content = ""
  let suggestions: string[] = []

  if (lowerQuery.includes("investigate") || lowerQuery.includes("logs")) {
    content = `I'll help you investigate the logs for ${incident?.id || "the current incident"}.

Based on my analysis of the ELK logs:

1. **Error spike**: Detected 347 errors in the last 15 minutes from \`api-gateway\`
2. **Pattern**: Most errors are \`ConnectionTimeout\` exceptions pointing to \`prod-db-01\`
3. **Correlation**: Error rate increased 2 minutes after deployment \`a3f2b1c\`

Would you like me to drill deeper into any of these findings?`
    suggestions = [
      "Show me the specific error messages",
      "Compare with yesterday's baseline",
      "Check connection pool metrics",
    ]
  } else if (lowerQuery.includes("diagnos") || lowerQuery.includes("propose")) {
    content = `Here are the diagnostic checks I'd recommend for the affected services:

**Proposed steps:**
- \`prod-db-01\`: inspect connection pool saturation — expected critical
- \`api-gateway\`: sample p99 latency over the last 15 min
- \`user-service\`: capture a heap summary
- \`payment-service\`: re-check dependencies end-to-end

**Draft remediation (for your review):**
1. Raise the connection pool limit on \`prod-db-01\`
2. Consider rolling back the recent \`user-service\` deployment
3. Enable query caching to reduce DB load

These are suggestions — I won't run them.`
    suggestions = [
      "Show the exact commands I'd run",
      "Compare with historical performance",
      "Turn this into a runbook draft",
    ]
  } else if (lowerQuery.includes("report") || lowerQuery.includes("post-mortem") || lowerQuery.includes("expand")) {
    content = `I'll generate a draft post-mortem for ${incident?.id || "this incident"}. It will land in the Reports view tagged as \`AI draft\` until a human reviews it.

**Draft post-mortem — database connection pool exhaustion**

**Impact:**
- Duration: ~15 minutes (ongoing)
- Affected users: estimated 2,400
- Services impacted: 4

**Timeline:**
- 14:15 — Deployment of user-service batch import feature
- 14:17 — First alert triggered (Dynatrace)
- 14:18 — Correlated alerts from Centreon
- 14:20 — Incident escalated to on-call team

**Root cause (preliminary):**
New batch import feature creating excessive DB connections without proper pooling.

Would you like me to expand any section?`
    suggestions = [
      "Expand the executive summary",
      "Add more timeline events",
      "Propose action items",
    ]
  } else if (lowerQuery.includes("commit") || lowerQuery.includes("find")) {
    content = `Found relevant recent deployments:

**Suspect commit** (high confidence):
\`\`\`
a3f2b1c — feat: add batch user import functionality
Author: Mike Johnson
Time: 2 hours ago
Files changed: 12
\`\`\`

**Changes include:**
- New \`BatchImportService\` with uncapped connection usage
- Modified \`UserRepository\` with N+1 query pattern
- No connection pool limit checks

**Suggestion for review:** rolling this commit back and adding connection-pool limits before redeploying.`
    suggestions = [
      "Open commit diff in GitLab",
      "Draft rollback steps",
      "Notify commit author",
    ]
  } else if (lowerQuery.includes("similar") || lowerQuery.includes("past")) {
    content = `Found 3 similar incidents in the past 90 days:

1. **INC-2024-089** (2 weeks ago) — connection pool exhaustion; cause: memory leak in transaction processor; MTTR 34m
2. **INC-2024-067** (1 month ago) — cascading API failures; cause: unoptimised batch query; MTTR 52m
3. **INC-2024-041** (2 months ago) — connection string misconfiguration; MTTR 18m

These suggest a recurring pattern around batch operations and connection management.`
    suggestions = [
      "View INC-2024-089 in detail",
      "Propose a prevention checklist",
      "Draft an automated detection rule",
    ]
  } else {
    content = `I understand you're asking about "${query}".

For ${incident?.title || "the current incident"}, here's what I know:

${incident?.aiSummary || "I can help you investigate this incident by analysing logs in ELK, correlating alerts from Dynatrace and Centreon, or checking recent GitLab deployments."}

What specific aspect would you like me to focus on?`
    suggestions = [
      "Summarise the current situation",
      "Propose next diagnostic step",
      "Show me the affected services",
    ]
  }

  return {
    id: Date.now().toString(),
    role: "assistant",
    content,
    timestamp: new Date(),
    suggestions,
  }
}
