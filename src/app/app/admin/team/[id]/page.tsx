import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, Clock, Inbox, ListChecks, Smile, Target, Trophy } from "lucide-react"
import { RelativeTime } from "@/components/crm/client"
import { crmPage } from "@/components/crm/guards"
import { TimelineItem } from "@/components/crm/record-widgets"
import { MemberAvatar, Panel, Pill, RoleBadge, StatTile } from "@/components/crm/ui"
import { compactMoney, money, stageLabel } from "@/lib/crm/constants"
import { permissionsFor, PERMISSIONS } from "@/lib/crm/permissions"
import { getMemberProfile } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Member" }

export default async function MemberPage({ params }: PageProps<"/app/admin/team/[id]">) {
  const page = await crmPage("members:manage")
  if (!page.ok) return page.fallback
  const { id } = await params
  const p = await getMemberProfile(page.ctx, id)
  if (!p) notFound()
  const { member: m, stats } = p
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`)

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <Link href="/app/admin/team" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Team
      </Link>
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border bg-card/60 p-5 shadow-sm">
        <MemberAvatar name={m.name} hue={m.avatarHue} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{m.name}</h2>
            <RoleBadge role={m.role} />
            {m.status !== "active" && <Pill className="bg-foreground/8 text-muted-foreground capitalize">{m.status}</Pill>}
          </div>
          <p className="text-sm text-muted-foreground">
            {m.title ?? "No title"} · {m.team} team · {m.email}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Timezone {m.timezone} · Last active <RelativeTime date={m.lastActiveAt} /> · Joined <RelativeTime date={m.createdAt} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatTile label="Open tickets" value={stats.openTickets} icon={Inbox} tone="amber" />
        <StatTile label="Resolved (30d)" value={stats.resolved30d} icon={Trophy} tone="emerald" />
        <StatTile label="SLA met" value={pct(stats.slaRate)} icon={Clock} tone="cyan" />
        <StatTile label="CSAT" value={stats.csat === null ? "—" : stats.csat.toFixed(1)} icon={Smile} tone="emerald" />
        <StatTile label="Open pipeline" value={compactMoney.format(stats.pipeline)} hint={`${compactMoney.format(stats.won)} won`} icon={Target} />
        <StatTile label="Open tasks" value={stats.openTasks} hint={stats.overdueTasks ? `${stats.overdueTasks} overdue` : "None overdue"} icon={ListChecks} tone="amber" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Recent activity">
          {p.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity logged yet.</p>
          ) : (
            <ul>
              {p.activity.map((a) => (
                <TimelineItem key={a.id} type={a.type} title={a.title} body={a.body} occurredAt={a.occurredAt} href={a.contactId ? `/app/crm/contacts/${a.contactId}` : undefined} />
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Top open deals" bodyClassName="p-2">
            {p.deals.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No open deals.</p>
            ) : (
              <ul>
                {p.deals.map((d) => (
                  <li key={d.id}>
                    <Link href={`/app/crm/deals?deal=${d.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-foreground/5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{d.title}</span>
                        <span className="text-xs text-muted-foreground">{stageLabel(d.stage)}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums">{money.format(d.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="What they can do">
            <ul className="space-y-1.5 text-sm">
              {permissionsFor(m.role).map((perm) => (
                <li key={perm} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {PERMISSIONS[perm].label}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Audit trail" bodyClassName="p-0">
            {p.audit.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No audit entries.</p>
            ) : (
              <ul className="divide-y">
                {p.audit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5 text-sm">
                    <p>{a.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actorName} · <RelativeTime date={a.createdAt} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
