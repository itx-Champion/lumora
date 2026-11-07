import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import type { Lifecycle, MemberRole, TicketPriority, TicketStatus } from "@/db/schema"
import { LIFECYCLES, PRIORITIES, TICKET_STATUSES } from "@/lib/crm/constants"
import { roleInfo } from "@/lib/crm/permissions"
import { healthBand, scoreBand, type SlaState } from "@/lib/crm/scoring"
import { cn } from "@/lib/utils"

export const inputClass =
  "h-9 w-full rounded-lg border bg-background/60 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet/50 focus:ring-3 focus:ring-violet/15 disabled:opacity-60"
export const textareaClass =
  "w-full rounded-lg border bg-background/60 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-violet/50 focus:ring-3 focus:ring-violet/15"
export const selectClass =
  "h-9 w-full appearance-none rounded-lg border bg-background/60 bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat pr-8 pl-3 text-sm outline-none transition-colors focus:border-violet/50 focus:ring-3 focus:ring-violet/15 disabled:opacity-60 [background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]"

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{eyebrow}</p>}
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ title, action, children, className, bodyClassName }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card/60 shadow-sm backdrop-blur-sm", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function StatTile({ label, value, hint, icon: Icon, tone = "violet" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: "violet" | "cyan" | "emerald" | "amber" }) {
  const tones = {
    violet: "from-violet/20 text-violet",
    cyan: "from-cyan/20 text-cyan",
    emerald: "from-emerald-500/20 text-emerald-500",
    amber: "from-amber-500/20 text-amber-500",
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card/60 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex size-7 items-center justify-center rounded-lg bg-gradient-to-br to-transparent", tones[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-violet/10 text-violet">
        <Icon className="size-5" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap", className)}>{children}</span>
}

export function LifecycleBadge({ value }: { value: Lifecycle }) {
  const l = LIFECYCLES.find((x) => x.id === value)!
  return <Pill className={l.className}>{l.label}</Pill>
}

export function StatusBadge({ value }: { value: TicketStatus }) {
  const l = TICKET_STATUSES.find((x) => x.id === value)!
  return <Pill className={l.className}>{l.label}</Pill>
}

export function PriorityBadge({ value }: { value: TicketPriority }) {
  const l = PRIORITIES.find((x) => x.id === value)!
  return (
    <Pill className={l.className}>
      <span className="size-1.5 rounded-full bg-current" />
      {l.label}
    </Pill>
  )
}

const roleTone: Record<MemberRole, string> = {
  owner: "bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white",
  admin: "bg-violet/15 text-violet",
  manager: "bg-cyan/15 text-cyan",
  agent: "bg-foreground/8 text-foreground/80",
  viewer: "bg-foreground/5 text-muted-foreground",
}

export function RoleBadge({ role }: { role: MemberRole }) {
  return <Pill className={roleTone[role]}>{roleInfo[role].label}</Pill>
}

export function SlaBadge({ state, label }: { state: SlaState; label?: string }) {
  if (state === "none") return null
  const map: Record<Exclude<SlaState, "none">, [string, string]> = {
    breached: ["SLA breached", "bg-red-500/12 text-red-600 dark:text-red-300"],
    at_risk: ["SLA at risk", "bg-amber-500/12 text-amber-600 dark:text-amber-300"],
    on_track: ["On track", "bg-foreground/6 text-muted-foreground"],
    met: ["SLA met", "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"],
    missed: ["SLA missed", "bg-red-500/10 text-red-500/80"],
  }
  const [text, cls] = map[state]
  return <Pill className={cls}>{label ?? text}</Pill>
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function MemberAvatar({ name, hue, size = "md", className }: { name: string; hue?: number | null; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { xs: "size-5 text-[9px]", sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-16 text-lg" }
  const h = hue ?? 280
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-background", sizes[size], className)}
      style={{ background: `linear-gradient(135deg, oklch(0.62 0.17 ${h}), oklch(0.7 0.13 ${(h + 50) % 360}))` }}
    >
      {initials(name)}
    </span>
  )
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const band = scoreBand(score)
  const pct = Math.max(4, score)
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={`${band.label} lead · score ${score}/100`}>
      <span className="relative size-7">
        <svg viewBox="0 0 36 36" className="size-7 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth="4" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 94.2} 94.2`} className={band.className} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">{score}</span>
      </span>
    </span>
  )
}

export function HealthBar({ value }: { value: number }) {
  const band = healthBand(value)
  return (
    <span className="inline-flex min-w-28 items-center gap-2" title={`Health ${value}/100 · ${band.label}`}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
        <span className={cn("block h-full rounded-full", band.bar)} style={{ width: `${value}%` }} />
      </span>
      <span className={cn("w-12 text-xs font-medium tabular-nums", band.className)}>{value}</span>
    </span>
  )
}

export function FieldLabel({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" })
export const dateTimeFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
