import type { Metadata } from "next"
import { Workflow } from "lucide-react"
import { AutomationCard, NewAutomationButton } from "@/components/crm/automation-builder"
import { crmPage } from "@/components/crm/guards"
import { EmptyState, PageHeader, StatTile } from "@/components/crm/ui"
import { listAutomations, listMembers } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Automations" }

export default async function AutomationsPage() {
  const page = await crmPage("automations:manage")
  if (!page.ok) return page.fallback
  const { ctx } = page
  const [automations, members] = await Promise.all([listAutomations(ctx), listMembers(ctx)])
  const runs = automations.reduce((n, a) => n + a.runCount, 0)

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Automations"
        description="No-code rules that route tickets, assign leads and create follow-ups the moment something happens."
        actions={<NewAutomationButton members={members} />}
      />
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Active rules" value={automations.filter((a) => a.enabled).length} hint={`${automations.length} total`} />
        <StatTile label="Total runs" value={runs.toLocaleString()} tone="cyan" />
        <StatTile label="Hours saved (est.)" value={Math.round((runs * 3) / 60)} hint="~3 minutes of manual triage per run" tone="emerald" />
      </div>
      {automations.length === 0 ? (
        <EmptyState icon={Workflow} title="No automations yet" description="Create your first rule, for example: urgent tickets go to the support lead." />
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <AutomationCard key={a.id} automation={a} members={members} />
          ))}
        </ul>
      )}
    </div>
  )
}
