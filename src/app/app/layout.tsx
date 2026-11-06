import { Suspense } from "react"
import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { auth } from "@/auth"
import { AppShell } from "@/components/app/app-shell"
import { LogoMark } from "@/components/shared/logo"

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false },
}

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.email) redirect("/login")
  const { name, email, image } = session.user

  return (
    <AppShell user={{ id: email, email, name: name ?? email.split("@")[0], image }}>{children}</AppShell>
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
