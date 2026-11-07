"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { Tag, Trash2, UserRound, X } from "lucide-react"
import { useCan } from "@/components/app/viewer"
import { bulkUpdateContacts, deleteContacts } from "@/lib/crm/actions/crm"
import { LIFECYCLES } from "@/lib/crm/constants"
import type { ContactRow, MemberLite } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"
import { RelativeTime, useAction } from "./client"
import { initials, LifecycleBadge, MemberAvatar, Pill, ScoreBadge, selectClass } from "./ui"

export function ContactsTable({ rows, members }: { rows: ContactRow[]; members: MemberLite[] }) {
  const router = useRouter()
  const can = useCan()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tag, setTag] = useState("")
  const { pending, exec } = useAction()
  const memberById = new Map(members.map((m) => [m.id, m]))
  const ids = [...selected].filter((id) => rows.some((r) => r.id === id))
  const all = rows.length > 0 && ids.length === rows.length

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const bulk = async (patch: Parameters<typeof bulkUpdateContacts>[1], message: string) => {
    const done = await exec(() => bulkUpdateContacts(ids, patch), { success: message })
    if (done) setSelected(new Set())
  }

  return (
    <div className="relative">
      <div className="overflow-x-auto rounded-2xl border bg-card/60 shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-10 py-3 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all contacts on this page"
                  checked={all}
                  onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4 accent-violet-500"
                />
              </th>
              <th className="py-3 font-medium">Name</th>
              <th className="py-3 font-medium">Company</th>
              <th className="py-3 font-medium">Stage</th>
              <th className="py-3 font-medium">Score</th>
              <th className="py-3 font-medium">Owner</th>
              <th className="py-3 font-medium">Tags</th>
              <th className="py-3 pr-4 text-right font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const owner = c.ownerId ? memberById.get(c.ownerId) : null
              const checked = selected.has(c.id)
              return (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/app/crm/contacts/${c.id}`)}
                  className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-foreground/[0.03]", checked && "bg-violet/[0.06]")}
                >
                  <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${c.name}`} checked={checked} onChange={() => toggle(c.id)} className="size-4 accent-violet-500" />
                  </td>
                  <td className="py-2.5">
                    <Link href={`/app/crm/contacts/${c.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-[11px] font-semibold">{initials(c.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-48 py-2.5">
                    <span className="block truncate">{c.company ?? <span className="text-muted-foreground">—</span>}</span>
                    {c.title && <span className="block truncate text-xs text-muted-foreground">{c.title}</span>}
                  </td>
                  <td className="py-2.5">
                    <LifecycleBadge value={c.lifecycle} />
                  </td>
                  <td className="py-2.5">
                    <ScoreBadge score={c.score} />
                  </td>
                  <td className="py-2.5">
                    {owner ? (
                      <span className="flex items-center gap-2">
                        <MemberAvatar name={owner.name} hue={owner.avatarHue} size="xs" />
                        <span className="truncate text-xs">{owner.name.split(" ")[0]}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="py-2.5">
                    <span className="flex max-w-40 flex-wrap gap-1">
                      {c.tags.slice(0, 2).map((t) => (
                        <Pill key={t} className="bg-foreground/[0.06] text-muted-foreground">
                          {t}
                        </Pill>
                      ))}
                      {c.tags.length > 2 && <Pill className="text-muted-foreground">+{c.tags.length - 2}</Pill>}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right text-xs text-muted-foreground">
                    <RelativeTime date={c.lastActivityAt} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {ids.length > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="sticky bottom-4 z-10 mx-auto mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border bg-popover/95 p-2 pl-4 shadow-2xl backdrop-blur"
          >
            <span className="text-sm font-medium tabular-nums">{ids.length} selected</span>
            {can("crm:write") && (
              <>
                <span className="h-5 w-px bg-border" />
                <label className="flex items-center gap-1.5">
                  <UserRound className="size-4 text-muted-foreground" />
                  <select
                    aria-label="Assign owner"
                    disabled={pending}
                    value=""
                    onChange={(e) => e.target.value && bulk({ ownerId: e.target.value === "none" ? null : e.target.value }, "Owner updated")}
                    className={cn(selectClass, "h-8 w-36")}
                  >
                    <option value="">Assign to…</option>
                    {members
                      .filter((m) => m.status === "active" && m.role !== "viewer")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    <option value="none">Unassigned</option>
                  </select>
                </label>
                <select
                  aria-label="Set lifecycle stage"
                  disabled={pending}
                  value=""
                  onChange={(e) => e.target.value && bulk({ lifecycle: e.target.value as "lead" }, "Lifecycle updated")}
                  className={cn(selectClass, "h-8 w-36")}
                >
                  <option value="">Set stage…</option>
                  {LIFECYCLES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (tag.trim()) void bulk({ addTag: tag.trim().toLowerCase() }, `Tagged “${tag.trim().toLowerCase()}”`).then(() => setTag(""))
                  }}
                  className="flex items-center gap-1"
                >
                  <Tag className="size-4 text-muted-foreground" />
                  <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Add tag" maxLength={24} className="h-8 w-24 rounded-lg border bg-background/60 px-2 text-sm outline-none" />
                </form>
              </>
            )}
            {can("crm:delete") && (
              <button
                disabled={pending}
                onClick={async () => {
                  if (!confirm(`Delete ${ids.length} contact${ids.length > 1 ? "s" : ""}? This can't be undone.`)) return
                  const done = await exec(() => deleteContacts(ids), { success: (d) => `Deleted ${d.count} contact${d.count === 1 ? "" : "s"}` })
                  if (done) setSelected(new Set())
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 text-sm text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
            )}
            <button onClick={() => setSelected(new Set())} aria-label="Clear selection" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5">
              <X className="size-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
