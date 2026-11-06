"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Menu, Search } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { WorkspaceProvider, type WorkspaceUser } from "./workspace-provider"
import { Sidebar } from "./sidebar"
import { CommandPalette } from "./command-palette"
import { appNav, isActive } from "./nav"

export function AppShell({ user, children }: { user: WorkspaceUser; children: ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const current = appNav.find((n) => isActive(pathname, n.href))

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
    <WorkspaceProvider user={user}>
      <div className="relative flex h-svh overflow-hidden">
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--brand-violet)_10%,transparent),transparent_55%)]" />

        <aside className="hidden w-[272px] shrink-0 border-r bg-sidebar/60 backdrop-blur-xl lg:block">
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
            <button
              onClick={() => setPaletteOpen(true)}
              className="ml-auto flex h-9 items-center gap-2 rounded-xl border bg-background/60 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:w-64"
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search or ask…</span>
              <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
                Ctrl K
              </kbd>
            </button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
            {children}
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </WorkspaceProvider>
  )
}
