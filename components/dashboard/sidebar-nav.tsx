"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  AlertTriangle,
  MessageSquare,
  Settings,
  Activity,
  GitBranch,
  Database,
  Zap,
  Search,
  Bell,
  Microscope,
  TrendingUp,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Incidents", href: "/incidents", icon: AlertTriangle },
  { name: "Copilot", href: "/copilot", icon: MessageSquare },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
]

/**
 * Each source declares what pipelines it feeds. We render these as small
 * monochrome icons (bell = alerts, microscope = investigation context) rather
 * than coloured badges — the old coloured labels collided with the severity
 * palette (red "Alerts" pill next to a red "Critical" pill).
 */
type SourceRole = "alerts" | "investigation" | "both"

const dataSources: Array<{
  name: string
  icon: typeof Activity
  status: "connected" | "degraded" | "disconnected"
  role: SourceRole
}> = [
  { name: "Dynatrace", icon: Activity, status: "connected", role: "both" },
  { name: "Centreon", icon: Database, status: "connected", role: "alerts" },
  { name: "ELK Stack", icon: Search, status: "connected", role: "investigation" },
  { name: "GitLab", icon: GitBranch, status: "connected", role: "investigation" },
  { name: "Salesforce", icon: Zap, status: "connected", role: "investigation" },
]

function SourceRoleIcons({ role }: { role: SourceRole }) {
  const showAlerts = role === "alerts" || role === "both"
  const showInvestigation = role === "investigation" || role === "both"
  return (
    <div className="flex items-center gap-1 text-sidebar-foreground/50">
      {showAlerts && (
        <span title="Feeds the alerts pipeline" aria-label="Feeds alerts">
          <Bell className="w-3.5 h-3.5" />
        </span>
      )}
      {showInvestigation && (
        <span title="Queried during investigation" aria-label="Feeds investigation context">
          <Microscope className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  )
}

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-64 border-r border-border bg-sidebar min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent">
          <Zap className="w-5 h-5 text-accent-foreground" />
        </div>
        <span className="text-lg font-semibold text-sidebar-foreground">
          Incident Copilot
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Data Sources Section */}
        <div className="mt-8">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Connected Sources
          </h3>
          <div className="mt-3 space-y-1">
            {dataSources.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3 text-sidebar-foreground/70">
                  <span className="relative">
                    <item.icon className="w-4 h-4" />
                    {/* Connection-status dot. Uses neutral / warn / off tones
                         so it can't be confused with incident severity. */}
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-sidebar",
                        item.status === "connected" && "bg-status-validated",
                        item.status === "degraded" && "bg-severity-warning",
                        item.status === "disconnected" && "bg-muted-foreground/60",
                      )}
                      aria-label={`Status: ${item.status}`}
                    />
                  </span>
                  {item.name}
                </div>
                <SourceRoleIcons role={item.role} />
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="w-5 h-5" />
          Settings
        </Link>
      </div>
    </aside>
  )
}
