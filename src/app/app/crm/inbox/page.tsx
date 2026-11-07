import Link from "next/link"
import type { Metadata } from "next"
import { Download, Inbox, MessagesSquare } from "lucide-react"
import { RelativeTime, UrlSearch, UrlSelect, UrlTabs } from "@/components/crm/client"
import { NewTicketDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { TicketThreadView } from "@/components/crm/ticket-thread"
import { EmptyState, MemberAvatar, PriorityBadge, SlaBadge } from "@/components/crm/ui"
import { PRIORITIES } from "@/lib/crm/constants"
import { getTicketThread, listMembers, listTickets } from "@/lib/crm/queries"
import { slaState } from "@/lib/crm/scoring"
import { requestTime } from "@/lib/crm/time"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Inbox" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function InboxPage({ searchParams }: PageProps<"/app/crm/inbox">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const sp = await searchParams
  const filters = { status: one(sp.status), view: one(sp.view), priority: one(sp.priority), q: one(sp.q) }
  const selectedId = one(sp.t)
  const [{ rows, counts }, members, thread] = await Promise.all([
    listTickets(ctx, filters),
    listMembers(ctx),
    selectedId ? getTicketThread(ctx, selectedId) : Promise.resolve(null),
  ])
  const memberById = new Map(members.map((m) => [m.id, m]))
  const count = (statuses: string[]) => counts.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c.n, 0)
  const now = requestTime()
  const linkFor = (id: string) => {
    const q = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => Boolean(e[1])))
    q.set("t", id)
    return `/app/crm/inbox?${q}`
  }

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <section className={cn("flex min-h-0 flex-col border-r lg:w-[400px] lg:shrink-0", thread && "hidden lg:flex")}>
        <div className="space-y-3 border-b p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Inbox</h2>
            <div className="flex items-center gap-2">
              <a href="/api/crm/export?type=tickets" aria-label="Export tickets as CSV" className="flex size-9 items-center justify-center rounded-lg border bg-background/60 hover:bg-foreground/5">
                <Download className="size-4" />
              </a>
              <NewTicketDialog label="New" />
            </div>
          </div>
          <UrlTabs
            param="status"
            className="w-full"
            tabs={[
              { value: "active", label: "Active", count: count(["open", "pending"]) },
              { value: "resolved", label: "Resolved", count: count(["resolved"]) },
              { value: "closed", label: "Closed", count: count(["closed"]) },
              { value: "all", label: "All" },
            ]}
          />
          <div className="flex gap-2">
            <UrlSearch placeholder="Search #, subject, customer" className="flex-1" />
            <UrlSelect
              param="view"
              label="View"
              className="min-w-0 w-32"
              options={[
                { value: "", label: "Everyone" },
                { value: "mine", label: "Mine" },
                { value: "unassigned", label: "Unassigned" },
              ]}
            />
          </div>
          <UrlSelect param="priority" label="Priority" className="w-full" options={[{ value: "", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p.id, label: p.label }))]} />
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto" data-lenis-prevent>
          {rows.length === 0 && (
            <li className="p-6">
              <EmptyState icon={Inbox} title="Inbox zero" description="No tickets match these filters." />
            </li>
          )}
          {rows.map((t) => {
            const assignee = t.assigneeId ? memberById.get(t.assigneeId) : undefined
            const sla = slaState(t, now)
            return (
              <li key={t.id}>
                <Link
                  href={linkFor(t.id)}
                  scroll={false}
                  className={cn("block space-y-1.5 px-4 py-3 transition-colors hover:bg-foreground/[0.03]", selectedId === t.id && "bg-violet/[0.07] shadow-[inset_2px_0_0_var(--brand-violet)]")}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">#{t.number}</span>
                    <span className="truncate">{t.contact ?? "Unknown"}</span>
                    <span className="ml-auto shrink-0">
                      <RelativeTime date={t.updatedAt} />
                    </span>
                  </div>
                  <p className={cn("truncate text-sm", t.status === "open" ? "font-semibold" : "font-medium")}>{t.subject}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{t.preview}</p>
                  <div className="flex items-center gap-1.5">
                    <PriorityBadge value={t.priority} />
                    {(sla === "breached" || sla === "at_risk") && <SlaBadge state={sla} />}
                    {t.status === "pending" && <span className="text-[11px] text-amber-600 dark:text-amber-300">Pending</span>}
                    <span className="ml-auto">
                      {assignee ? <MemberAvatar name={assignee.name} hue={assignee.avatarHue} size="xs" /> : <span className="text-[11px] text-muted-foreground">Unassigned</span>}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="min-h-0 min-w-0 flex-1">
        {thread ? (
          <TicketThreadView key={thread.ticket.id + thread.messages.length + thread.ticket.updatedAt.getTime()} thread={thread} members={members} />
        ) : (
          <div className="hidden h-full items-center justify-center p-8 lg:flex">
            <div className="max-w-sm text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet">
                <MessagesSquare className="size-5" />
              </span>
              <p className="mt-4 font-medium">Pick a conversation</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Every ticket is auto-triaged, routed by your automations and timed against its SLA. Open one and try <strong>Draft with AI</strong>: the reply is grounded in
                your knowledge base.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
