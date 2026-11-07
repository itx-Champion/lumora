"use client"

import { useMemo } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ThumbsUp,
  Clock,
  HelpCircle,
  Inbox,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import { useWorkspace } from "@/components/app/workspace-provider"
import { useNow } from "@/hooks/use-now"
import { Skeleton } from "@/components/ui/skeleton"
import type { Workspace } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

// Recharts measures the DOM, so it only renders on the client.
const QuestionsChart = dynamic(() => import("@/components/dashboard/charts").then((m) => m.QuestionsChart), {
  ssr: false,
  loading: () => <Skeleton className="h-64 rounded-xl" />,
})
const CitedDocsChart = dynamic(() => import("@/components/dashboard/charts").then((m) => m.CitedDocsChart), {
  ssr: false,
})

const DAY = 24 * 60 * 60 * 1000
const dayFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })
const timeFmt = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" })

function median(values: number[]) {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function computeStats(ws: Workspace, now: number) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const inRange = (from: number, to: number) => ws.logs.filter((l) => l.at >= from && l.at < to)
  const thisWeek = inRange(now - 7 * DAY, now + 1)
  const lastWeek = inRange(now - 14 * DAY, now - 7 * DAY)
  const rate = (logs: typeof thisWeek) => (logs.length ? logs.filter((l) => l.answered).length / logs.length : 0)
  const delta = (a: number, b: number) => (b ? (a - b) / b : 0)

  const days = Array.from({ length: 14 }, (_, i) => {
    const start = startOfToday - (13 - i) * DAY
    const logs = inRange(start, start + DAY)
    return {
      day: new Date(start).toISOString().slice(0, 10),
      label: dayFmt.format(start),
      answered: logs.filter((l) => l.answered).length,
      unanswered: logs.filter((l) => !l.answered).length,
    }
  })

  const citations = new Map<string, number>()
  for (const l of ws.logs) for (const id of l.citedDocIds) citations.set(id, (citations.get(id) ?? 0) + 1)
  const cited = [...citations.entries()]
    .map(([id, count]) => ({ title: ws.documents.find((d) => d.id === id)?.title ?? "Removed document", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const gaps = new Map<string, { question: string; count: number; last: number }>()
  for (const l of ws.logs.filter((l) => !l.answered)) {
    const key = l.question.toLowerCase()
    const g = gaps.get(key) ?? { question: l.question, count: 0, last: 0 }
    gaps.set(key, { ...g, count: g.count + 1, last: Math.max(g.last, l.at) })
  }

  return {
    questions: thisWeek.length,
    questionsDelta: delta(thisWeek.length, lastWeek.length),
    answerRate: rate(thisWeek),
    answerRateDelta: rate(thisWeek) - rate(lastWeek),
    medianLatency: median(thisWeek.map((l) => l.latencyMs)),
    latencyDelta: delta(median(thisWeek.map((l) => l.latencyMs)), median(lastWeek.map((l) => l.latencyMs))),
    rated: ws.logs.filter((l) => l.rating).length,
    helpful: (() => {
      const rated = ws.logs.filter((l) => l.rating)
      return rated.length ? rated.filter((l) => l.rating === "up").length / rated.length : 0
    })(),
    openActions: ws.actions.filter((a) => !a.done).length,
    totalActions: ws.actions.length,
    days,
    cited,
    gaps: [...gaps.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    recent: [...ws.logs].sort((a, b) => b.at - a.at).slice(0, 6),
    hasSample: ws.logs.some((l) => l.sample),
  }
}

function Delta({ value, format, invert }: { value: number; format: (n: number) => string; invert?: boolean }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return <span className="text-xs text-muted-foreground">No change vs last week</span>
  }
  const good = invert ? value < 0 : value > 0
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
          good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        )}
      >
        <Icon className="size-3" />
        {format(Math.abs(value))}
      </span>
      vs last week
    </span>
  )
}

export default function OverviewPage() {
  const { workspace, user } = useWorkspace()
  const now = useNow()
  const stats = useMemo(() => (workspace && now ? computeStats(workspace, now) : null), [workspace, now])

  if (!workspace || !stats) return <OverviewSkeleton />

  const pct = (n: number) => `${Math.round(n * 100)}%`
  const tiles = [
    {
      label: "Questions this week",
      value: stats.questions.toLocaleString(),
      icon: MessageSquare,
      delta: <Delta value={stats.questionsDelta} format={pct} />,
    },
    {
      label: "Answer rate",
      value: pct(stats.answerRate),
      icon: CheckCircle2,
      delta: <Delta value={stats.answerRateDelta} format={(n) => `${Math.round(n * 100)} pts`} />,
    },
    {
      label: "Median response time",
      value: `${(stats.medianLatency / 1000).toFixed(1)}s`,
      icon: Clock,
      delta: <Delta value={stats.latencyDelta} format={pct} invert />,
    },
    {
      label: "Helpful answers",
      value: stats.rated ? pct(stats.helpful) : "—",
      icon: ThumbsUp,
      delta: <span className="text-xs text-muted-foreground">{stats.rated} rated by your team</span>,
    },
    {
      label: "Open actions",
      value: stats.openActions.toLocaleString(),
      icon: Inbox,
      delta: <span className="text-xs text-muted-foreground">{stats.totalActions} created by the agent</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Welcome back, {user.name.split(" ")[0]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s how your team is using Lumora.</p>
        </div>
        <div className="flex items-center gap-2">
          {stats.hasSample && (
            <span
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
              title="The workspace is seeded with three weeks of sample activity. Your own questions are added on top."
            >
              Includes sample activity
            </span>
          )}
          <Link
            href="/app/chat?new=1"
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:-translate-y-0.5"
          >
            <Sparkles className="size-4" /> Ask Lumora
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border bg-card/60 p-5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {t.label}
              <t.icon className="size-4" />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{t.value}</p>
            <div className="mt-2">{t.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-3xl border bg-card/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Questions per day</h3>
              <p className="text-xs text-muted-foreground">Last 14 days</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[var(--series-1)]" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-[var(--series-2)]" /> No answer found
              </span>
            </div>
          </div>
          <QuestionsChart data={stats.days} />
        </section>

        <section className="rounded-3xl border bg-card/60 p-5">
          <h3 className="font-semibold tracking-tight">Most cited documents</h3>
          <p className="mb-5 text-xs text-muted-foreground">Sources the assistant relied on most</p>
          <CitedDocsChart data={stats.cited} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card/60 p-5">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-amber-500" />
            <h3 className="font-semibold tracking-tight">Knowledge gaps</h3>
          </div>
          <p className="mb-4 text-xs text-muted-foreground">Questions your documents couldn&apos;t answer — add a doc to close them</p>
          <ul className="divide-y">
            {stats.gaps.map((g) => (
              <li key={g.question} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="truncate">{g.question}</span>
                <span className="ml-auto shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  asked {g.count}×
                </span>
              </li>
            ))}
            {stats.gaps.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No gaps — every question was answered.</li>}
          </ul>
          <Link href="/app/knowledge" className="mt-3 inline-flex items-center gap-1 text-sm font-medium hover:text-violet">
            Upload documents <ArrowRight className="size-3.5" />
          </Link>
        </section>

        <section className="rounded-3xl border bg-card/60 p-5">
          <h3 className="font-semibold tracking-tight">Recent questions</h3>
          <p className="mb-4 text-xs text-muted-foreground">Latest activity across the workspace</p>
          <ul className="space-y-1">
            {stats.recent.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/app/chat?new=1&q=${encodeURIComponent(l.question)}`}
                  className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-foreground/[0.04]"
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      l.answered ? "bg-violet/10 text-violet" : "bg-amber-500/10 text-amber-500"
                    )}
                    title={l.answered ? "Answered" : "No answer found"}
                  >
                    {l.answered ? <CheckCircle2 className="size-3.5" /> : <HelpCircle className="size-3.5" />}
                  </span>
                  <span className="truncate">{l.question}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {now - l.at < DAY ? timeFmt.format(l.at) : dayFmt.format(l.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Skeleton className="h-12 w-72 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-3xl" />
    </div>
  )
}
