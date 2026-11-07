import type { Metadata } from "next"
import { Download } from "lucide-react"
import { crmPage } from "@/components/crm/guards"
import { OrgSettingsForm } from "@/components/crm/settings-forms"
import { PageHeader, Panel, Pill } from "@/components/crm/ui"
import { getUsage } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Organization" }

export default async function OrganizationPage() {
  const page = await crmPage("org:manage")
  if (!page.ok) return page.fallback
  const { ctx } = page
  const usage = await getUsage(ctx)
  const meters = [
    { label: "Seats", value: usage.seats, max: ctx.org.settings.seats },
    { label: "Contacts", value: usage.contacts, max: 5000 },
    { label: "Tickets (30 days)", value: usage.tickets30d, max: 2000 },
    { label: "AI actions", value: usage.aiActions, max: 1000 },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Organization" description="SLAs, AI routing, seats and data controls for everyone in this workspace." />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <OrgSettingsForm name={ctx.org.name} settings={ctx.org.settings} canReset={ctx.org.isSandbox} />
        <div className="space-y-6">
          <Panel title="Plan & usage" action={<Pill className="bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white capitalize">{ctx.org.plan}</Pill>}>
            <ul className="space-y-4">
              {meters.map((m) => (
                <li key={m.label}>
                  <div className="flex justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {m.value.toLocaleString()} / {m.max.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/8">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-violet),var(--brand-cyan))]" style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">{usage.automationRuns.toLocaleString()} automation runs so far.</p>
          </Panel>
          <Panel title="Your data">
            <p className="text-sm text-muted-foreground">Export everything as CSV, any time. Exports are scoped to this organization.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["contacts", "Contacts"],
                ["deals", "Deals"],
                ["tickets", "Tickets"],
                ["audit", "Audit log"],
              ].map(([type, label]) => (
                <a key={type} href={`/api/crm/export?type=${type}`} className="flex items-center gap-2 rounded-xl border bg-background/60 px-3 py-2 text-sm hover:bg-foreground/5">
                  <Download className="size-4 text-muted-foreground" /> {label}
                </a>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
