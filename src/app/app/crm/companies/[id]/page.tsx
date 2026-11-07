import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, Globe, MapPin, Users } from "lucide-react"
import { NewDealDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { TimelineItem } from "@/components/crm/record-widgets"
import { HealthBar, initials, LifecycleBadge, Panel, PriorityBadge, ScoreBadge, StatTile, StatusBadge } from "@/components/crm/ui"
import { compactMoney, money, OPEN_STAGES, stageLabel } from "@/lib/crm/constants"
import { getCompanyDetail, listMembers } from "@/lib/crm/queries"
import { healthBand } from "@/lib/crm/scoring"

export const metadata: Metadata = { title: "Company" }

export default async function CompanyPage({ params }: PageProps<"/app/crm/companies/[id]">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const { id } = await params
  const [d, members] = await Promise.all([getCompanyDetail(ctx, id), listMembers(ctx)])
  if (!d) notFound()
  const { company } = d
  const name = (mid: string | null) => members.find((m) => m.id === mid)?.name
  const openDeals = d.deals.filter((x) => OPEN_STAGES.includes(x.stage))
  const won = d.deals.filter((x) => x.stage === "won")
  const openTickets = d.tickets.filter((t) => t.status === "open" || t.status === "pending")
  const rated = d.tickets.filter((t) => t.csat)
  const band = healthBand(company.health)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <Link href="/app/crm/companies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Companies
      </Link>
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border bg-card/60 p-5 shadow-sm">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-foreground/[0.07] text-xl font-semibold">{company.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold tracking-tight">{company.name}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {company.domain && (
              <span className="flex items-center gap-1.5">
                <Globe className="size-3.5" /> {company.domain}
              </span>
            )}
            {company.country && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {company.country}
              </span>
            )}
            {company.size && (
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {company.size} employees
              </span>
            )}
            {company.industry && <span>{company.industry}</span>}
            <span>Owner: {name(company.ownerId) ?? "Unassigned"}</span>
          </div>
        </div>
        <div className="w-56 rounded-2xl border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Account health</p>
          <p className={`mt-0.5 text-sm font-semibold ${band.className}`}>{band.label}</p>
          <div className="mt-2">
            <HealthBar value={company.health} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open pipeline" value={compactMoney.format(openDeals.reduce((n, x) => n + x.value, 0))} hint={`${openDeals.length} open deals`} />
        <StatTile label="Lifetime won" value={compactMoney.format(won.reduce((n, x) => n + x.value, 0))} hint={`${won.length} deals`} tone="emerald" />
        <StatTile label="Open tickets" value={openTickets.length} hint={`${d.tickets.length} all time`} tone="amber" />
        <StatTile
          label="CSAT"
          value={rated.length ? `${(rated.reduce((n, t) => n + (t.csat ?? 0), 0) / rated.length).toFixed(1)}/5` : "—"}
          hint={`${rated.length} ratings`}
          tone="cyan"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Panel title={`People · ${d.people.length}`} bodyClassName="p-2">
            <ul>
              {d.people.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/crm/contacts/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.07] text-[11px] font-semibold">{initials(p.name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{p.title}</span>
                    </span>
                    <LifecycleBadge value={p.lifecycle} />
                    <ScoreBadge score={p.score} />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            title={`Deals · ${d.deals.length}`}
            action={
              <NewDealDialog
                label="Add"
                members={members.filter((m) => m.status === "active" && m.role !== "viewer")}
                companies={[{ id: company.id, name: company.name }]}
                contacts={d.people.map((p) => ({ id: p.id, name: p.name, companyId: p.companyId }))}
                defaults={{ companyId: company.id }}
              />
            }
            bodyClassName="p-2"
          >
            {d.deals.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No deals yet.</p>
            ) : (
              <ul>
                {d.deals.map((deal) => (
                  <li key={deal.id}>
                    <Link href={`/app/crm/deals?deal=${deal.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{deal.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {stageLabel(deal.stage)} · {name(deal.ownerId) ?? "Unassigned"}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{money.format(deal.value)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Tickets · ${d.tickets.length}`} bodyClassName="p-2">
            {d.tickets.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">No support tickets.</p>
            ) : (
              <ul>
                {d.tickets.slice(0, 10).map((t) => (
                  <li key={t.id}>
                    <Link href={`/app/crm/inbox?t=${t.id}&status=all`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-foreground/5">
                      <span className="font-mono text-xs text-muted-foreground">#{t.number}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{t.subject}</span>
                      <PriorityBadge value={t.priority} />
                      <StatusBadge value={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel title="Account timeline">
          {d.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul>
              {d.timeline.map((a) => (
                <TimelineItem
                  key={a.id}
                  type={a.type}
                  title={a.title}
                  body={a.body}
                  occurredAt={a.occurredAt}
                  actor={name(a.actorId)}
                  href={a.contactId ? `/app/crm/contacts/${a.contactId}` : undefined}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
