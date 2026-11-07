"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Bell, BellRing, CheckCheck, Inbox, KanbanSquare, Sparkles, Users, Workflow } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { RelativeTime } from "@/components/crm/client"
import type { Notification } from "@/db/schema"
import { markNotificationsRead, pollNotifications } from "@/lib/crm/actions/admin"
import { cn } from "@/lib/utils"

const icons: Record<string, typeof Bell> = {
  sla: BellRing,
  assignment: Inbox,
  deal: KanbanSquare,
  lead: Sparkles,
  automation: Workflow,
  member: Users,
}

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Notification[] | null>(null)
  const [unread, setUnread] = useState(initialUnread)
  const [, start] = useTransition()

  const refresh = useCallback(async () => {
    const result = await pollNotifications()
    if (result.ok) {
      setRows(result.data.rows)
      setUnread(result.data.unread)
    }
  }, [])

  // Poll while the tab is visible so new assignments show up without a reload.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh()
    const id = setInterval(tick, 45_000)
    return () => clearInterval(id)
  }, [refresh])

  const markAll = () =>
    start(async () => {
      setRows((r) => r?.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) ?? r)
      setUnread(0)
      await markNotificationsRead()
    })

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) void refresh()
      }}
    >
      <DropdownMenuTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex size-9 items-center justify-center rounded-xl border bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <button onClick={markAll} disabled={!unread} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-1.5" data-lenis-prevent>
          {rows === null ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            rows.map((n) => {
              const Icon = icons[n.kind] ?? Bell
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    setOpen(false)
                    if (!n.readAt) {
                      setUnread((u) => Math.max(0, u - 1))
                      setRows((r) => r?.map((x) => (x.id === n.id ? { ...x, readAt: new Date() } : x)) ?? r)
                      void markNotificationsRead([n.id])
                    }
                    if (n.href) router.push(n.href)
                  }}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-foreground/5"
                >
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg", n.readAt ? "bg-foreground/5 text-muted-foreground" : "bg-violet/12 text-violet")}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", !n.readAt && "font-medium")}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span>}
                    <RelativeTime date={n.createdAt} className="mt-0.5 block text-[11px] text-muted-foreground" />
                  </span>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-violet" />}
                </button>
              )
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
