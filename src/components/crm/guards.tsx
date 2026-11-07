import Link from "next/link"
import { unstable_rethrow } from "next/navigation"
import { DatabaseZap, Lock } from "lucide-react"
import { getContext, type CrmContext } from "@/lib/crm/context"
import { can, PERMISSIONS, type Permission } from "@/lib/crm/permissions"
import { roleInfo } from "@/lib/crm/permissions"

export function CrmUnavailable() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-violet/10 text-violet">
        <DatabaseZap className="size-5" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">The CRM database isn&apos;t reachable</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The assistant and knowledge base still work. The CRM needs Postgres: set <code className="font-mono">DATABASE_URL</code>, or run locally where
        Lumora uses an embedded database automatically.
      </p>
      <Link href="/app" className="mt-6 text-sm font-medium text-violet hover:underline">
        Back to overview
      </Link>
    </div>
  )
}

export function NoAccess({ permission, role }: { permission: Permission; role: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-foreground/5">
        <Lock className="size-5 text-muted-foreground" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">You don&apos;t have access to this page</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        “{PERMISSIONS[permission].label}” is available to{" "}
        {PERMISSIONS[permission].roles.map((r) => roleInfo[r].label).join(", ")}. Your role is {role}.
      </p>
    </div>
  )
}

/** Loads the CRM context for a page, or returns the fallback UI to render instead. */
export async function crmPage(permission: Permission = "crm:read"): Promise<{ ok: true; ctx: CrmContext } | { ok: false; fallback: React.ReactNode }> {
  let ctx: CrmContext | null = null
  try {
    ctx = await getContext()
  } catch (error) {
    unstable_rethrow(error)
    console.error("[crm] database unavailable:", error)
  }
  if (!ctx) return { ok: false, fallback: <CrmUnavailable /> }
  if (!can(ctx.member.role, permission)) return { ok: false, fallback: <NoAccess permission={permission} role={roleInfo[ctx.member.role].label} /> }
  return { ok: true, ctx }
}
