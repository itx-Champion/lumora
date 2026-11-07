import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ArrowLeft, Building2, Mail, Phone } from "lucide-react"
import { AiInsight } from "@/components/crm/ai-insight"
import { NewDealDialog, NewTaskDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { ActivityComposer, ContactControls, ScoreExplainer, TaskCheckbox, TimelineItem } from "@/components/crm/record-widgets"
import { initials, Panel, PriorityBadge, ScoreBadge, StatusBadge } from "@/components/crm/ui"
import { RelativeTime } from "@/components/crm/client"
import { money, stageLabel } from "@/lib/crm/constants"
import { getContactDetail, listMembers } from "@/lib/crm/queries"
import { scoreBand } from "@/lib/crm/scoring"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Contact" }

export default async function ContactPage({ params }: PageProps<"/app/crm/contacts/[id]">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const { id } = await params
  const [d, members] = await Promise.all([getContactDetail(ctx, id), listMembers(ctx)])
  if (!d) notFound()
  const c = d.contact
  const name = (mid: string | null) => members.find((m) => m.id === mid)?.name
  const active = members.filter((m) => m.status === "active" && m.role !== "viewer")
  const band = scoreBand(c.score)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <Link href="/app/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Contacts
      </Link>

      <div className="relative overflow-hidden rounded-2xl border bg-card/60 p-5 shadow-sm">
        <div className="pointer-events-none absolute -top-32 -left-20 size-72 rounded-full bg-violet/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-xl font-semibold text-white shadow-lg shadow-violet/20">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{c.name}</h2>
              <p className="text-sm text-muted-foreground">
                {c.title ?? "No title"}
                {d.company && (
                  <>
                    {" at "}
                    <Link href={`/app/crm/companies/${d.company.id}`} className="font-medium text-foreground hover:underline">
                      {d.company.name}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-3.5" /> {c.email}
              </a>
              {c.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {c.phone}
                </span>
              )}
              <span>Source: {c.source}</span>
              <span>
                Added <RelativeTime date={c.createdAt} />
              </span>
            </div>
            <ContactControls contactId={c.id} lifecycle={c.lifecycle} ownerId={c.ownerId} tags={c.tags} members={members} />
          </div>
          <div className="flex items-center gap-3 rounded-2xl border bg-background/60 p-3">
            <ScoreBadge score={c.score} className="scale-125" />
            <div className="pl-1">
              <p className={cn("text-sm font-semibold", band.className)}>{band.label} lead</p>
              <p className="text-xs text-muted-foreground">AI score {c.score}/100</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <AiInsight task="contact-summary" id={c.id} label="Brief me on this contact" description="A pre-call summary from deals, tickets and every logged touchpoint." />
          <ActivityComposer contactId={c.id} />
          <Panel title={`Timeline · ${d.timeline.length}`}>
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
                    href={a.subjectType === "ticket" ? `/app/crm/inbox?t=${a.subjectId}&status=all` : undefined}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Lead score">
            <ScoreExplainer contactId={c.id} score={c.score} reasons={c.scoreReasons} />
          </Panel>

          <Panel
            title={`Deals · ${d.deals.length}`}
            action={
              <NewDealDialog
                label="Add"
                members={active}
                companies={d.company ? [{ id: d.company.id, name: d.company.name }] : []}
                contacts={[{ id: c.id, name: c.name, companyId: c.companyId }]}
                defaults={{ companyId: d.company?.id, contactId: c.id }}
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
                {d.tickets.map((t) => (
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

          <Panel title="Tasks" action={<NewTaskDialog label="Add" variant="secondary" members={active} related={{ type: "contact", id: c.id, name: c.name.split(" ")[0] }} />}>
            {d.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No follow-ups scheduled.</p>
            ) : (
              <div className="divide-y">
                {d.tasks.map((t) => (
                  <TaskCheckbox key={t.id} id={t.id} done={t.done} title={t.title} dueAt={t.dueAt} assignee={name(t.assigneeId)} />
                ))}
              </div>
            )}
          </Panel>

          {d.colleagues.length > 0 && d.company && (
            <Panel title={<span className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" /> Also at {d.company.name}</span>} bodyClassName="p-2">
              <ul>
                {d.colleagues.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/crm/contacts/${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-foreground/5">
                      <span className="flex size-7 items-center justify-center rounded-full bg-foreground/[0.07] text-[10px] font-semibold">{initials(p.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{p.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
