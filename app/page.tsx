"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { IncidentTrendChart } from "@/components/dashboard/trend-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopilotSlideOver } from "@/components/dashboard/copilot-slideover"
import {
  Filter,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Layers,
  Bot,
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  mockIncidents,
  mockMetrics,
  formatTimeAgo,
  getSeverityBadgeClass,
  getStatusDotClass,
  getStatusLabel,
  getLatestHypothesis,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

// ─── Compact incident action card ───────────────────────────────────────────

function ActionCard({
  incident,
}: {
  incident: (typeof mockIncidents)[number]
}) {
  const latest = getLatestHypothesis(incident)
  return (
    <Link href={`/incidents/${incident.id}`} className="block group">
      <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge
              variant="outline"
              className={cn("text-[10px]", getSeverityBadgeClass(incident.severity))}
            >
              {incident.severity}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] gap-1 bg-secondary text-foreground border-border"
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", getStatusDotClass(incident.status))} />
              {getStatusLabel(incident.status)}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{incident.id}</span>
          </div>
          <p className="text-sm font-medium text-foreground truncate group-hover:text-accent transition-colors">
            {incident.title}
          </p>
          {latest && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Bot className="w-3 h-3 shrink-0" />
              <span className="truncate">
                Hypothesis #{latest.iteration} · {latest.confidence}% confidence
              </span>
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(incident.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {incident.alerts.length} alerts
            </span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors shrink-0 mt-0.5" />
      </div>
    </Link>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [copilotOpen, setCopilotOpen] = useState(false)

  const needsReview = mockIncidents.filter((i) => i.status === "waiting_for_review")
  const justDetected = mockIncidents.filter((i) => i.status === "detected")
  const investigating = mockIncidents.filter(
    (i) => i.status === "investigating" || i.status === "reinvestigating",
  )

  const kpis = [
    {
      label: "Open incidents",
      value: mockMetrics.openIncidents.toString(),
      sub: `${mockMetrics.criticalCount} critical · ${mockMetrics.warningCount} warning`,
      icon: AlertTriangle,
      accent: mockMetrics.criticalCount > 0 ? "text-severity-critical" : "text-muted-foreground",
      hero: true,
    },
    {
      label: "Noise reduction",
      value: `${mockMetrics.noiseReductionPct.toFixed(1)}%`,
      sub: `${mockMetrics.alertsToday} alerts → incidents today`,
      icon: Filter,
      accent: "text-accent",
    },
    {
      label: "Needs review",
      value: needsReview.length.toString(),
      sub: "awaiting SRE decision",
      icon: CheckCircle2,
      accent: needsReview.length > 0 ? "text-severity-warning" : "text-muted-foreground",
    },
    {
      label: "MTTR",
      value: `${mockMetrics.mttrMinutes}m`,
      sub: "mean time to resolve",
      icon: Clock,
      accent: "text-muted-foreground",
    },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Command Center"
          subtitle="Real-time incident monitoring"
        />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-[1400px] mx-auto space-y-6">

            {/* KPI strip — 4 focused metrics */}
            <Card className="bg-card border-border">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
                {kpis.map((k, i) => (
                  <div key={k.label} className={cn("p-5", i === 0 && "bg-accent/5")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {k.label}
                        </p>
                        <p className={cn("text-2xl font-semibold mt-1 tabular-nums", i === 0 && "text-3xl")}>
                          {k.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{k.sub}</p>
                      </div>
                      <div className={cn("p-2 rounded-md shrink-0", i === 0 ? "bg-accent/15" : "bg-secondary")}>
                        <k.icon className={cn("w-4 h-4", k.accent)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Action queue — left 2/3 */}
              <div className="xl:col-span-2 space-y-6">

                {/* Needs your attention */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        Needs your attention
                      </h2>
                      {needsReview.length > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-severity-warning/20 text-severity-warning text-[10px] font-bold">
                          {needsReview.length}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setCopilotOpen(true)}
                    >
                      <Sparkles className="w-3 h-3 mr-1 text-accent" />
                      Ask Copilot
                    </Button>
                  </div>
                  {needsReview.length === 0 ? (
                    <Card className="bg-card border-border">
                      <CardContent className="p-6 text-center text-sm text-muted-foreground">
                        No incidents awaiting review. All hypotheses are resolved.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-2">
                      {needsReview.map((i) => (
                        <ActionCard key={i.id} incident={i} />
                      ))}
                    </div>
                  )}
                </section>

                {/* Investigating */}
                {investigating.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">
                      Under investigation
                    </h2>
                    <div className="space-y-2">
                      {investigating.map((i) => (
                        <ActionCard key={i.id} incident={i} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Just detected */}
                {justDetected.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-foreground mb-3">
                      Just detected
                    </h2>
                    <div className="space-y-2">
                      {justDetected.map((i) => (
                        <ActionCard key={i.id} incident={i} />
                      ))}
                    </div>
                  </section>
                )}

                {needsReview.length === 0 && investigating.length === 0 && justDetected.length === 0 && (
                  <Card className="bg-card border-border">
                    <CardContent className="p-8 text-center">
                      <CheckCircle2 className="w-8 h-8 text-status-validated mx-auto mb-3" />
                      <p className="text-sm font-medium">All clear</p>
                      <p className="text-xs text-muted-foreground mt-1">No active incidents requiring attention.</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right rail — trend + quick nav */}
              <div className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Incident volume</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-4">
                    <IncidentTrendChart compact />
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick navigation</p>
                    <Button className="w-full justify-start" variant="outline" size="sm" asChild>
                      <Link href="/incidents">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        All incidents
                        <ArrowRight className="w-3 h-3 ml-auto" />
                      </Link>
                    </Button>
                    <Button className="w-full justify-start" variant="outline" size="sm" asChild>
                      <Link href="/copilot">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Incident Copilot
                        <ArrowRight className="w-3 h-3 ml-auto" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      <CopilotSlideOver
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        incident={needsReview[0] ?? null}
      />
    </div>
  )
}
