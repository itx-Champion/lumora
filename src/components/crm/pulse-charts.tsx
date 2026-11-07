"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { compactMoney, money } from "@/lib/crm/constants"

type StagePoint = { label: string; value: number; count: number }
type TrendPoint = { label: string; created: number; resolved: number }

const axis = { tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 11 } } as const

function StageTooltip({ active, payload }: { active?: boolean; payload?: { payload: StagePoint }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{p.label}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{money.format(p.value)}</span> · {p.count} deal{p.count === 1 ? "" : "s"}
      </p>
    </div>
  )
}

/** Open pipeline value by stage: one series, one hue. */
export function PipelineChart({ data }: { data: StagePoint[] }) {
  return (
    <div className="h-56" role="img" aria-label={`Open pipeline by stage: ${data.map((d) => `${d.label} ${money.format(d.value)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="34%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} tickFormatter={(v: number) => compactMoney.format(v)} width={52} />
          <Tooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={<StageTooltip />} />
          <Bar dataKey="value" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: TrendPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      {[
        { name: "Created", value: p.created, color: "var(--series-1)" },
        { name: "Resolved", value: p.resolved, color: "var(--series-2)" },
      ].map((row) => (
        <div key={row.name} className="mt-1 flex items-center gap-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: row.color }} />
          <span className="text-muted-foreground">{row.name}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Tickets created vs resolved per day: two series with a legend. */
export function TicketTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--series-1)]" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[var(--series-2)]" /> Resolved
        </span>
      </div>
      <div className="h-48" role="img" aria-label="Tickets created and resolved per day over the last 14 days">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...axis} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} content={<TrendTooltip />} />
            <Line type="monotone" dataKey="created" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="resolved" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
