"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Microscope,
  FileText,
  AlertTriangle,
  Bot,
  User,
  BanIcon,
  ExternalLink,
  Clock,
  CheckCircle2,
} from "lucide-react"
import {
  mockIncidents,
  formatTimeAgo,
  getSeverityBadgeClass,
  getSeverityLabel,
  getStatusDotClass,
  getStatusLabel,
  isTerminal,
  getLatestHypothesis,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default function IncidentOverviewPage() {
  const params = useParams()
  const incidentId = params.id as string
  const incident = mockIncidents.find((i) => i.id === incidentId) ?? mockIncidents[0]

  const latestHypothesis = getLatestHypothesis(incident)
  const recentEvents = incident.investigation.slice(-4)

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Incident overview"
          subtitle={incident.id}
        />

        <main className="flex-1 p-6 overflow-auto space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-3">
            <Link href="/incidents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                All incidents
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <span className="text-sm text-muted-foreground font-mono">{incident.id}</span>
          </div>

          {/* allAlertsCleared banner */}
          {incident.allAlertsCleared && !isTerminal(incident.status) && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-severity-warning/40 bg-severity-warning/5">
              <BanIcon className="w-5 h-5 text-severity-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  All source alerts have cleared
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The monitoring sources no longer report alerts for this incident. If the issue has auto-healed, you can abort.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => console.log("abort", incident.id)}
              >
                Mark as aborted
              </Button>
            </div>
          )}

          {/* Incident header card */}
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className={cn("text-xs font-medium", getSeverityBadgeClass(incident.severity))}
                    >
                      {getSeverityLabel(incident.severity)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs gap-1.5 bg-secondary text-foreground border-border"
                    >
                      <span
                        className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass(incident.status))}
                        aria-hidden="true"
                      />
                      {getStatusLabel(incident.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {formatTimeAgo(incident.createdAt)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold">{incident.title}</h2>
                  {incident.aiSummary && (
                    <p className="text-sm text-muted-foreground">{incident.aiSummary}</p>
                  )}
                </div>

                {/* Transitions are handled on the investigation page — no duplication here. */}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Correlated alerts */}
            <div className="lg:col-span-2">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-severity-warning" />
                    Correlated alerts ({incident.alerts.length})
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Each alert shows why the engine grouped it here — score, rule, and whether the LLM qualifier was involved.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {incident.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0 mt-0.5",
                          alert.source === "dynatrace"
                            ? "bg-chart-1 text-white"
                            : "bg-chart-5 text-white"
                        )}
                        title={alert.source}
                      >
                        {alert.source[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Row 1: title + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm text-foreground">{alert.title}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", getSeverityBadgeClass(alert.severity))}
                          >
                            {alert.severity}
                          </Badge>
                          {alert.correlation && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-border bg-secondary"
                              title="Correlation score — how confident the engine was this alert belongs to the incident"
                            >
                              score {alert.correlation.score}
                            </Badge>
                          )}
                          {alert.correlation?.viaLlmQualifier && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 bg-accent/10 text-accent border-accent/30"
                            >
                              <Bot className="w-3 h-3" />
                              via LLM qualifier
                            </Badge>
                          )}
                          {alert.clearedAtSource && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 bg-status-validated/10 text-status-validated border-status-validated/30"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Cleared
                            </Badge>
                          )}
                        </div>
                        {/* Row 2: description */}
                        <p className="text-xs text-foreground/80 leading-relaxed mb-1">
                          {alert.description}
                        </p>
                        {/* Row 3: service + timestamp */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-1">
                          <span className="font-mono">{alert.affectedService}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(alert.timestamp)}
                          </span>
                          <span className="capitalize text-muted-foreground/70">{alert.source}</span>
                        </div>
                        {/* Row 4: correlation rationale */}
                        {alert.correlation?.rationale && (
                          <p className="text-[11px] text-muted-foreground italic border-l-2 border-border pl-2">
                            {alert.correlation.rationale}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right rail */}
            <div className="space-y-4">
              {/* Quick navigation */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <Button className="w-full" variant="secondary" asChild>
                    <Link href={`/incidents/${incident.id}/investigation`}>
                      <Microscope className="w-4 h-4 mr-2" />
                      Open investigation
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </Link>
                  </Button>
                  <Button className="w-full" variant="outline" asChild>
                    <Link href={`/incidents/${incident.id}/report`}>
                      <FileText className="w-4 h-4 mr-2" />
                      View post-mortem
                      <ExternalLink className="w-3 h-3 ml-auto" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Latest hypothesis */}
              {latestHypothesis && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Latest hypothesis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono border-border bg-secondary"
                      >
                        confidence {latestHypothesis.confidence}%
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-border bg-secondary capitalize">
                        {latestHypothesis.decision}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                      {latestHypothesis.content.replace(/\*\*/g, "")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Mini-timeline */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Recent events</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {recentEvents.map((ev, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/60" />
                        <div className="min-w-0">
                          {ev.kind === "status_change" && (
                            <p className="text-xs text-muted-foreground">
                              {ev.auto ? "Auto" : <><User className="w-3 h-3 inline mr-1" />{ev.actor}</>}
                              {" · "}
                              <span className="font-medium text-foreground">
                                {getStatusLabel(ev.from)} → {getStatusLabel(ev.to)}
                              </span>
                            </p>
                          )}
                          {ev.kind === "hypothesis" && (
                            <p className="text-xs text-muted-foreground">
                              <Bot className="w-3 h-3 inline mr-1" />
                              Hypothesis #{ev.hypothesis.iteration} — {ev.hypothesis.confidence}% confidence
                            </p>
                          )}
                          {ev.kind === "human_feedback" && (
                            <p className="text-xs text-muted-foreground">
                              <User className="w-3 h-3 inline mr-1" />
                              {ev.actor} — {ev.decision}
                              {ev.comment && <span className="italic"> "{ev.comment}"</span>}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                            {formatTimeAgo(ev.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
