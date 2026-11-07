"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { NotificationPrefs, OrgSettings } from "@/db/schema"
import { resetDemoData, updateOrganization, updateProfile } from "@/lib/crm/actions/admin"
import { cn } from "@/lib/utils"
import { dangerButton, PendingButton, primaryButton, useAction } from "./client"
import { FieldLabel, inputClass, MemberAvatar, selectClass, textareaClass } from "./ui"

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-4 border-b py-6 first:pt-0 last:border-0 last:pb-0 md:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-background/50 p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </label>
  )
}

export function OrgSettingsForm({ name, settings, canReset }: { name: string; settings: OrgSettings; canReset: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({ name, ...settings })
  const { pending, exec } = useAction()
  const reset = useAction()
  const dirty = JSON.stringify(form) !== JSON.stringify({ name, ...settings })

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void exec(() => updateOrganization(form), { success: "Organization settings saved" })
        }}
        className="rounded-2xl border bg-card/60 p-5 shadow-sm"
      >
        <Row title="Organization" description="Shown in the sidebar, emails and the AI agent's instructions.">
          <FieldLabel label="Name">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </FieldLabel>
        </Row>
        <Row title="Support SLAs" description="Hours until the first reply is due. Signals, the inbox and reports use these targets.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["urgent", "high", "normal", "low"] as const).map((p) => (
              <FieldLabel key={p} label={p[0].toUpperCase() + p.slice(1)}>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={form.slaHours[p]}
                    onChange={(e) => setForm({ ...form, slaHours: { ...form.slaHours, [p]: Number(e.target.value) } })}
                    className={cn(inputClass, "pr-7")}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">h</span>
                </div>
              </FieldLabel>
            ))}
          </div>
        </Row>
        <Row title="AI & routing" description="What happens automatically when a new ticket arrives from any channel.">
          <div className="space-y-2">
            <Toggle label="AI triage" description="Classify priority, team and tags from the message, and leave an internal note." checked={form.autoTriage} onChange={(v) => setForm({ ...form, autoTriage: v })} />
            <Toggle label="Auto-assign" description="If no automation assigned the ticket, round-robin it to the least-loaded teammate." checked={form.autoAssign} onChange={(v) => setForm({ ...form, autoAssign: v })} />
          </div>
        </Row>
        <Row title="Seats" description="Maximum active and invited members. Invites are blocked when the limit is reached.">
          <FieldLabel label="Seat limit">
            <input type="number" min={1} max={100} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} className={cn(inputClass, "w-32")} />
          </FieldLabel>
        </Row>
        <div className="mt-6 flex justify-end gap-2">
          {dirty && (
            <button type="button" onClick={() => setForm({ name, ...settings })} className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-foreground/5">
              Discard
            </button>
          )}
          <PendingButton type="submit" pending={pending} disabled={!dirty} className={primaryButton}>
            Save settings
          </PendingButton>
        </div>
      </form>

      {canReset && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-5">
          <p className="font-medium text-destructive">Reset demo data</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Deletes every contact, deal, ticket, task, automation, API key and teammate in this sandbox and restores the original sample data. You stay the owner.
          </p>
          <PendingButton
            pending={reset.pending}
            onClick={async () => {
              if (!confirm("Reset all CRM data in this sandbox? This can't be undone.")) return
              const ok = await reset.exec(() => resetDemoData(), { success: "Sandbox restored to fresh sample data" })
              if (ok !== null) router.push("/app/crm")
            }}
            className={cn(dangerButton, "mt-4")}
          >
            <RotateCcw className="size-4" /> Reset sandbox
          </PendingButton>
        </div>
      )}
    </div>
  )
}

const TIMEZONES = ["UTC", "Asia/Karachi", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Australia/Sydney"]

export function ProfileForm({
  profile,
  readOnly,
}: {
  profile: { name: string; title: string | null; timezone: string; avatarHue: number; signature: string | null; prefs: NotificationPrefs; email: string }
  readOnly: boolean
}) {
  const [form, setForm] = useState({ ...profile, title: profile.title ?? "", signature: profile.signature ?? "" })
  const { pending, exec } = useAction()
  const prefs: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    { key: "assignments", label: "Assignments", description: "A ticket, task or lead is assigned to you." },
    { key: "mentions", label: "Mentions", description: "Someone mentions you in an internal note." },
    { key: "slaAlerts", label: "SLA alerts", description: "Your tickets are about to breach their SLA." },
    { key: "weeklyDigest", label: "Weekly digest", description: "A Monday summary of your pipeline and queue." },
  ]
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void exec(() => updateProfile({ name: form.name, title: form.title, timezone: form.timezone, avatarHue: form.avatarHue, signature: form.signature, prefs: form.prefs }), {
          success: "Profile saved",
        })
      }}
      className="rounded-2xl border bg-card/60 p-5 shadow-sm"
    >
      <fieldset disabled={readOnly} className="contents">
        <Row title="Personal details" description="How teammates and customers see you.">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <MemberAvatar name={form.name || "?"} hue={form.avatarHue} size="xl" />
              <FieldLabel label="Avatar colour">
                <input type="range" min={0} max={359} value={form.avatarHue} onChange={(e) => setForm({ ...form, avatarHue: Number(e.target.value) })} className="w-48 accent-violet-500" />
              </FieldLabel>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Full name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} className={inputClass} />
              </FieldLabel>
              <FieldLabel label="Job title">
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} placeholder="Customer Success Lead" />
              </FieldLabel>
              <FieldLabel label="Email" hint="Managed by your sign-in provider">
                <input value={form.email} disabled className={inputClass} />
              </FieldLabel>
              <FieldLabel label="Timezone">
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className={selectClass}>
                  {[...new Set([form.timezone, ...TIMEZONES])].map((tz) => (
                    <option key={tz}>{tz}</option>
                  ))}
                </select>
              </FieldLabel>
            </div>
          </div>
        </Row>
        <Row title="Email signature" description="Added to replies you send and to emails the AI agent drafts for you.">
          <textarea value={form.signature} onChange={(e) => setForm({ ...form, signature: e.target.value })} rows={3} maxLength={400} className={textareaClass} placeholder={`${form.name}\nKitelane`} />
        </Row>
        <Row title="Notifications" description="Choose what shows up in your notification center.">
          <div className="space-y-2">
            {prefs.map((p) => (
              <Toggle key={p.key} label={p.label} description={p.description} checked={form.prefs[p.key]} onChange={(v) => setForm({ ...form, prefs: { ...form.prefs, [p.key]: v } })} />
            ))}
          </div>
        </Row>
      </fieldset>
      {!readOnly && (
        <div className="mt-6 flex justify-end">
          <PendingButton type="submit" pending={pending} className={primaryButton}>
            Save profile
          </PendingButton>
        </div>
      )}
    </form>
  )
}
