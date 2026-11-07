import Link from "next/link"
import type { Metadata } from "next"
import { Bot, CheckSquare, Workflow } from "lucide-react"
import { UrlTabs } from "@/components/crm/client"
import { NewTaskDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { TaskCheckbox } from "@/components/crm/record-widgets"
import { EmptyState, MemberAvatar, PageHeader, Pill } from "@/components/crm/ui"
import { listMembers, listTasks, type TaskRow } from "@/lib/crm/queries"
import { requestTime } from "@/lib/crm/time"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Tasks" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function TasksPage({ searchParams }: PageProps<"/app/crm/tasks">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const sp = await searchParams
  const view = one(sp.view) === "team" ? "team" : "mine"
  const [tasks, members] = await Promise.all([listTasks(ctx, { view }), listMembers(ctx)])
  const memberById = new Map(members.map((m) => [m.id, m]))

  const now = requestTime()
  const endOfToday = new Date(new Date(now).setHours(23, 59, 59, 999)).getTime()
  const open = tasks.filter((t) => !t.done)
  const groups: { id: string; title: string; tone?: string; items: TaskRow[] }[] = [
    { id: "overdue", title: "Overdue", tone: "text-red-500", items: open.filter((t) => t.dueAt && t.dueAt.getTime() < now) },
    { id: "today", title: "Today", items: open.filter((t) => t.dueAt && t.dueAt.getTime() >= now && t.dueAt.getTime() <= endOfToday) },
    { id: "upcoming", title: "Upcoming", items: open.filter((t) => t.dueAt && t.dueAt.getTime() > endOfToday) },
    { id: "nodate", title: "No due date", items: open.filter((t) => !t.dueAt) },
    { id: "done", title: "Completed", tone: "text-muted-foreground", items: tasks.filter((t) => t.done).slice(0, 15) },
  ].filter((g) => g.items.length)

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Tasks"
        description="Follow-ups from you, your team, automations and the AI agent, in one list."
        actions={<NewTaskDialog members={members.filter((m) => m.status === "active" && m.role !== "viewer")} />}
      />
      <UrlTabs
        param="view"
        tabs={[
          { value: "mine", label: "My tasks", count: view === "mine" ? open.length : undefined },
          { value: "team", label: "Whole team", count: view === "team" ? open.length : undefined },
        ]}
      />
      {groups.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nothing to do" description="You're all caught up. New follow-ups from automations and the agent will land here." />
      ) : (
        groups.map((g) => (
          <section key={g.id} className="rounded-2xl border bg-card/60 shadow-sm">
            <h3 className={cn("flex items-center gap-2 border-b px-5 py-3 text-sm font-semibold", g.tone)}>
              {g.title}
              <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">{g.items.length}</span>
            </h3>
            <ul className="divide-y px-5">
              {g.items.map((t) => {
                const assignee = t.assigneeId ? memberById.get(t.assigneeId) : undefined
                return (
                  <li key={t.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <TaskCheckbox id={t.id} done={t.done} title={t.title} dueAt={t.dueAt} />
                    </div>
                    {t.source !== "manual" && (
                      <Pill className="bg-violet/10 text-violet">
                        {t.source === "agent" ? <Bot className="size-3" /> : <Workflow className="size-3" />}
                        {t.source === "agent" ? "AI agent" : "Automation"}
                      </Pill>
                    )}
                    {t.contact && t.relatedId && (
                      <Link href={`/app/crm/contacts/${t.relatedId}`} className="hidden max-w-36 truncate text-xs text-muted-foreground hover:text-foreground sm:block">
                        {t.contact}
                      </Link>
                    )}
                    {view === "team" && assignee && <MemberAvatar name={assignee.name} hue={assignee.avatarHue} size="xs" />}
                    {t.priority === "high" && !t.done && <Pill className="bg-red-500/10 text-red-500">High</Pill>}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
