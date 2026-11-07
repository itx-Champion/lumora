"use client"

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useNow } from "@/hooks/use-now"
import type { ActionResult } from "@/lib/crm/actions/run"
import { cn } from "@/lib/utils"
import { inputClass, selectClass } from "./ui"

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" })
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })

export function relative(date: Date | string | number, now: number) {
  const diff = new Date(date).getTime() - now
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ]
  for (const [unit, ms] of units) if (abs >= ms) return rtf.format(Math.round(diff / ms), unit)
  return "just now"
}

/** "5 min ago" that keeps itself current. */
export function RelativeTime({ date, className }: { date: Date | string | number | null | undefined; className?: string }) {
  const now = useNow()
  if (!date) return <span className={className}>—</span>
  const d = new Date(date)
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString("en")} className={className} suppressHydrationWarning>
      {/* The server snapshot has no clock; show a stable date until the client takes over. */}
      {now ? relative(d, now) : shortDate.format(d)}
    </time>
  )
}

/** Updates one search param, resetting pagination, without a full reload. */
export function useSearchParam(key: string) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const set = (value: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== "page") next.delete("page")
    start(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }))
  }
  return { value: params.get(key) ?? "", set, pending }
}

export function UrlSearch({ placeholder, className }: { placeholder: string; className?: string }) {
  const { value, set, pending } = useSearchParam("q")
  const [text, setText] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          clearTimeout(timer.current)
          timer.current = setTimeout(() => set(e.target.value.trim() || null), 300)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(inputClass, "pl-9")}
      />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-3 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        text && (
          <button
            onClick={() => {
              setText("")
              set(null)
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  )
}

export function UrlSelect({ param, options, label, className }: { param: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const { value, set } = useSearchParam(param)
  return (
    <select aria-label={label} value={value} onChange={(e) => set(e.target.value || null)} className={cn(selectClass, "w-auto min-w-36", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function UrlTabs({ param, tabs, className }: { param: string; tabs: { value: string; label: string; count?: number }[]; className?: string }) {
  const { value, set } = useSearchParam(param)
  const current = value || tabs[0]?.value
  return (
    <div role="tablist" className={cn("inline-flex rounded-xl border bg-background/50 p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={current === t.value}
          onClick={() => set(t.value === tabs[0]?.value ? null : t.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
            current === t.value ? "bg-foreground/[0.07] font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] tabular-nums">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * Runs a server action with a pending state and toasts the outcome.
 * Returns the data on success so callers can close dialogs or navigate.
 */
export function useAction() {
  const [pending, start] = useTransition()
  const exec = <T,>(fn: () => Promise<ActionResult<T>>, messages: { success?: string | ((data: T) => string); error?: string } = {}) =>
    new Promise<T | null>((resolve) => {
      start(async () => {
        const result = await fn()
        if (result.ok) {
          const msg = typeof messages.success === "function" ? messages.success(result.data) : messages.success
          if (msg) toast.success(msg)
          resolve(result.data)
        } else {
          toast.error(messages.error ?? result.error, messages.error ? { description: result.error } : undefined)
          resolve(null)
        }
      })
    })
  return { pending, exec }
}

export function PendingButton({ pending, children, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; children: ReactNode }) {
  return (
    <button {...props} disabled={pending || props.disabled} className={cn("inline-flex items-center justify-center gap-1.5 disabled:opacity-60", className)}>
      {pending && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  )
}

export const primaryButton =
  "h-9 rounded-lg bg-[linear-gradient(135deg,var(--brand-violet),color-mix(in_oklch,var(--brand-violet),var(--brand-cyan)_45%))] px-3.5 text-sm font-medium text-white shadow-sm shadow-violet/20 transition-[filter] hover:brightness-110"
export const secondaryButton = "h-9 rounded-lg border bg-background/60 px-3.5 text-sm font-medium transition-colors hover:bg-foreground/5"
export const ghostButton = "h-8 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
export const dangerButton = "h-9 rounded-lg bg-destructive/10 px-3.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
