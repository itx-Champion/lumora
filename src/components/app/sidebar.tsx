"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { motion } from "motion/react"
import { LogOut, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { useWorkspace } from "./workspace-provider"
import { appNav, isActive } from "./nav"

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { user, workspace } = useWorkspace()
  const openActions = workspace?.actions.filter((a) => !a.done).length ?? 0
  const recent = workspace?.conversations.slice(0, 6) ?? []

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo />
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
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </Link>

      <nav className="space-y-0.5">
        {appNav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
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
              <span className="relative">{label}</span>
              {label === "Actions" && openActions > 0 && (
                <span className="relative ml-auto rounded-full bg-violet/15 px-1.5 text-xs font-medium text-violet">
                  {openActions}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {recent.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">Recent chats</p>
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

      <div className="mt-auto flex items-center gap-3 rounded-2xl border bg-background/50 p-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-sm font-semibold text-white">
          {user.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1 text-sm leading-tight">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
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
