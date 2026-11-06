"use client"

import { CalendarClock, Check, Loader2, Mail, Ticket, TriangleAlert } from "lucide-react"
import type { LumoraUIMessage } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

type ToolPart = Extract<
  LumoraUIMessage["parts"][number],
  { type: "tool-createTicket" | "tool-draftEmail" | "tool-scheduleMeeting" }
>

const meta = {
  "tool-createTicket": { icon: Ticket, name: "createTicket", pending: "Creating ticket…" },
  "tool-draftEmail": { icon: Mail, name: "draftEmail", pending: "Drafting email…" },
  "tool-scheduleMeeting": { icon: CalendarClock, name: "scheduleMeeting", pending: "Scheduling meeting…" },
} as const

const priorityColor: Record<string, string> = {
  P1: "bg-red-500/15 text-red-500",
  P2: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  P3: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  P4: "bg-foreground/10 text-muted-foreground",
}

export function ToolCard({ part }: { part: ToolPart }) {
  const { icon: Icon, name, pending } = meta[part.type]
  const done = part.state === "output-available"
  const failed = part.state === "output-error"

  return (
    <div className="my-3 max-w-md overflow-hidden rounded-2xl border bg-background/70 shadow-sm">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 font-mono text-xs text-muted-foreground">
        {failed ? (
          <TriangleAlert className="size-3.5 text-destructive" />
        ) : done ? (
          <Check className="size-3.5 text-emerald-500" />
        ) : (
          <Loader2 className="size-3.5 animate-spin text-violet" />
        )}
        {name}
        <span className="ml-auto">{failed ? "failed" : done ? "completed" : "running"}</span>
      </div>

      <div className="flex gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1 text-sm">
          {failed ? (
            <p className="text-destructive">{part.errorText}</p>
          ) : !done ? (
            <p className="text-muted-foreground">{pending}</p>
          ) : part.type === "tool-createTicket" ? (
            <>
              <p className="font-medium">{part.output.title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-mono text-muted-foreground">{part.output.id}</span>
                <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">{part.output.team}</span>
                <span className={cn("rounded-full px-2 py-0.5 font-medium", priorityColor[part.output.priority])}>
                  {part.output.priority}
                </span>
              </div>
            </>
          ) : part.type === "tool-draftEmail" ? (
            <>
              <p className="font-medium">{part.output.subject}</p>
              <p className="text-xs text-muted-foreground">To {part.output.to}</p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed whitespace-pre-line text-muted-foreground">
                {part.output.body}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">{part.output.title}</p>
              <p className="text-xs text-muted-foreground">
                {part.output.date} · {part.output.time} · {part.output.durationMinutes} min
              </p>
              <p className="mt-1 text-xs text-muted-foreground">With {part.output.attendees.join(", ")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function isToolPart(part: LumoraUIMessage["parts"][number]): part is ToolPart {
  return part.type in meta
}
