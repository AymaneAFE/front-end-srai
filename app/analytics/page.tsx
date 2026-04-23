"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { Header } from "@/components/dashboard/header"
import { IncidentTrendChart, AlertsBySourceChart } from "@/components/dashboard/trend-charts"

/**
 * Analytics dashboard — trends, historical metrics, and performance charts.
 *
 * This page contains all the supporting analytics that were previously
 * mixed into the command center. By separating them, the dashboard focuses
 * on active incident triage while analytics remain accessible for deeper
 * investigation and trend analysis.
 */
export default function AnalyticsPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <SidebarNav />

      <div className="flex-1 flex flex-col">
        <Header
          title="Analytics"
          subtitle="Historical trends, performance metrics, and system health"
        />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-[1600px] mx-auto">
            {/* Analytics trends */}
            <section aria-labelledby="trends-heading">
              <h2 id="trends-heading" className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Incident Trends
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <IncidentTrendChart />
                <AlertsBySourceChart />
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
