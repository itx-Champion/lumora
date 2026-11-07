"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, Contact, CornerDownLeft, FileText, Inbox, KanbanSquare, Loader2, MessageSquare, Plus, Search, Sparkles, type LucideIcon } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { searchCrmAction } from "@/lib/crm/actions/crm"
import { money, stageLabel } from "@/lib/crm/constants"
import { cn } from "@/lib/utils"
import { useWorkspace } from "./workspace-provider"
import { appNav } from "./nav"
import { useViewer } from "./viewer"

type CrmHits = Extract<Awaited<ReturnType<typeof searchCrmAction>>, { ok: true }>["data"]

type Command = { id: string; group: string; label: string; hint?: string; icon: LucideIcon; run: () => void }

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const { workspace, template } = useWorkspace()
  const viewer = useViewer()
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [hits, setHits] = useState<{ q: string; data: CrmHits } | null>(null)
  const trimmed = query.trim()
  const searching = Boolean(viewer) && trimmed.length >= 2 && hits?.q !== trimmed

  // Live CRM search across contacts, companies, deals and tickets.
  useEffect(() => {
    if (!viewer || trimmed.length < 2) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await searchCrmAction(trimmed)
      if (!cancelled && result.ok) setHits({ q: trimmed, data: result.data })
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, viewer])

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      onOpenChange(false)
      router.push(href)
    }
    const ask = (q: string) => go(`/app/chat?new=1&q=${encodeURIComponent(q)}`)
    return [
      { id: "new", group: "Actions", label: "New chat", icon: Plus, run: go("/app/chat?new=1") },
      ...appNav
        .filter((n) => (!n.crm || viewer) && (!n.permission || viewer?.permissions.includes(n.permission)))
        .map((n) => ({
        id: n.href,
        group: "Navigate",
        label: n.label,
        hint: n.description,
        icon: n.icon,
        run: go(n.href),
      })),
      ...template.suggested.slice(0, 4).map((q) => ({
        id: `ask:${q}`,
        group: "Ask Lumora",
        label: q,
        icon: Sparkles,
        run: ask(q),
      })),
      ...(workspace?.conversations.slice(0, 5).map((c) => ({
        id: `conv:${c.id}`,
        group: "Recent chats",
        label: c.title,
        icon: MessageSquare,
        run: go(`/app/chat?c=${c.id}`),
      })) ?? []),
      ...(workspace?.documents.map((d) => ({
        id: `doc:${d.id}`,
        group: "Documents",
        label: d.title,
        hint: d.fileName,
        icon: FileText,
        run: go(`/app/knowledge?doc=${d.id}`),
      })) ?? []),
    ]
  }, [workspace, template, router, onOpenChange, viewer])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    const go = (href: string) => () => {
      onOpenChange(false)
      router.push(href)
    }
    const crm: Command[] =
      hits && hits.q === query.trim()
        ? [
            ...hits.data.contacts.map((c) => ({ id: `con:${c.id}`, group: "Contacts", label: c.name, hint: [c.title, c.company].filter(Boolean).join(" · "), icon: Contact, run: go(`/app/crm/contacts/${c.id}`) })),
            ...hits.data.companies.map((c) => ({ id: `co:${c.id}`, group: "Companies", label: c.name, hint: c.industry ?? c.domain ?? "", icon: Building2, run: go(`/app/crm/companies/${c.id}`) })),
            ...hits.data.deals.map((d) => ({ id: `deal:${d.id}`, group: "Deals", label: d.title, hint: `${stageLabel(d.stage)} · ${money.format(d.value)}`, icon: KanbanSquare, run: go(`/app/crm/deals?deal=${d.id}`) })),
            ...hits.data.tickets.map((t) => ({ id: `tkt:${t.id}`, group: "Tickets", label: `#${t.number} ${t.subject}`, hint: t.status, icon: Inbox, run: go(`/app/crm/inbox?t=${t.id}&status=all`) })),
          ]
        : []
    const matches = [...commands.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q)), ...crm]
    // Any free text can be sent straight to the assistant.
    const askAnything: Command = {
      id: "ask:free",
      group: "Ask Lumora",
      label: `Ask “${query.trim()}”`,
      icon: Sparkles,
      run: () => {
        onOpenChange(false)
        router.push(`/app/chat?new=1&q=${encodeURIComponent(query.trim())}`)
      },
    }
    return [...matches, askAnything]
  }, [commands, query, router, onOpenChange, hits])

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const c of filtered) map.set(c.group, [...(map.get(c.group) ?? []), c])
    return [...map.entries()]
  }, [filtered])

  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setQuery("")
          setActive(0)
        }
      }}
    >
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActive((i) => Math.min(i + 1, filtered.length - 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === "Enter") {
                e.preventDefault()
                filtered[activeIndex]?.run()
              }
            }}
            placeholder={viewer ? "Search contacts, deals, tickets or ask anything…" : "Search or ask anything…"}
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
          {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2" data-lenis-prevent>
          {groups.map(([group, items]) => (
            <div key={group} className="pb-2">
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
              {items.map((c) => {
                const index = filtered.indexOf(c)
                const Icon = c.icon
                return (
                  <button
                    key={c.id}
                    onMouseMove={() => setActive(index)}
                    onClick={c.run}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                      index === activeIndex && "bg-foreground/[0.06]"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c.label}</span>
                    {c.hint && <span className="truncate text-xs text-muted-foreground">{c.hint}</span>}
                    {index === activeIndex && <CornerDownLeft className="ml-auto size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
