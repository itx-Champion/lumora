"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "motion/react"
import { BookOpen, Bot, Building2, Lock, Mail, Send, Sparkles, Star } from "lucide-react"
import { toast } from "sonner"
import { useCan, useViewer } from "@/components/app/viewer"
import { useWorkspace } from "@/components/app/workspace-provider"
import type { TicketPriority, TicketStatus } from "@/db/schema"
import { replyToTicket, updateTicket } from "@/lib/crm/actions/crm"
import { PRIORITIES, TICKET_STATUSES } from "@/lib/crm/constants"
import type { MemberLite, TicketThread } from "@/lib/crm/queries"
import { slaState } from "@/lib/crm/scoring"
import { cn } from "@/lib/utils"
import { useNow } from "@/hooks/use-now"
import { PendingButton, primaryButton, RelativeTime, useAction } from "./client"
import { initials, LifecycleBadge, MemberAvatar, Pill, ScoreBadge, selectClass, SlaBadge, StatusBadge, textareaClass } from "./ui"

export function TicketThreadView({ thread, members }: { thread: TicketThread; members: MemberLite[] }) {
  const { ticket, contact, company, messages, otherTickets } = thread
  const viewer = useViewer()
  const can = useCan()
  const now = useNow()
  const { index, template } = useWorkspace()
  const { pending, exec } = useAction()
  const [body, setBody] = useState("")
  const [internal, setInternal] = useState(false)
  const [fromAi, setFromAi] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [kbUsed, setKbUsed] = useState<string[]>([])
  const memberById = new Map(members.map((m) => [m.id, m]))
  const canWrite = can("crm:write")
  const sla = now ? slaState(ticket, now) : "none"

  const draft = async () => {
    setDrafting(true)
    try {
      // Ground the reply in the knowledge base that lives in this browser.
      const lastCustomer = [...messages].reverse().find((m) => m.authorType === "contact")?.body ?? ""
      const sources = index.search(`${ticket.subject} ${lastCustomer}`, 4).map((s) => ({ title: s.title, section: s.section, text: s.text.slice(0, 2400) }))
      const res = await fetch("/api/crm/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "ticket-reply", id: ticket.id, sources }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Couldn't draft a reply.")
      setBody(data.text)
      setInternal(false)
      setFromAi(true)
      setKbUsed(data.sources ?? [])
      toast.success(data.mode === "demo" ? "Draft ready (template mode)" : "AI draft ready — review before sending")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't draft a reply.")
    } finally {
      setDrafting(false)
    }
  }

  const send = async (status?: TicketStatus) => {
    const result = await exec(() => replyToTicket(ticket.id, { body, internal, status, fromAi }), {
      success: internal ? "Internal note added" : status === "resolved" ? "Reply sent and ticket resolved" : "Reply sent",
    })
    if (result) {
      setBody("")
      setFromAi(false)
      setKbUsed([])
    }
  }

  const update = (patch: Parameters<typeof updateTicket>[1], msg: string) => exec(() => updateTicket(ticket.id, patch), { success: msg })

  return (
    <div className="grid h-full min-h-0 xl:grid-cols-[1fr_300px]">
      <div className="flex min-h-0 flex-col">
        <header className="space-y-3 border-b p-4 sm:px-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-muted-foreground">
                #{ticket.number} · via {ticket.channel} · {ticket.team}
              </p>
              <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{ticket.subject}</h2>
            </div>
            <SlaBadge state={sla} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select aria-label="Status" disabled={!canWrite || pending} value={ticket.status} onChange={(e) => update({ status: e.target.value as TicketStatus }, "Status updated")} className={cn(selectClass, "h-8 w-32")}>
              {TICKET_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <select aria-label="Priority" disabled={!canWrite || pending} value={ticket.priority} onChange={(e) => update({ priority: e.target.value as TicketPriority }, "Priority updated")} className={cn(selectClass, "h-8 w-32")}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Assignee"
              disabled={!canWrite || pending}
              value={ticket.assigneeId ?? ""}
              onChange={(e) => update({ assigneeId: e.target.value || null }, "Assignee updated")}
              className={cn(selectClass, "h-8 w-44")}
            >
              <option value="">Unassigned</option>
              {members
                .filter((m) => m.status === "active" && m.role !== "viewer")
                .filter((m) => can("tickets:assign") || m.id === viewer?.memberId || m.id === ticket.assigneeId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            {ticket.tags.map((t) => (
              <Pill key={t} className="bg-foreground/[0.06] text-muted-foreground">
                {t}
              </Pill>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:px-6" data-lenis-prevent>
          {messages.map((m) => {
            const member = m.authorId ? memberById.get(m.authorId) : undefined
            const mine = m.authorType === "member"
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", mine && "flex-row-reverse")}>
                {m.authorType === "ai" ? (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
                    <Bot className="size-4" />
                  </span>
                ) : member ? (
                  <MemberAvatar name={member.name} hue={member.avatarHue} size="sm" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.08] text-[11px] font-semibold">{initials(m.authorName)}</span>
                )}
                <div className={cn("max-w-[80%] min-w-0", mine && "text-right")}>
                  <p className="mb-1 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{m.authorName}</span>
                    {m.internal && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                        <Lock className="size-3" /> internal
                      </span>
                    )}
                    {" · "}
                    <RelativeTime date={m.createdAt} />
                  </p>
                  <div
                    className={cn(
                      "inline-block rounded-2xl px-4 py-2.5 text-left text-sm leading-relaxed whitespace-pre-line",
                      m.internal
                        ? "border border-dashed border-amber-500/40 bg-amber-500/[0.06]"
                        : mine
                          ? "bg-[linear-gradient(135deg,color-mix(in_oklch,var(--brand-violet)_18%,transparent),color-mix(in_oklch,var(--brand-cyan)_12%,transparent))]"
                          : "border bg-card/80"
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              </motion.div>
            )
          })}
          {ticket.csat && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              Customer rated this conversation
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={cn("size-3.5", i < (ticket.csat ?? 0) ? "fill-amber-400 text-amber-400" : "text-foreground/20")} />
              ))}
            </p>
          )}
        </div>

        {canWrite && (
          <div className="border-t p-3 sm:px-6">
            <div className={cn("rounded-2xl border bg-card/70 p-2 shadow-sm transition-colors", internal && "border-amber-500/40 bg-amber-500/[0.04]")}>
              <div className="flex items-center gap-1 px-1 pb-1">
                {[
                  { id: false, label: "Reply", icon: Mail },
                  { id: true, label: "Internal note", icon: Lock },
                ].map((tab) => (
                  <button
                    key={String(tab.id)}
                    onClick={() => setInternal(tab.id)}
                    className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs", internal === tab.id ? "bg-foreground/[0.07] font-medium" : "text-muted-foreground hover:text-foreground")}
                  >
                    <tab.icon className="size-3.5" /> {tab.label}
                  </button>
                ))}
                <button
                  onClick={draft}
                  disabled={drafting}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-violet/10 px-2.5 py-1 text-xs font-medium text-violet transition-colors hover:bg-violet/15 disabled:opacity-60"
                  title={`Drafts a reply grounded in the “${template.name}” knowledge base`}
                >
                  <Sparkles className={cn("size-3.5", drafting && "animate-pulse")} />
                  {drafting ? "Drafting…" : "Draft with AI"}
                </button>
              </div>
              <textarea
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  if (!e.target.value) setFromAi(false)
                }}
                rows={4}
                placeholder={internal ? "Only your team sees internal notes…" : `Reply to ${contact?.name.split(" ")[0] ?? "the customer"}…`}
                className={cn(textareaClass, "resize-none border-0 bg-transparent focus:ring-0")}
              />
              {kbUsed.length > 0 && (
                <p className="flex flex-wrap items-center gap-1.5 px-2 pb-1 text-[11px] text-muted-foreground">
                  <BookOpen className="size-3" /> Grounded in: {kbUsed.join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2 px-1">
                {!internal && (
                  <PendingButton pending={pending} disabled={!body.trim()} onClick={() => send("resolved")} className="h-8 rounded-lg border px-3 text-sm hover:bg-foreground/5">
                    Send & resolve
                  </PendingButton>
                )}
                <PendingButton pending={pending} disabled={!body.trim()} onClick={() => send()} className={cn(primaryButton, "h-8")}>
                  <Send className="size-3.5" /> {internal ? "Add note" : "Send reply"}
                </PendingButton>
              </div>
            </div>
          </div>
        )}
      </div>

      <aside className="hidden min-h-0 space-y-5 overflow-y-auto border-l p-5 xl:block" data-lenis-prevent>
        {contact ? (
          <div className="space-y-3">
            <Link href={`/app/crm/contacts/${contact.id}`} className="flex items-center gap-3 hover:opacity-80">
              <span className="flex size-10 items-center justify-center rounded-full bg-foreground/[0.08] text-sm font-semibold">{initials(contact.name)}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{contact.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{contact.title ?? contact.email}</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <LifecycleBadge value={contact.lifecycle} />
              <ScoreBadge score={contact.score} />
            </div>
            <p className="truncate text-xs text-muted-foreground">{contact.email}</p>
            {company && (
              <Link href={`/app/crm/companies/${company.id}`} className="flex items-center gap-2 rounded-xl border p-2.5 text-sm hover:bg-foreground/5">
                <Building2 className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{company.name}</span>
                <span className="text-xs text-muted-foreground">health {company.health}</span>
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No contact linked.</p>
        )}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">SLA</p>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Opened</dt>
              <dd>
                <RelativeTime date={ticket.createdAt} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">First reply due</dt>
              <dd>
                <RelativeTime date={ticket.dueAt} />
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">First reply</dt>
              <dd>{ticket.firstResponseAt ? <RelativeTime date={ticket.firstResponseAt} /> : "Waiting"}</dd>
            </div>
          </dl>
        </div>
        {otherTickets.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Other tickets from this customer</p>
            <ul className="space-y-1">
              {otherTickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/app/crm/inbox?t=${t.id}&status=all`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-foreground/5">
                    <span className="font-mono text-muted-foreground">#{t.number}</span>
                    <span className="min-w-0 flex-1 truncate">{t.subject}</span>
                    <StatusBadge value={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}
