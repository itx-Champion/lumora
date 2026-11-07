"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { motion } from "motion/react"
import { LogOut, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { MemberAvatar, RoleBadge } from "@/components/crm/ui"
import { useWorkspace } from "./workspace-provider"
import { isActive, navGroups, type NavItem } from "./nav"
import { WorkspaceSwitcher } from "./workspace-switcher"
import { useViewer } from "./viewer"

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, workspace } = useWorkspace()
  const viewer = useViewer()
  const openActions = workspace?.actions.filter((a) => !a.done).length ?? 0
  const recent = workspace?.conversations.slice(0, 4) ?? []

  const visible = (item: NavItem) => {
    if (item.crm && !viewer) return false
    if (item.permission && !viewer?.permissions.includes(item.permission)) return false
    return true
  }
  const badge = (item: NavItem) => {
    if (item.href === "/app/actions") return openActions
    if (item.href === "/app/crm/inbox") return viewer?.openTickets ?? 0
    if (item.href === "/app/crm/tasks") return viewer?.myTasksDue ?? 0
    return 0
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2 pt-1">
          <Logo />
          {viewer && <span className="truncate rounded-full border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">{viewer.orgName}</span>}
        </div>
        <WorkspaceSwitcher onNavigate={onNavigate} />
      </div>

      <Link
        href="/app/chat?new=1"
        onClick={onNavigate}
        className="group flex items-center gap-2 rounded-xl border bg-background/60 px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:border-violet/40"
      >
        <span className="flex size-5 items-center justify-center rounded-md bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
          <Plus className="size-3.5" />
        </span>
        New chat
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Link>

      <nav className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1" data-lenis-prevent>
        {navGroups.map((group) => {
          const items = group.items.filter(visible)
          if (!items.length) return null
          return (
            <div key={group.label}>
              <p className="px-3 pb-1.5 font-mono text-[10px] tracking-widest text-muted-foreground/80 uppercase">{group.label}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(pathname, item.href)
                  const count = badge(item)
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onNavigate}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-1.5 text-sm transition-colors",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-xl border bg-foreground/[0.05]"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon className={cn("relative size-4", active && "text-violet")} />
                      <span className="relative">{item.label}</span>
                      {count > 0 && (
                        <span className="relative ml-auto rounded-full bg-violet/15 px-1.5 text-xs font-medium text-violet tabular-nums">{count}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {recent.length > 0 && (
          <div>
            <p className="px-3 pb-1.5 font-mono text-[10px] tracking-widest text-muted-foreground/80 uppercase">Recent chats</p>
            <ul className="space-y-0.5">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/chat?c=${c.id}`}
                    onClick={onNavigate}
                    className="block truncate rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    {c.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-2 rounded-2xl border bg-background/50 p-2">
        <Link href="/app/profile" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-0.5 transition-colors hover:bg-foreground/5" title="Your profile">
          {viewer ? (
            <MemberAvatar name={viewer.name} hue={viewer.avatarHue} size="md" />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-sm font-semibold text-white">
              {user.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 text-sm leading-tight">
            <p className="truncate font-medium">{viewer?.name ?? user.name}</p>
            {viewer ? (
              <div className="mt-0.5">
                <RoleBadge role={viewer.role} />
              </div>
            ) : (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
        </Link>
        <ThemeToggle />
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          aria-label="Sign out"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  )
}
