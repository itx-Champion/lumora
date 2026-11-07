"use client"

import { useEffect, useState, useTransition, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Eye, Loader2, Menu, Search } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { stopViewAs } from "@/lib/crm/actions/admin"
import { roleInfo } from "@/lib/crm/permissions"
import { WorkspaceProvider, type WorkspaceUser } from "./workspace-provider"
import { Sidebar } from "./sidebar"
import { CommandPalette } from "./command-palette"
import { currentNav } from "./nav"
import { NotificationBell } from "./notification-bell"
import { ViewerProvider, type Viewer } from "./viewer"

function ImpersonationBanner({ viewer }: { viewer: Viewer }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 bg-[linear-gradient(90deg,var(--brand-violet),color-mix(in_oklch,var(--brand-violet),var(--brand-cyan)_60%))] px-4 py-2 text-sm text-white">
      <Eye className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        Viewing as <strong>{viewer.name}</strong> ({roleInfo[viewer.role].label}). You see exactly what they can see and do. Changes are logged as {viewer.name}, with you
        noted as the admin.
      </p>
      <button
        onClick={() =>
          start(async () => {
            const result = await stopViewAs()
            if (result.ok) {
              toast.success(`Back to your own account, ${viewer.realName.split(" ")[0]}`)
              router.push("/app/admin/team")
              router.refresh()
            }
          })
        }
        className="flex h-7 items-center gap-1.5 rounded-lg bg-white/15 px-3 text-xs font-medium backdrop-blur hover:bg-white/25"
      >
        {pending && <Loader2 className="size-3 animate-spin" />}
        Stop viewing
      </button>
    </div>
  )
}

export function AppShell({ user, viewer, children }: { user: WorkspaceUser; viewer: Viewer | null; children: ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const current = currentNav(pathname)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <ViewerProvider viewer={viewer}>
      <WorkspaceProvider user={user}>
        <div className="relative flex h-svh flex-col overflow-hidden">
          {viewer?.impersonating && <ImpersonationBanner viewer={viewer} />}
          <div className="relative flex min-h-0 flex-1">
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--brand-violet)_10%,transparent),transparent_55%)]" />

            <aside className="hidden w-[264px] shrink-0 border-r bg-sidebar/60 backdrop-blur-xl lg:block">
              <Sidebar />
            </aside>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="w-[290px] p-0" showCloseButton={false}>
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
                <button
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation"
                  className="flex size-9 items-center justify-center rounded-lg hover:bg-foreground/5 lg:hidden"
                >
                  <Menu className="size-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="truncate text-base font-semibold tracking-tight">{current?.label ?? "Lumora"}</h1>
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">{current?.description}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setPaletteOpen(true)}
                    className="flex h-9 items-center gap-2 rounded-xl border bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:w-72"
                  >
                    <Search className="size-4" />
                    <span className="hidden sm:inline">Search CRM or ask…</span>
                    <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
                  </button>
                  {viewer && <NotificationBell key={viewer.memberId} initialUnread={viewer.unread} />}
                </div>
              </header>
              <main className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
                {children}
              </main>
            </div>

            <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          </div>
        </div>
      </WorkspaceProvider>
    </ViewerProvider>
  )
}
