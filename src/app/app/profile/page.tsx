import type { Metadata } from "next"
import { Check, ShieldCheck } from "lucide-react"
import { crmPage } from "@/components/crm/guards"
import { ProfileForm } from "@/components/crm/settings-forms"
import { PageHeader, Panel, RoleBadge } from "@/components/crm/ui"
import { PERMISSIONS, permissionsFor, roleInfo } from "@/lib/crm/permissions"

export const metadata: Metadata = { title: "Your profile" }

export default async function ProfilePage() {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const m = ctx.member

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader title="Your profile" description={ctx.impersonating ? `You're viewing ${m.name}'s profile as an admin. Editing is disabled.` : "Personal details, email signature and notifications."} />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <ProfileForm
          readOnly={ctx.impersonating}
          profile={{ name: m.name, title: m.title, timezone: m.timezone, avatarHue: m.avatarHue, signature: m.signature, prefs: m.prefs, email: m.email }}
        />
        <div className="space-y-6">
          <Panel title="Role & access">
            <div className="flex items-center gap-2">
              <RoleBadge role={m.role} />
              <span className="text-sm text-muted-foreground">in {ctx.org.name}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{roleInfo[m.role].description}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {permissionsFor(m.role).map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <Check className="size-3.5 text-emerald-500" /> {PERMISSIONS[p].label}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><ShieldCheck className="size-4 text-emerald-500" /> Security</span>}>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Signed in with {m.userId?.startsWith("demo:") ? "a private demo sandbox" : "your account"} ({m.email})</li>
              <li>Sessions are signed, HTTP-only cookies that expire after 14 days.</li>
              <li>Every change you make is recorded in the organization&apos;s audit log.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
