"use client"

import Link from "next/link"
import { ArrowRight, CalendarClock, Check, CheckSquare, Inbox, KanbanSquare, Loader2, Mail, Search, Target, Ticket, TriangleAlert, type LucideIcon } from "lucide-react"
import type { LumoraUIMessage } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

type Part = LumoraUIMessage["parts"][number]
type ToolPart = Extract<Part, { type: `tool-${string}`; toolCallId: string }>

const meta: Record<string, { icon: LucideIcon; name: string; pending: string }> = {
  "tool-createTicket": { icon: Ticket, name: "createTicket", pending: "Creating ticket…" },
  "tool-draftEmail": { icon: Mail, name: "draftEmail", pending: "Drafting email…" },
  "tool-scheduleMeeting": { icon: CalendarClock, name: "scheduleMeeting", pending: "Scheduling meeting…" },
  "tool-searchCrm": { icon: Search, name: "searchCrm", pending: "Searching the CRM…" },
  "tool-pipelineSummary": { icon: Target, name: "pipelineSummary", pending: "Reading the pipeline…" },
  "tool-listOpenTickets": { icon: Inbox, name: "listOpenTickets", pending: "Loading open tickets…" },
  "tool-updateDealStage": { icon: KanbanSquare, name: "updateDealStage", pending: "Moving the deal…" },
  "tool-createTask": { icon: CheckSquare, name: "createTask", pending: "Creating task…" },
}

const priorityColor: Record<string, string> = {
  P1: "bg-red-500/15 text-red-500",
  P2: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  P3: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  P4: "bg-foreground/10 text-muted-foreground",
  urgent: "bg-red-500/15 text-red-500",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  normal: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  low: "bg-foreground/10 text-muted-foreground",
}

function OpenLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null
  return (
    <Link href={href} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet hover:underline">
      {label} <ArrowRight className="size-3" />
    </Link>
  )
}

function Body({ part }: { part: ToolPart }) {
  if (part.state !== "output-available") return null
  switch (part.type) {
    case "tool-createTicket": {
      const o = part.output
      return (
        <>
          <p className="font-medium">{o.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-mono text-muted-foreground">{o.id}</span>
            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">{o.team}</span>
            <span className={cn("rounded-full px-2 py-0.5 font-medium", priorityColor[o.priority])}>{o.priority}</span>
            {o.assignee && <span className="text-muted-foreground">→ {o.assignee}</span>}
          </div>
          {o.automations.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Automations: {o.automations.join(", ")}</p>}
          <OpenLink href={o.href} label="Open in Inbox" />
        </>
      )
    }
    case "tool-draftEmail": {
      const o = part.output
      return (
        <>
          <p className="font-medium">{o.subject}</p>
          <p className="text-xs text-muted-foreground">To {o.to}</p>
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">{o.body}</p>
          <OpenLink href={o.href} label="Logged on contact timeline" />
        </>
      )
    }
    case "tool-scheduleMeeting": {
      const o = part.output
      return (
        <>
          <p className="font-medium">{o.title}</p>
          <p className="text-xs text-muted-foreground">
            {o.date} · {o.time} · {o.durationMinutes} min
          </p>
          <p className="mt-1 text-xs text-muted-foreground">With {o.attendees.join(", ")}</p>
          <OpenLink href={o.href} label="View contact" />
        </>
      )
    }
    case "tool-searchCrm": {
      const o = part.output
      if (o.error) return <p className="text-muted-foreground">{o.error}</p>
      const rows = [
        ...o.contacts.map((c) => ({ key: c.id, label: c.name, hint: [c.title, c.company].filter(Boolean).join(" · "), href: `/app/crm/contacts/${c.id}` })),
        ...o.companies.map((c) => ({ key: c.id, label: c.name, hint: `health ${c.health}`, href: `/app/crm/companies/${c.id}` })),
        ...o.deals.map((d) => ({ key: d.id, label: d.title, hint: d.stage, href: `/app/crm/deals?deal=${d.id}` })),
        ...o.tickets.map((t) => ({ key: t.id, label: `#${t.number} ${t.subject}`, hint: t.status, href: `/app/crm/inbox?t=${t.id}&status=all` })),
      ].slice(0, 6)
      return rows.length ? (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="flex items-center gap-2 rounded-md text-xs hover:text-violet">
                <span className="truncate font-medium">{r.label}</span>
                <span className="truncate text-muted-foreground">{r.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No matches in the CRM.</p>
      )
    }
    case "tool-pipelineSummary": {
      const o = part.output
      if ("error" in o) return <p className="text-muted-foreground">{o.error}</p>
      return (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Open", o.openPipeline],
              ["Forecast", o.weightedForecast],
              ["Win rate", o.winRate],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-foreground/[0.04] py-1.5">
                <p className="text-sm font-semibold tabular-nums">{value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
              </div>
            ))}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
            {o.stages.map((s) => (
              <li key={s.stage} className="flex justify-between">
                <span>{s.stage}</span>
                <span className="tabular-nums">
                  {s.deals} · {s.value}
                </span>
              </li>
            ))}
          </ul>
          <OpenLink href="/app/crm/deals" label="Open the board" />
        </>
      )
    }
    case "tool-listOpenTickets": {
      const o = part.output
      return (
        <>
          <ul className="space-y-1">
            {o.tickets.map((t) => (
              <li key={t.number}>
                <Link href={t.href} className="flex items-center gap-2 text-xs hover:text-violet">
                  <span className="font-mono text-muted-foreground">#{t.number}</span>
                  <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                  <span className={cn("rounded-full px-1.5 text-[10px] font-medium", priorityColor[t.priority])}>{t.priority}</span>
                </Link>
              </li>
            ))}
          </ul>
          {o.tickets.length === 0 && <p className="text-muted-foreground">No open tickets.</p>}
          <OpenLink href="/app/crm/inbox" label="Open Inbox" />
        </>
      )
    }
    case "tool-updateDealStage": {
      const o = part.output
      if (!("deal" in o)) return <p className="text-muted-foreground">{o.error}</p>
      return (
        <>
          <p className="font-medium">{o.deal}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {o.from} → <span className="font-medium text-foreground">{o.to}</span> · {o.value}
          </p>
          <OpenLink href={o.href} label="View deal" />
        </>
      )
    }
    case "tool-createTask": {
      const o = part.output
      if ("error" in o) return <p className="text-muted-foreground">{o.error}</p>
      return (
        <>
          <p className="font-medium">{o.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {o.assignee}
            {o.dueAt && ` · due ${new Date(o.dueAt).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}`}
          </p>
          <OpenLink href={o.href} label="Open Tasks" />
        </>
      )
    }
    default:
      return null
  }
}

export function ToolCard({ part }: { part: ToolPart }) {
  const { icon: Icon, name, pending } = meta[part.type] ?? { icon: Check, name: part.type.slice(5), pending: "Working…" }
  const done = part.state === "output-available"
  const failed = part.state === "output-error"

  return (
    <div className="my-3 max-w-md overflow-hidden rounded-2xl border bg-background/70 shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">
        {failed ? <TriangleAlert className="size-3.5 text-destructive" /> : done ? <Check className="size-3.5 text-emerald-500" /> : <Loader2 className="size-3.5 animate-spin text-violet" />}
        {name}
        <span className="ml-auto">{failed ? "failed" : done ? "completed" : "running"}</span>
      </div>

      <div className="flex gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {failed ? <p className="text-destructive">{part.errorText}</p> : !done ? <p className="text-muted-foreground">{pending}</p> : <Body part={part} />}
        </div>
      </div>
    </div>
  )
}

export function isToolPart(part: Part): part is ToolPart {
  return part.type in meta
}
