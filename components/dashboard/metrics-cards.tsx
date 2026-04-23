"use client"

import { Card } from "@/components/ui/card"
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Activity,
  Sparkles,
} from "lucide-react"
import type { MetricSnapshot } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface MetricsCardsProps {
  metrics: MetricSnapshot
}

export function MetricsCards({ metrics }: MetricsCardsProps) {
  const primary = {
    label: "Open incidents",
    value: metrics.openIncidents.toString(),
    hint: `${metrics.criticalCount} critical · ${metrics.warningCount} warning`,
    icon: AlertTriangle,
  }

  const secondary = [
    {
      label: "MTTR",
      value: `${metrics.mttrMinutes}m`,
      hint: "mean time to resolve",
      icon: Clock,
      accent: "text-muted-foreground",
    },
    {
      label: "Validation rate",
      value: `${metrics.validationRate}%`,
      hint: "last 30 days",
      icon: CheckCircle2,
      accent: "text-status-validated",
    },
    {
      label: "Alerts today",
      value: metrics.alertsToday.toString(),
      hint: `${metrics.criticalCount + metrics.warningCount} high priority`,
      icon: Activity,
      accent: "text-muted-foreground",
    },
    {
      label: "AI-assisted",
      value: metrics.aiAssistedCount.toString(),
      hint: "ambiguous cases routed to LLM",
      icon: Sparkles,
      accent: "text-accent",
    },
  ]

  return (
    <Card className="bg-card border-border">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Hero metric — spans 2 columns on lg */}
        <div className="col-span-2 lg:col-span-2 p-6 bg-accent/5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {primary.label}
              </p>
              <p className="text-3xl font-semibold mt-1 text-foreground tabular-nums">
                {primary.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {primary.hint}
              </p>
            </div>
            <div className="p-2 rounded-md bg-accent/15 text-accent shrink-0">
              <primary.icon className="w-4 h-4" />
            </div>
          </div>
        </div>

        {secondary.map((m) => (
          <div key={m.label} className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <m.icon className={cn("w-3.5 h-3.5", m.accent)} />
              <p className="text-[11px] font-medium uppercase tracking-wider">
                {m.label}
              </p>
            </div>
            <p className="text-xl font-semibold mt-1.5 text-foreground tabular-nums">
              {m.value}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {m.hint}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
