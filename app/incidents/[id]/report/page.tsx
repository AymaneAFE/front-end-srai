"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { CopilotSlideOver } from "@/components/dashboard/copilot-slideover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  ArrowLeft,
  MessageSquare,
  Microscope,
  FileText,
  Download,
  Edit3,
  Save,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Lightbulb,
  Eye,
  ShieldCheck,
  UndoDot,
  History,
} from "lucide-react"
import {
  mockIncidents,
  formatTimeAgo,
  getValidationLabel,
  getValidationDotClass,
  type Severity,
  type ValidationStatus,
  type ValidationEvent,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

function getSeverityBadgeClass(severity: Severity): string {
  const classes: Record<Severity, string> = {
    ok: "bg-severity-ok/15 text-severity-ok border border-severity-ok/30",
    warning: "bg-severity-warning/15 text-severity-warning border border-severity-warning/30",
    critical: "bg-severity-critical/15 text-severity-critical border border-severity-critical/30",
    unknown: "bg-severity-unknown/15 text-severity-unknown border border-severity-unknown/30",
  }
  return classes[severity]
}

// Mock report data
const reportData = {
  generatedAt: new Date(Date.now() - 5 * 60 * 1000),
  summary: `Database connection pool exhaustion on prod-db-01 caused cascading failures across the API layer, affecting approximately 2,400 users over a 15-minute period. The root cause was traced to a recently deployed batch user import feature that created unbounded database connections.`,
  impact: {
    duration: "15 minutes",
    usersAffected: 2400,
    servicesAffected: 4,
    revenueImpact: "$0 (no transactions failed)",
  },
  timeline: [
    {
      time: "14:15:00",
      event: "Deployment of user-service with batch import feature",
      type: "deployment" as const,
    },
    {
      time: "14:17:23",
      event: "First ConnectionTimeout error logged in api-gateway",
      type: "error" as const,
    },
    {
      time: "14:17:45",
      event: "Dynatrace alert: high connection count on prod-db-01",
      type: "alert" as const,
    },
    {
      time: "14:18:12",
      event: "Centreon alert: MySQL health check failing",
      type: "alert" as const,
    },
    {
      time: "14:20:00",
      event: "On-call engineer Sarah Chen acknowledged incident",
      type: "action" as const,
    },
    {
      time: "14:25:00",
      event: "AI Copilot proposed root cause and suggested rollback",
      type: "action" as const,
    },
    {
      time: "14:28:00",
      event: "Rollback manually initiated for commit a3f2b1c",
      type: "action" as const,
    },
    {
      time: "14:32:00",
      event: "Services recovered, connection pool normalised",
      type: "resolved" as const,
    },
  ],
  rootCause: `The batch user import feature introduced in commit a3f2b1c contained an N+1 query pattern that created a new database connection for each user in the batch. When a large import was triggered, this exhausted the connection pool (50 connections) and caused all subsequent database operations to fail.`,
  contributingFactors: [
    "No connection pool limit checks in code review",
    "Missing load testing for batch operations",
    "No circuit breaker pattern implemented",
    "Insufficient monitoring on connection pool utilisation",
  ],
  actionItems: [
    {
      id: 1,
      title: "Add connection pool limits to batch operations",
      owner: "Mike Johnson",
      dueDate: "2024-01-20",
      status: "in-progress" as const,
    },
    {
      id: 2,
      title: "Implement circuit breaker for database connections",
      owner: "Sarah Chen",
      dueDate: "2024-01-25",
      status: "pending" as const,
    },
    {
      id: 3,
      title: "Add load testing for batch operations to CI/CD",
      owner: "DevOps Team",
      dueDate: "2024-01-30",
      status: "pending" as const,
    },
    {
      id: 4,
      title: "Create runbook for connection pool exhaustion",
      owner: "SRE Team",
      dueDate: "2024-01-22",
      status: "completed" as const,
    },
  ],
  lessonsLearned: [
    "Batch operations require explicit connection management review",
    "AI-assisted root-cause analysis significantly reduced MTTR",
    "Historical pattern matching helped identify the mechanism faster",
  ],
}

// Seed changelog — in production this lives alongside the report record in
// Postgres. Displayed as an audit trail so a human always knows how a draft
// became a "validated" artefact.
const initialChangelog: ValidationEvent[] = [
  {
    at: new Date(Date.now() - 5 * 60 * 1000),
    actor: "Incident Copilot",
    from: "draft",
    to: "draft",
    note: "Auto-generated from INC-2024-003 investigation.",
  },
]

/**
 * Validation workflow.
 *
 * Per CLAUDE.md §4.4 the vector store weights retrievals by confidence tag.
 * If nothing in the UI lets a human advance the tag from `draft` →
 * `reviewed` → `validated`, the whole feedback loop is dead on arrival.
 *
 * This page now exposes:
 * - A status pill at the top so the reader knows whether they're looking
 *   at raw AI output or something another human has signed off on.
 * - Buttons to advance / correct / revert the status, each one recording a
 *   ValidationEvent.
 * - A changelog card that shows every transition, with timestamps and
 *   actors. This is what makes the system auditable and makes humans
 *   accountable for what they've validated.
 */
function nextActionFor(status: ValidationStatus): {
  label: string
  next: ValidationStatus
  icon: typeof Eye
} | null {
  switch (status) {
    case "draft":
      return { label: "Mark as reviewed", next: "reviewed", icon: Eye }
    case "reviewed":
      return { label: "Validate report", next: "validated", icon: ShieldCheck }
    case "validated":
      return null
    case "corrected":
      return { label: "Mark as reviewed", next: "reviewed", icon: Eye }
  }
}

export default function ReportPage() {
  const params = useParams()
  const incidentId = params.id as string
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState(reportData.summary)

  const [status, setStatus] = useState<ValidationStatus>("draft")
  const [changelog, setChangelog] = useState<ValidationEvent[]>(initialChangelog)

  const incident = mockIncidents.find((inc) => inc.id === incidentId) || mockIncidents[0]
  const nextAction = useMemo(() => nextActionFor(status), [status])

  const recordTransition = (to: ValidationStatus, note?: string) => {
    setChangelog((prev) => [
      ...prev,
      {
        at: new Date(),
        actor: "Aymane Fajr", // mock — in prod this is the signed-in user
        from: status,
        to,
        note,
      },
    ])
    setStatus(to)
  }

  const handleSaveEdits = () => {
    // Editing implies a correction; the summary was changed manually, so we
    // push the status to "corrected" and log it. Editing without recording a
    // status change would leak an un-auditable modification into the corpus.
    if (isEditing && editedSummary !== reportData.summary) {
      recordTransition("corrected", "Executive summary edited by reviewer.")
    }
    setIsEditing(false)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Incident report"
          subtitle={`Post-mortem for ${incident.id}`}
        />

        <main className="flex-1 p-6 overflow-auto">
          {/* Breadcrumb and Actions */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Link href="/incidents">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to incidents
                </Button>
              </Link>
              <div className="h-4 w-px bg-border" />
              <h2 className="text-lg font-semibold">{incident.title}</h2>
              <Badge
                variant="outline"
                className="text-xs gap-1.5 bg-secondary"
                title={`Validation status: ${getValidationLabel(status)}`}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", getValidationDotClass(status))} />
                {getValidationLabel(status)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/incidents/${incident.id}/investigation`}>
                <Button variant="outline" size="sm">
                  <Microscope className="w-4 h-4 mr-2" />
                  View investigation
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button onClick={() => setCopilotOpen(true)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask Copilot
              </Button>
            </div>
          </div>

          {/* Report Header Card */}
          <Card className="bg-card border-border mb-6">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <h1 className="text-xl font-semibold mb-1">
                      {incident.title}
                    </h1>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span>{incident.id}</span>
                      <span aria-hidden>·</span>
                      <Badge className={cn("text-xs", getSeverityBadgeClass(incident.severity))}>
                        {incident.severity}
                      </Badge>
                      <span aria-hidden>·</span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        AI-generated {formatTimeAgo(reportData.generatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="gap-1.5 bg-secondary text-foreground border-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-validated" />
                  {incident.status === "validated" ? "Validated" : incident.status === "aborted" ? "Aborted" : incident.status}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Validation workflow card — the single most important feature on
              this page. Without it the vector store is learning from
              untagged AI output, which CLAUDE.md §6 flags as an anti-pattern. */}
          <Card className="bg-card border-border mb-6">
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <span className={cn("w-2.5 h-2.5 rounded-full mt-1.5", getValidationDotClass(status))} />
                <div>
                  <p className="text-sm font-medium">
                    {getValidationLabel(status)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {status === "draft" && "Nothing below has been verified by a human yet. Expect some AI errors."}
                    {status === "reviewed" && "A human has read it end-to-end. Still not formally signed off."}
                    {status === "validated" && "Signed off — this report is now retrieved at full weight by future RAG lookups."}
                    {status === "corrected" && "A human edited the original AI output. Correction is captured in the changelog."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {nextAction && (
                  <Button
                    size="sm"
                    onClick={() => recordTransition(nextAction.next)}
                  >
                    <nextAction.icon className="w-4 h-4 mr-2" />
                    {nextAction.label}
                  </Button>
                )}
                {status !== "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => recordTransition("draft", "Reset to draft for re-review.")}
                  >
                    <UndoDot className="w-4 h-4 mr-2" />
                    Reset to draft
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Summary */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    Executive summary
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isEditing) {
                        handleSaveEdits()
                      } else {
                        setIsEditing(true)
                      }
                    }}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save
                      </>
                    ) : (
                      <>
                        <Edit3 className="w-4 h-4 mr-1" />
                        Edit
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <Textarea
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                      className="min-h-[120px] bg-secondary border-border"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {editedSummary}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Incident timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData.timeline.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 py-2"
                      >
                        <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">
                          {item.time}
                        </span>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                            item.type === "deployment" && "bg-chart-1",
                            item.type === "error" && "bg-severity-critical",
                            item.type === "alert" && "bg-severity-warning",
                            item.type === "action" && "bg-accent",
                            item.type === "resolved" && "bg-status-validated"
                          )}
                        />
                        <p className="text-sm text-foreground">{item.event}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Root Cause */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Root-cause analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {reportData.rootCause}
                  </p>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Contributing factors</h4>
                    <ul className="space-y-1">
                      {reportData.contributingFactors.map((factor, index) => (
                        <li
                          key={index}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <XCircle className="w-4 h-4 text-severity-warning flex-shrink-0" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Action Items */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Action items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData.actionItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center",
                              item.status === "completed" && "bg-status-validated",
                              item.status === "in-progress" && "bg-accent",
                              item.status === "pending" && "bg-muted"
                            )}
                          >
                            {item.status === "completed" && (
                              <CheckCircle2 className="w-4 h-4 text-black" />
                            )}
                            {item.status === "in-progress" && (
                              <Clock className="w-4 h-4 text-accent-foreground" />
                            )}
                            {item.status === "pending" && (
                              <Clock className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.owner} · due {item.dueDate}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs capitalize",
                            item.status === "completed" && "text-status-validated border-status-validated/30",
                            item.status === "in-progress" && "text-accent border-accent/30",
                            item.status === "pending" && "text-muted-foreground border-muted"
                          )}
                        >
                          {item.status.replace("-", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Impact Summary */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Impact summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Duration</span>
                    </div>
                    <span className="text-sm font-medium">
                      {reportData.impact.duration}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">Users affected</span>
                    </div>
                    <span className="text-sm font-medium">
                      ~{reportData.impact.usersAffected.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm">Services affected</span>
                    </div>
                    <span className="text-sm font-medium">
                      {reportData.impact.servicesAffected}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Revenue impact</span>
                      <span className="text-sm font-medium text-status-validated">
                        {reportData.impact.revenueImpact}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lessons Learned — icon switched from CheckCircle2 (which
                  reads as "done") to Lightbulb, which reads as "insight". */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    Lessons learned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {reportData.lessonsLearned.map((lesson, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Lightbulb className="w-4 h-4 text-proposal mt-0.5 flex-shrink-0" />
                        {lesson}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Validation changelog */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-base font-medium">
                      Validation changelog
                    </CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Every status change, attributed.
                  </p>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {changelog.map((event, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className={cn("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", getValidationDotClass(event.to))} />
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{event.actor}</span>{" "}
                            <span className="text-muted-foreground">
                              {event.from === event.to
                                ? "created as"
                                : `moved from ${event.from} to`}
                            </span>{" "}
                            <span className="font-medium">{getValidationLabel(event.to)}</span>
                          </p>
                          {event.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {event.note}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {event.at.toLocaleString()}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* AI Assistance */}
              <Card className="bg-accent/10 border-accent/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">AI assistance</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Need to expand a section or check a fact?
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setCopilotOpen(true)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Ask Copilot
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Copilot Slide-over */}
      <CopilotSlideOver
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        incident={incident}
      />
    </div>
  )
}
