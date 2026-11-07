import Link from "next/link"
import type { Metadata } from "next"
import { AlertOctagon, ArrowRight, Clock, Flame, HeartPulse, Inbox, Smile, Target, Trophy, TrendingUp, TriangleAlert, Zap } from "lucide-react"
import { AiInsight } from "@/components/crm/ai-insight"
import { Greeting } from "@/components/crm/greeting"
import { crmPage } from "@/components/crm/guards"
import { PipelineChart, TicketTrendChart } from "@/components/crm/pulse-charts-lazy"
import { HealthBar, Panel, ScoreBadge, StatTile } from "@/components/crm/ui"
import { compactMoney, stageLabel } from "@/lib/crm/constants"
import { getPulse, type Signal } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Pulse" }

const severity: Record<Signal["severity"], { icon: typeof Zap; className: string; label: string }> = {
  critical: { icon: AlertOctagon, className: "bg-red-500/12 text-red-500", label: "Critical" },
  warning: { icon: TriangleAlert, className: "bg-amber-500/12 text-amber-500", label: "Needs attention" },
  opportunity: { icon: Flame, className: "bg-emerald-500/12 text-emerald-500", label: "Opportunity" },
}

export default async function PulsePage() {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const pulse = await getPulse(ctx)
  const k = pulse.kpis
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{ctx.org.name} · Pulse</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            <Greeting name={ctx.member.name.split(" ")[0]} />{" "}
            <span className="text-muted-foreground">
              {pulse.signals.length ? `${pulse.signals.length} things need you today.` : "Everything is on track."}
            </span>
          </h2>
        </div>
        <Link href="/app/chat?new=1&q=Summarize%20my%20pipeline%20and%20open%20urgent%20tickets" className="flex items-center gap-1.5 text-sm font-medium text-violet hover:underline">
          Ask the agent about your CRM <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Open pipeline" value={compactMoney.format(k.openValue)} hint={`${compactMoney.format(k.weighted)} weighted forecast`} icon={Target} />
        <StatTile label="Won this month" value={compactMoney.format(k.wonThisMonth)} hint={`${k.wonThisMonthCount} deal${k.wonThisMonthCount === 1 ? "" : "s"} closed`} icon={Trophy} tone="emerald" />
        <StatTile label="Win rate" value={pct(k.winRate)} hint="Won ÷ closed, all time" icon={TrendingUp} tone="cyan" />
        <StatTile label="Open tickets" value={k.openTickets} hint="Open and pending" icon={Inbox} tone="amber" />
        <StatTile label="SLA met" value={pct(k.slaRate)} hint={k.medianFirstResponseH === null ? "First response, 14 days" : `Median first reply ${k.medianFirstResponseH.toFixed(1)}h`} icon={Clock} tone="cyan" />
        <StatTile label="CSAT" value={k.csat === null ? "—" : `${k.csat.toFixed(1)}/5`} hint={`${k.csatCount} ratings, 14 days`} icon={Smile} tone="emerald" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <AiInsight
            task="briefing"
            label="Your AI briefing"
            description="Lumora reads the pipeline, inbox and team signals and tells you what to do first."
          />
          <Panel title="Signals" action={<span className="text-xs text-muted-foreground">Recomputed on every visit</span>} bodyClassName="p-2">
            {pulse.signals.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No risks or opportunities right now.</p>
            ) : (
              <ul className="divide-y">
                {pulse.signals.map((sig) => {
                  const sev = severity[sig.severity]
                  const Icon = sev.icon
                  return (
                    <li key={sig.id} className="flex items-start gap-3 px-3 py-3.5">
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", sev.className)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{sig.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{sig.detail}</p>
                      </div>
                      <Link href={sig.href} className="shrink-0 rounded-lg border bg-background/60 px-2.5 py-1 text-xs font-medium transition-colors hover:border-violet/40">
                        {sig.cta}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Open pipeline by stage" action={<Link href="/app/crm/deals" className="text-xs text-muted-foreground hover:text-foreground">Board →</Link>}>
            <PipelineChart data={pulse.pipeline.map((p) => ({ label: stageLabel(p.stage), value: p.value, count: p.count }))} />
          </Panel>
          <Panel title="Tickets, last 14 days" action={<Link href="/app/crm/inbox" className="text-xs text-muted-foreground hover:text-foreground">Inbox →</Link>}>
            <TicketTrendChart data={pulse.ticketTrend} />
          </Panel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><Flame className="size-4 text-red-500" /> Hottest leads</span>} bodyClassName="p-2">
          <ul>
            {pulse.hotLeads.map((l) => (
              <li key={l.id}>
                <Link href={`/app/crm/contacts/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5">
                  <ScoreBadge score={l.score} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.company ?? "No company"}</p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><HeartPulse className="size-4 text-amber-500" /> Accounts at risk</span>} bodyClassName="p-2">
          {pulse.atRisk.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Every account is healthy.</p>
          ) : (
            <ul>
              {pulse.atRisk.map((c) => (
                <li key={c.id}>
                  <Link href={`/app/crm/companies/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-foreground/5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                    </div>
                    <HealthBar value={c.health} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
