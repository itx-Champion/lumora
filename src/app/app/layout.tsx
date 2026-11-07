import { Suspense } from "react"
import { redirect, unstable_rethrow } from "next/navigation"
import type { Metadata } from "next"
import { and, count, eq, inArray, isNull, lte } from "drizzle-orm"
import { auth } from "@/auth"
import * as s from "@/db/schema"
import { AppShell } from "@/components/app/app-shell"
import type { Viewer } from "@/components/app/viewer"
import { LogoMark } from "@/components/shared/logo"
import { getContext } from "@/lib/crm/context"
import { permissionsFor } from "@/lib/crm/permissions"

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false },
}

/** CRM identity and badge counts. Returns null if the database is unreachable, so the rest of the app still works. */
async function loadViewer(): Promise<Viewer | null> {
  try {
    const ctx = await getContext()
    if (!ctx) return null
    const { db, org, member } = ctx
    const endOfToday = new Date(new Date().setHours(23, 59, 59, 999))
    const [[unread], [open], [due]] = await Promise.all([
      db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.memberId, member.id), isNull(s.notifications.readAt))),
      db.select({ n: count() }).from(s.tickets).where(and(eq(s.tickets.orgId, org.id), inArray(s.tickets.status, ["open"]))),
      db
        .select({ n: count() })
        .from(s.tasks)
        .where(and(eq(s.tasks.orgId, org.id), eq(s.tasks.assigneeId, member.id), eq(s.tasks.done, false), lte(s.tasks.dueAt, endOfToday))),
    ])
    return {
      memberId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      title: member.title,
      avatarHue: member.avatarHue,
      orgName: org.name,
      permissions: permissionsFor(member.role),
      impersonating: ctx.impersonating,
      realName: ctx.realMember.name,
      unread: unread.n,
      openTickets: open.n,
      myTasksDue: due.n,
    }
  } catch (error) {
    // Let Next.js handle its own control-flow signals (prerender bailouts, redirects).
    unstable_rethrow(error)
    console.error("[crm] database unavailable:", error)
    return null
  }
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const { name, email, image } = session.user
  const viewer = await loadViewer()

  return (
    <AppShell user={{ id: email, email, name: name ?? email.split("@")[0], image }} viewer={viewer}>
      {children}
    </AppShell>
  )
}

function ShellFallback() {
  return (
    <div className="flex h-svh items-center justify-center">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  )
}

export default function WorkspaceLayout({ children }: LayoutProps<"/app">) {
  // The session is request-time data, so it streams in behind a Suspense boundary.
  return (
    <Suspense fallback={<ShellFallback />}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  )
}
