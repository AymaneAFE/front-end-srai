"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChevronRight,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react"
import type { Incident } from "@/lib/mock-data"
import { formatTimeAgo, getSeverityBadgeClass, getStatusDotClass, getStatusLabel } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface IncidentFeedProps {
  incidents: Incident[]
  onSelectIncident?: (incident: Incident) => void
  selectedIncidentId?: string
}

export function IncidentFeed({
  incidents,
  onSelectIncident,
  selectedIncidentId,
}: IncidentFeedProps) {
  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Active Incidents</CardTitle>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View all
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border">
            {incidents.map((incident) => (
              <button
                key={incident.id}
                onClick={() => onSelectIncident?.(incident)}
                className={cn(
                  "w-full text-left px-5 py-4 hover:bg-secondary/50 transition-colors",
                  selectedIncidentId === incident.id && "bg-secondary"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs font-medium",
                          getSeverityBadgeClass(incident.severity)
                        )}
                      >
                        {incident.severity}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-xs gap-1.5 bg-secondary text-foreground border-border"
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            getStatusDotClass(incident.status),
                          )}
                          aria-hidden="true"
                        />
                        {getStatusLabel(incident.status)}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm text-foreground truncate">
                      {incident.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {incident.id}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(incident.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {incident.alerts.length} alerts
                  </span>
                </div>

                {incident.aiSummary && (
                  <div className="mt-3 p-2 rounded bg-accent/10 border border-accent/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {incident.aiSummary}
                      </p>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
