"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type DayPoint = { day: string; label: string; answered: number; unanswered: number }

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey?: string | number; value?: number; color?: string; payload: DayPoint }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const total = point.answered + point.unanswered
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      <div className="mt-1.5 space-y-1">
        {[
          { name: "Answered", value: point.answered, color: "var(--series-1)" },
          { name: "No answer found", value: point.unanswered, color: "var(--series-2)" },
        ].map((row) => (
          <div key={row.name} className="flex items-center gap-2">
            <span className="size-2 rounded-sm" style={{ background: row.color }} />
            <span className="text-muted-foreground">{row.name}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 border-t pt-1.5 text-muted-foreground">
        {total} questions · {total ? Math.round((point.answered / total) * 100) : 0}% answered
      </p>
    </div>
  )
}

export function QuestionsChart({ data }: { data: DayPoint[] }) {
  return (
    <div className="h-64" role="img" aria-label="Questions per day, split by answered and unanswered">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
          />
          <Tooltip cursor={{ fill: "var(--foreground)", fillOpacity: 0.05 }} content={<ChartTooltip />} />
          {/* A 2px surface-colored stroke separates stacked segments. */}
          <Bar dataKey="answered" stackId="q" fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
          <Bar
            dataKey="unanswered"
            stackId="q"
            fill="var(--series-2)"
            stroke="var(--card)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CitedDocsChart({ data }: { data: { title: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  return (
    <ul className="space-y-3" aria-label="Most cited documents">
      {data.map((d) => (
        <li key={d.title} className="group" title={`${d.title}: ${d.count} citations`}>
          <div className="flex items-center justify-between text-sm">
            <span className="truncate">{d.title}</span>
            <span className="pl-3 text-xs font-medium tabular-nums text-muted-foreground">{d.count}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-foreground/[0.05]">
            <div
              className="h-full rounded-full bg-[var(--series-1)] transition-[width] duration-700 group-hover:opacity-80"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {data.length === 0 && <li className="text-sm text-muted-foreground">No citations yet.</li>}
    </ul>
  )
}
