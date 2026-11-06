"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { CalendarClock, Check, Copy, Inbox, Mail, MessageSquare, Sparkles, Ticket } from "lucide-react"
import { toast } from "sonner"
import { useWorkspace } from "@/components/app/workspace-provider"
import { Skeleton } from "@/components/ui/skeleton"
import type { ActionRecord } from "@/lib/workspace/types"
import { cn } from "@/lib/utils"

const filters = [
  { id: "all", label: "All" },
  { id: "ticket", label: "Tickets" },
  { id: "email", label: "Emails" },
  { id: "meeting", label: "Meetings" },
] as const

type Filter = (typeof filters)[number]["id"]

const icons = { ticket: Ticket, email: Mail, meeting: CalendarClock }
const priorityColor: Record<string, string> = {
  P1: "bg-red-500/15 text-red-500",
  P2: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  P3: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  P4: "bg-foreground/10 text-muted-foreground",
}
const timeFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

function ActionCard({ action, onToggle }: { action: ActionRecord; onToggle: () => void }) {
  const Icon = icons[action.kind]
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn("rounded-2xl border bg-card/60 p-4 transition-opacity", action.done && "opacity-60")}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-medium", action.done && "line-through")}>
              {action.kind === "email" ? action.data.subject : action.data.title}
            </p>
            {action.kind === "ticket" && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", priorityColor[action.data.priority])}>
                {action.data.priority}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-mono">{action.data.id}</span> · {timeFmt.format(action.data.createdAt)}
            {action.kind === "ticket" && ` · ${action.data.team}`}
            {action.kind === "email" && ` · To ${action.data.to}`}
            {action.kind === "meeting" &&
              ` · ${action.data.date} ${action.data.time} · ${action.data.durationMinutes} min · ${action.data.attendees.join(", ")}`}
          </p>
          {action.kind === "ticket" && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {action.data.description}
            </p>
          )}
          {action.kind === "email" && (
            <p className="mt-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {action.data.body}
            </p>
          )}
          {action.kind === "meeting" && action.data.agenda && (
            <p className="mt-2 text-sm text-muted-foreground">Agenda: {action.data.agenda}</p>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 pl-[52px]">
        <button
          onClick={onToggle}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            action.done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "hover:bg-foreground/5"
          )}
        >
          <Check className="size-3.5" />
          {action.done ? "Completed" : action.kind === "email" ? "Mark as sent" : "Mark done"}
        </button>
        {action.kind === "email" && (
          <button
            onClick={() => {
              void navigator.clipboard.writeText(`Subject: ${action.data.subject}\n\n${action.data.body}`)
              toast.success("Email copied to clipboard")
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-foreground/5"
          >
            <Copy className="size-3.5" /> Copy
          </button>
        )}
        {action.conversationId && (
          <Link
            href={`/app/chat?c=${action.conversationId}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="size-3.5" /> View chat
          </Link>
        )}
      </div>
    </motion.li>
  )
}

export default function ActionsPage() {
  const { workspace, store } = useWorkspace()
  const [filter, setFilter] = useState<Filter>("all")

  if (!workspace) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  }

  const actions = workspace.actions.filter((a) => filter === "all" || a.kind === filter)
  const counts = {
    all: workspace.actions.length,
    ticket: workspace.actions.filter((a) => a.kind === "ticket").length,
    email: workspace.actions.filter((a) => a.kind === "email").length,
    meeting: workspace.actions.filter((a) => a.kind === "meeting").length,
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <div className="flex flex-wrap gap-1 rounded-2xl border bg-card/60 p-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "relative rounded-xl px-4 py-2 text-sm transition-colors",
              filter === f.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {filter === f.id && (
              <motion.span layoutId="actions-tab" className="absolute inset-0 rounded-xl bg-foreground/[0.07]" />
            )}
            <span className="relative">
              {f.label} <span className="text-xs text-muted-foreground">{counts[f.id]}</span>
            </span>
          </button>
        ))}
      </div>

      {actions.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-violet/10 text-violet">
            <Inbox className="size-6" />
          </span>
          <h3 className="mt-4 text-lg font-semibold">Nothing here yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Ask the assistant to open a ticket, draft an email or schedule a meeting — every action lands here.
          </p>
          <Link
            href={`/app/chat?new=1&q=${encodeURIComponent("Open a ticket for billing to refund an annual plan")}`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            <Sparkles className="size-4" /> Try “Open a ticket for billing…”
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          <AnimatePresence initial={false}>
            {actions.map((a) => (
              <ActionCard key={a.toolCallId} action={a} onToggle={() => store.toggleActionDone(a.toolCallId)} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}
