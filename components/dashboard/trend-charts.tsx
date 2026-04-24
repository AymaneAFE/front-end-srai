"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts"
import { incidentTrendData, alertsBySourceData } from "@/lib/mock-data"

/**
 * Incident trend — "new" vs "resolved".
 *
 * Colour-blind safety:
 * - Previous version used chart-4 (red) vs chart-2 (green). That's exactly
 *   the pair that collapses to an indistinguishable brown for deuteranopia
 *   and protanopia viewers. Swapped to a cool/warm pair (amber vs. cyan)
 *   that differs in both hue AND luminance.
 * - Added a dashed stroke on the "resolved" series so the two lines can be
 *   told apart even in full greyscale.
 * - Legend is rendered explicitly — before, the user had no way to know
 *   which colour meant which.
 */
const NEW_COLOR = "var(--severity-warning)" // warm amber
const RESOLVED_COLOR = "var(--chart-2)" // cool teal

export function IncidentTrendChart({ compact = false }: { compact?: boolean }) {
  const chart = (
        <div className={compact ? "h-[160px] px-4" : "h-[200px]"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={incidentTrendData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="incidentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={NEW_COLOR} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={NEW_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={RESOLVED_COLOR} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={RESOLVED_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Legend
                verticalAlign="top"
                height={28}
                iconType="plainline"
                wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
              />
              <Area
                type="monotone"
                dataKey="incidents"
                stroke={NEW_COLOR}
                strokeWidth={2}
                fill="url(#incidentGradient)"
                name="New incidents"
              />
              <Area
                type="monotone"
                dataKey="resolved"
                stroke={RESOLVED_COLOR}
                strokeWidth={2}
                strokeDasharray="4 3"
                fill="url(#resolvedGradient)"
                name="Resolved"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
  )
  if (compact) return chart
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Incident trend</CardTitle>
        <p className="text-xs text-muted-foreground">Last 24 hours</p>
      </CardHeader>
      <CardContent>{chart}</CardContent>
    </Card>
  )
}

export function AlertsBySourceChart() {
  // Reassign colours so the two sources don't accidentally inherit a
  // severity-like palette. Slate + lavender read neutrally and rank only
  // by length.
  const colored = alertsBySourceData.map((d, i) => ({
    ...d,
    fill: i === 0 ? "var(--chart-1)" : "var(--chart-5)",
  }))

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Alerts by monitoring system</CardTitle>
        <p className="text-xs text-muted-foreground">Dynatrace & Centreon — last 30 days</p>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={colored} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="source"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)" }}
                formatter={(value: number) => [`${value} alerts`, "Count"]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {colored.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
