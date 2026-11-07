"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarClock, Check, Mail, MessageSquareText, Phone, Plus, RefreshCw, StickyNote, X } from "lucide-react"
import { useCan } from "@/components/app/viewer"
import { useNow } from "@/hooks/use-now"
import type { Lifecycle } from "@/db/schema"
import { logContactActivity, recalculateScore, toggleTask, updateContact } from "@/lib/crm/actions/crm"
import { LIFECYCLES } from "@/lib/crm/constants"
import type { MemberLite } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, RelativeTime, useAction } from "./client"
import { Pill, selectClass, textareaClass, inputClass } from "./ui"

export function ContactControls({ contactId, lifecycle, ownerId, tags, members }: { contactId: string; lifecycle: Lifecycle; ownerId: string | null; tags: string[]; members: MemberLite[] }) {
  const can = useCan()
  const { pending, exec } = useAction()
  const [tag, setTag] = useState("")
  const disabled = !can("crm:write") || pending
  const save = (patch: Parameters<typeof updateContact>[1], msg: string) => exec(() => updateContact(contactId, patch), { success: msg })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Lifecycle stage" disabled={disabled} value={lifecycle} onChange={(e) => save({ lifecycle: e.target.value as Lifecycle }, "Lifecycle updated")} className={cn(selectClass, "h-8 w-32")}>
        {LIFECYCLES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <select aria-label="Owner" disabled={disabled} value={ownerId ?? ""} onChange={(e) => save({ ownerId: e.target.value || null }, "Owner updated")} className={cn(selectClass, "h-8 w-40")}>
        <option value="">Unassigned</option>
        {members
          .filter((m) => m.status === "active" && m.role !== "viewer")
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
      </select>
      {tags.map((t) => (
        <Pill key={t} className="bg-foreground/[0.06] pr-1 text-muted-foreground">
          {t}
          {!disabled && (
            <button aria-label={`Remove tag ${t}`} onClick={() => save({ tags: tags.filter((x) => x !== t) }, "Tag removed")} className="rounded-full p-0.5 hover:bg-foreground/10">
              <X className="size-2.5" />
            </button>
          )}
        </Pill>
      ))}
      {!disabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const value = tag.trim().toLowerCase()
            if (value && !tags.includes(value)) void save({ tags: [...tags, value] }, "Tag added").then(() => setTag(""))
          }}
        >
          <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ tag" maxLength={24} aria-label="Add tag" className="h-6 w-20 rounded-full border border-dashed bg-transparent px-2 text-[11px] outline-none focus:border-violet/50" />
        </form>
      )}
    </div>
  )
}

export function ScoreExplainer({ contactId, score, reasons }: { contactId: string; score: number; reasons: string[] }) {
  const can = useCan()
  const { pending, exec } = useAction()
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Why this score</p>
        {can("crm:write") && (
          <button onClick={() => exec(() => recalculateScore(contactId), { success: (d) => `Rescored: ${d?.score ?? score}` })} disabled={pending} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("size-3", pending && "animate-spin")} /> Recalculate
          </button>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {reasons.length === 0 && <li className="text-xs text-muted-foreground">No signals yet.</li>}
        {reasons.map((r) => (
          <li key={r} className="flex items-center gap-2 text-xs">
            <span className={cn("w-8 shrink-0 text-right font-mono font-semibold tabular-nums", r.startsWith("+") ? "text-emerald-500" : "text-red-500")}>{r.split(" ")[0]}</span>
            <span className="text-muted-foreground">{r.split(" ").slice(1).join(" ")}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const kinds = [
  { id: "note", label: "Note", icon: StickyNote, placeholder: "Champion is moving teams next quarter…" },
  { id: "call", label: "Call", icon: Phone, placeholder: "Discussed pricing; they want SSO before signing." },
  { id: "email", label: "Email", icon: Mail, placeholder: "Sent the security questionnaire." },
  { id: "meeting", label: "Meeting", icon: CalendarClock, placeholder: "Product demo with the support team." },
] as const

export function ActivityComposer({ contactId }: { contactId: string }) {
  const can = useCan()
  const [kind, setKind] = useState<(typeof kinds)[number]["id"]>("note")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const { pending, exec } = useAction()
  if (!can("crm:write")) return null
  const current = kinds.find((k) => k.id === kind)!
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await exec(() => logContactActivity(contactId, { type: kind, title: title || `${current.label} logged`, body }), { success: `${current.label} logged` })
        if (ok !== null) {
          setTitle("")
          setBody("")
        }
      }}
      className="rounded-2xl border bg-card/60 p-3 shadow-sm"
    >
      <div className="flex gap-1">
        {kinds.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors", kind === k.id ? "bg-violet/12 font-medium text-violet" : "text-muted-foreground hover:bg-foreground/5")}
          >
            <k.icon className="size-3.5" /> {k.label}
          </button>
        ))}
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${current.label} title`} maxLength={120} className={cn(inputClass, "mt-2")} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={current.placeholder} rows={2} maxLength={4000} className={cn(textareaClass, "mt-2")} />
      <div className="mt-2 flex justify-end">
        <PendingButton type="submit" pending={pending} disabled={!title.trim() && !body.trim()} className={cn(primaryButton, "h-8")}>
          <Plus className="size-3.5" /> Log {current.label.toLowerCase()}
        </PendingButton>
      </div>
    </form>
  )
}

export function TaskCheckbox({ id, done, title, dueAt, assignee }: { id: string; done: boolean; title: string; dueAt: Date | null; assignee?: string }) {
  const can = useCan()
  const { pending, exec } = useAction()
  const [checked, setChecked] = useState(done)
  const now = useNow()
  const overdue = !checked && dueAt && now > 0 && dueAt.getTime() < now
  return (
    <div className={cn("flex items-start gap-3 py-2", pending && "opacity-60")}>
      <button
        aria-label={checked ? `Mark “${title}” as not done` : `Complete “${title}”`}
        disabled={!can("crm:write") || pending}
        onClick={async () => {
          setChecked(!checked)
          const ok = await exec(() => toggleTask(id, !checked), { success: !checked ? "Task completed" : undefined })
          if (ok === null) setChecked(checked)
        }}
        className={cn(
          "mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors",
          checked ? "border-transparent bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white" : "hover:border-violet/60"
        )}
      >
        {checked && <Check className="size-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", checked && "text-muted-foreground line-through")}>{title}</p>
        <p className={cn("text-xs", overdue ? "text-red-500" : "text-muted-foreground")}>
          {dueAt ? (
            <>
              {overdue ? "Overdue · " : "Due "}
              <RelativeTime date={dueAt} />
            </>
          ) : (
            "No due date"
          )}
          {assignee && ` · ${assignee}`}
        </p>
      </div>
    </div>
  )
}

const activityIcon = { note: StickyNote, call: Phone, email: Mail, meeting: CalendarClock, stage_change: RefreshCw, ticket: MessageSquareText, task: Check, ai: RefreshCw } as const

export function TimelineItem({
  type,
  title,
  body,
  occurredAt,
  actor,
  href,
}: {
  type: keyof typeof activityIcon
  title: string
  body?: string | null
  occurredAt: Date
  actor?: string
  href?: string
}) {
  const Icon = activityIcon[type] ?? StickyNote
  const content = (
    <>
      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
        <Icon className="size-3.5 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <p className="text-sm">
          <span className="font-medium">{title}</span>
        </p>
        {body && <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{body}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {actor && `${actor} · `}
          <RelativeTime date={occurredAt} />
        </p>
      </div>
    </>
  )
  return (
    <li className="relative flex gap-3 before:absolute before:top-8 before:bottom-0 before:left-4 before:w-px before:bg-border last:before:hidden">
      {href ? (
        <Link href={href} className="flex flex-1 gap-3 hover:opacity-80">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  )
}
