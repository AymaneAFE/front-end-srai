"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertCircle,
  Clock,
  GitCommit,
  ExternalLink,
  Microscope,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import type { Incident, Alert, AlertSource } from "@/lib/mock-data"
import { formatTimeAgo, getSeverityBadgeClass } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface IncidentDetailProps {
  incident: Incident
}

function getSourceColor(source: AlertSource): string {
  const colors: Record<AlertSource, string> = {
    dynatrace: "bg-chart-1 text-white",
    centreon: "bg-chart-5 text-white",
  }
  return colors[source] ?? "bg-muted text-foreground"
}

function AlertItem({ alert }: { alert: Alert }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50">
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded text-xs font-bold flex-shrink-0",
          getSourceColor(alert.source)
        )}
      >
        {alert.source[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-foreground truncate">
            {alert.title}
          </span>
          <Badge
            variant="outline"
            className={cn("text-xs", getSeverityBadgeClass(alert.severity))}
          >
            {alert.severity}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{alert.description}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(alert.timestamp)}
          </span>
          <span>{alert.affectedService}</span>
        </div>
      </div>
    </div>
  )
}

export function IncidentDetail({ incident }: IncidentDetailProps) {
  return (
    <Card className="bg-card border-border h-full bg-gradient-to-b from-card to-card/95">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-xs font-medium",
                  getSeverityBadgeClass(incident.severity)
                )}
              >
                {incident.severity}
              </Badge>
              <span className="text-xs text-muted-foreground">{incident.id}</span>
            </div>
            <CardTitle className="text-base font-medium leading-tight">
              {incident.title}
            </CardTitle>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Started {formatTimeAgo(incident.createdAt)}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/incidents/${incident.id}/investigation`}>
              <Microscope className="w-3 h-3 mr-1" />
              Open investigation
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link href={`/incidents/${incident.id}/report`}>
              <FileText className="w-3 h-3 mr-1" />
              Draft post-mortem
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-5 h-auto">
            <TabsTrigger
              value="analysis"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              AI Analysis
            </TabsTrigger>
            <TabsTrigger
              value="alerts"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              Correlated Alerts ({incident.alerts.length})
            </TabsTrigger>
            <TabsTrigger
              value="context"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent"
            >
              Context
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[280px]">
            <TabsContent value="analysis" className="p-5 mt-0">
              {incident.aiSummary && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm text-foreground mb-2">
                        AI Analysis
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {incident.aiSummary}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {incident.relatedCommits && incident.relatedCommits.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3">
                    Related Commits
                  </h4>
                  {incident.relatedCommits.map((commit) => (
                    <div
                      key={commit.sha}
                      className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                    >
                      <GitCommit className="w-4 h-4 text-chart-3 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{commit.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono">{commit.sha}</span>
                          <span>{commit.author}</span>
                          <span>{formatTimeAgo(commit.timestamp)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="p-5 mt-0 space-y-3">
              {incident.alerts.map((alert) => (
                <AlertItem key={alert.id} alert={alert} />
              ))}
            </TabsContent>

            <TabsContent value="context" className="p-5 mt-0">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Affected Services
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {incident.affectedServices.map((service) => (
                      <Badge key={service} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Timeline
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="w-20 text-xs">
                        {incident.createdAt.toLocaleTimeString()}
                      </span>
                      <AlertCircle className="w-3 h-3 text-severity-critical" />
                      <span>Incident created</span>
                    </div>
                    {incident.alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-center gap-3 text-muted-foreground"
                      >
                        <span className="w-20 text-xs">
                          {alert.timestamp.toLocaleTimeString()}
                        </span>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            alert.severity === "ok" && "bg-severity-ok",
                            alert.severity === "warning" && "bg-severity-warning",
                            alert.severity === "critical" && "bg-severity-critical",
                            alert.severity === "unknown" && "bg-severity-unknown",
                          )}
                        />
                        <span className="truncate">{alert.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  )
}
