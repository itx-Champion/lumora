import type { Metadata } from "next"
import { Check, Minus } from "lucide-react"
import { crmPage } from "@/components/crm/guards"
import { TeamTable } from "@/components/crm/team-table"
import { PageHeader, Panel, RoleBadge } from "@/components/crm/ui"
import { can, PERMISSIONS, roleInfo, ROLES, type Permission } from "@/lib/crm/permissions"
import { getTeamOverview } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Team" }

export default async function TeamPage() {
  const page = await crmPage("members:manage")
  if (!page.ok) return page.fallback
  const { ctx } = page
  const members = await getTeamOverview(ctx)

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Team & access"
        description="Invite people, set roles, suspend access and view the app exactly as any teammate sees it. Every change lands in the audit log."
      />
      <TeamTable members={members} seats={ctx.org.settings.seats} />

      <Panel title="Roles & permissions" action={<span className="text-xs text-muted-foreground">Enforced on the server for every request, API call and AI tool</span>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-3 pl-5 text-left text-xs font-medium text-muted-foreground">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-3 text-center">
                    <RoleBadge role={r} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
                <tr key={p} className="border-b last:border-0">
                  <td className="py-2.5 pl-5">
                    <span className="block">{PERMISSIONS[p].label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{p}</span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {can(r, p) ? <Check className="mx-auto size-4 text-emerald-500" aria-label="Allowed" /> : <Minus className="mx-auto size-4 text-muted-foreground/40" aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t p-5 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((r) => (
            <div key={r}>
              <RoleBadge role={r} />
              <p className="mt-1.5 text-xs text-muted-foreground">{roleInfo[r].description}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
