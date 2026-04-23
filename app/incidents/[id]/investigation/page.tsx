"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { CopilotSlideOver } from "@/components/dashboard/copilot-slideover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Markdown } from "@/components/ui/markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  MessageSquare,
  FileText,
  Bot,
  User,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import {
  mockIncidents,
  formatTimeAgo,
  getSeverityBadgeClass,
  getStatusDotClass,
  getStatusLabel,
  getValidationDotClass,
  getValidationLabel,
  type InvestigationEvent,
  type Hypothesis,
  type HypothesisDecision,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HypothesisCard({
  hypothesis,
  isPending,
}: {
  hypothesis: Hypothesis
  isPending: boolean
}) {
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [decision, setDecision] = useState<HypothesisDecision | null>(null)
  const [comment, setComment] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleDecision = (d: HypothesisDecision) => {
    setDecision(d)
    if (d === "accepted") {
      console.log("transition: waiting_for_review → validated", { hypothesisId: hypothesis.id, tag: "validated" })
      setSubmitted(true)
    }
  }

  const handleSubmitFeedback = () => {
    console.log("transition: waiting_for_review → reinvestigating", {
      hypothesisId: hypothesis.id,
      decision,
      comment,
      tag: "corrected",
    })
    setSubmitted(true)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent shrink-0">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-medium text-foreground">
          AI hypothesis — iteration {hypothesis.iteration}
        </span>
        <Badge variant="outline" className="text-[10px] font-mono border-border bg-secondary">
          confidence {hypothesis.confidence}%
        </Badge>
        <Badge
          variant="outline"
          className={cn("text-[10px] gap-1 border-border bg-secondary")}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full", getValidationDotClass(hypothesis.validation))} />
          {getValidationLabel(hypothesis.validation)}
        </Badge>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatTimeAgo(hypothesis.createdAt)}
        </span>
      </div>

      {/* Hypothesis content */}
      <div className="pl-8">
        <Markdown content={hypothesis.content} />
      </div>

      {/* Evidence */}
      {hypothesis.evidence.length > 0 && (
        <div className="pl-8">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setEvidenceOpen((o) => !o)}
          >
            {evidenceOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {hypothesis.evidence.length} evidence item{hypothesis.evidence.length > 1 ? "s" : ""}
          </button>
          {evidenceOpen && (
            <ul className="mt-2 space-y-1">
              {hypothesis.evidence.map((ev, i) => (
                <li key={i}>
                  <a
                    href={ev.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span>{ev.label}</span>
                    <Badge variant="outline" className="text-[10px] border-border bg-secondary ml-1">
                      {ev.source}
                    </Badge>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action buttons for pending hypothesis */}
      {isPending && !submitted && (
        <div className="pl-8 pt-2 border-t border-border space-y-3">
          <p className="text-xs text-muted-foreground">
            Your verdict drives the next state transition and tags this hypothesis in the vector store.
          </p>

          {decision === null && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => handleDecision("accepted")}
                className="gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Accept — validate hypothesis
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecision("contested")}
                className="gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" />
                Contest
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDecision("more_evidence_requested")}
                className="gap-1.5"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Ask for more evidence
              </Button>
            </div>
          )}

          {(decision === "contested" || decision === "more_evidence_requested") && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                {decision === "contested"
                  ? "What's wrong with this hypothesis? (required)"
                  : "What additional evidence would help? (optional)"}
              </p>
              <Textarea
                placeholder={
                  decision === "contested"
                    ? "e.g. The N+1 pattern exists but the connection pool was fine at deploy time..."
                    : "e.g. Check the HikariCP metrics for the 14:10–14:20 window..."
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="min-h-[80px] text-sm bg-secondary border-border"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSubmitFeedback}
                  disabled={decision === "contested" && comment.trim() === ""}
                >
                  Submit feedback → reinvestigate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDecision(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {submitted && (
        <div className="pl-8 pt-2 border-t border-border">
          <p className="text-xs text-status-validated font-medium">
            Feedback recorded — state transition queued.
          </p>
        </div>
      )}
    </div>
  )
}

function HumanFeedbackBubble({ event }: { event: Extract<InvestigationEvent, { kind: "human_feedback" }> }) {
  const decisionLabel: Record<string, string> = {
    accepted: "Accepted",
    contested: "Contested",
    more_evidence_requested: "Requested more evidence",
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-lg bg-secondary/70 border border-border px-4 py-3 space-y-1">
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">{event.actor}</span>
          <Badge variant="outline" className="text-[10px] border-border bg-secondary capitalize">
            {decisionLabel[event.decision] ?? event.decision}
          </Badge>
          <span className="text-xs text-muted-foreground ml-auto">{formatTimeAgo(event.at)}</span>
        </div>
        {event.comment && (
          <p className="text-sm text-muted-foreground leading-relaxed">{event.comment}</p>
        )}
      </div>
    </div>
  )
}

function StatusChangeLine({ event }: { event: Extract<InvestigationEvent, { kind: "status_change" }> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
      <div className="flex-1 h-px bg-border" />
      <span>
        {event.auto ? "Auto" : event.actor}
        {" · "}
        <span className="inline-flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass(event.from))} />
          {getStatusLabel(event.from)}
        </span>
        {" → "}
        <span className="inline-flex items-center gap-1">
          <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass(event.to))} />
          {getStatusLabel(event.to)}
        </span>
        {" · "}
        {formatTimeAgo(event.at)}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvestigationPage() {
  const params = useParams()
  const incidentId = params.id as string
  const [copilotOpen, setCopilotOpen] = useState(false)

  const incident = mockIncidents.find((inc) => inc.id === incidentId) ?? mockIncidents[0]

  const pendingHypothesisId = (() => {
    for (let i = incident.investigation.length - 1; i >= 0; i--) {
      const ev = incident.investigation[i]
      if (ev.kind === "hypothesis" && ev.hypothesis.decision === "pending") {
        return ev.hypothesis.id
      }
    }
    return null
  })()

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Investigation"
          subtitle={`Threaded analysis for ${incident.id}`}
        />

        <main className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb and Actions */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Link href={`/incidents/${incident.id}`}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Overview
                </Button>
              </Link>
              <div className="h-4 w-px bg-border" />
              <h2 className="text-base font-semibold truncate max-w-xs">{incident.title}</h2>
              <Badge
                variant="outline"
                className="text-xs gap-1.5 bg-secondary"
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass(incident.status))} />
                {getStatusLabel(incident.status)}
              </Badge>
              <Badge
                variant="outline"
                className={cn("text-xs font-medium", getSeverityBadgeClass(incident.severity))}
              >
                {incident.severity}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/incidents/${incident.id}/report`}>
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  View report
                </Button>
              </Link>
              <Button onClick={() => setCopilotOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask Copilot
              </Button>
            </div>
          </div>

          {/* Investigation thread */}
          <div className="max-w-3xl mx-auto">
            <ScrollArea className="max-h-[calc(100vh-220px)]">
              <div className="space-y-4 pb-8">
                {incident.investigation.length === 0 && (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      No investigation events yet for this incident.
                    </CardContent>
                  </Card>
                )}

                {incident.investigation.map((ev, idx) => {
                  if (ev.kind === "status_change") {
                    return <StatusChangeLine key={idx} event={ev} />
                  }
                  if (ev.kind === "human_feedback") {
                    return <HumanFeedbackBubble key={idx} event={ev} />
                  }
                  if (ev.kind === "hypothesis") {
                    const isPending =
                      ev.hypothesis.id === pendingHypothesisId &&
                      incident.status === "waiting_for_review"
                    return (
                      <HypothesisCard
                        key={ev.hypothesis.id}
                        hypothesis={ev.hypothesis}
                        isPending={isPending}
                      />
                    )
                  }
                  return null
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Info strip */}
          <div className="max-w-3xl mx-auto mt-4">
            <Card className="bg-secondary/30 border-border">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5" />
                  How this page works
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each AI hypothesis is challenge-able. Your verdict (accept / contest / ask for more evidence)
                  drives the state machine and is tagged in the vector store so future retrievals are weighted
                  by human confidence. The copilot proposes — you decide.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <CopilotSlideOver
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        incident={incident}
      />
    </div>
  )
}
