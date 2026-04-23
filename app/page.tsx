"use client"

import { useState } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { IncidentFeed } from "@/components/dashboard/incident-feed"
import { IncidentDetail } from "@/components/dashboard/incident-detail"
import { IncidentTrendChart, AlertsBySourceChart } from "@/components/dashboard/trend-charts"
import { CopilotSlideOver } from "@/components/dashboard/copilot-slideover"
import { mockIncidents, mockMetrics, type Incident } from "@/lib/mock-data"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

/**
 * Command Center — top-level operational dashboard.
 *
 * Layout rationale:
 *
 * - **Work-first hierarchy.** The previous layout surfaced KPIs at the top,
 *   charts in the middle, and the active-incidents queue below the fold. For
 *   a tool whose primary user is a SRE on-call, the KPIs are context, not
 *   the job. The job is triaging the active queue. So we put incidents at
 *   the top (split feed + detail) and push KPIs into a dense strip below.
 * - **Charts as supporting context.** The two time-series charts move to the
 *   bottom of the page, where they're still scannable but no longer steal
 *   vertical space from the queue.
 * - **Copilot as floating overlay.** The old pushed-sidebar compressed the
 *   KPI row whenever the Copilot was open. The slide-over (with backdrop)
 *   leaves the main grid at full width, so opening the assistant doesn't
 *   reflow the dashboard.
 */
export default function DashboardPage() {
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    mockIncidents[0]
  )
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Command Center"
          subtitle="Real-time incident monitoring and AI-assisted response"
        />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-[1600px] mx-auto space-y-6">
            {/* 1. Active work — the reason the user opened the page. */}
            <section aria-labelledby="active-queue-heading">
              <div className="flex items-center justify-between mb-3">
                <h2 id="active-queue-heading" className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Active queue
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCopilotOpen(true)}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-accent" />
                  Ask Copilot
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <IncidentFeed
                    incidents={mockIncidents}
                    onSelectIncident={setSelectedIncident}
                    selectedIncidentId={selectedIncident?.id}
                  />
                </div>
                <div className="lg:col-span-3">
                  {selectedIncident && (
                    <IncidentDetail incident={selectedIncident} />
                  )}
                </div>
              </div>
            </section>

            {/* 2. KPI strip — dense row, not the hero. */}
            <section aria-labelledby="kpi-strip-heading">
              <h2 id="kpi-strip-heading" className="sr-only">Key metrics</h2>
              <MetricsCards metrics={mockMetrics} />
            </section>

            {/* 3. Supporting trends — below the fold. */}
            <section aria-labelledby="trends-heading">
              <h2 id="trends-heading" className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Trends
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <IncidentTrendChart />
                <AlertsBySourceChart />
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Copilot lives as a slide-over, not a pushed sidebar — opening it
          does not reflow the underlying grid. */}
      <CopilotSlideOver
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        incident={selectedIncident}
      />

      {/* Floating launcher — always available, even when the Copilot is closed. */}
      {!isCopilotOpen && (
        <button
          onClick={() => setIsCopilotOpen(true)}
          aria-label="Open Incident Copilot"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform z-30"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}
