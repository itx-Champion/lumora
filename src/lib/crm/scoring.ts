import type { Lifecycle, OrgSettings, TicketPriority } from "@/db/schema"

const DAY = 86_400_000

export type LeadSignals = {
  title?: string | null
  source: string
  lifecycle: Lifecycle
  companySize?: string | null
  activities30d: number
  meetings30d: number
  openDealValue: number
  daysSinceActivity: number | null
}

/**
 * Explainable lead score (0–100). Every point comes with a reason, so reps can see
 * *why* a lead is hot instead of trusting a black-box number.
 */
export function leadScore(s: LeadSignals): { score: number; reasons: string[] } {
  const parts: { points: number; reason: string }[] = []
  const add = (points: number, reason: string) => {
    if (points) parts.push({ points, reason })
  }

  const title = s.title ?? ""
  if (/\b(chief|ceo|cto|cfo|coo|cio|founder|vp|vice president|head of|director)\b/i.test(title)) add(20, "Decision-maker title")
  else if (/\b(manager|lead|principal)\b/i.test(title)) add(10, "Manager-level title")

  const sizePoints: Record<string, number> = { "1000+": 15, "201-1000": 12, "51-200": 8, "11-50": 4 }
  if (s.companySize && sizePoints[s.companySize]) add(sizePoints[s.companySize], `${s.companySize} employee company`)

  const sourcePoints: Record<string, number> = { referral: 12, event: 8, chat: 6, website: 5, api: 4, import: 2, outbound: 2 }
  const sourceReason: Record<string, string> = {
    referral: "Came from a referral",
    event: "Met at an event",
    chat: "Started in live chat",
  }
  add(sourcePoints[s.source] ?? 0, sourceReason[s.source] ?? `Source: ${s.source}`)

  if (s.activities30d > 0) {
    add(Math.min(20, s.activities30d * 4), `${s.activities30d} touchpoint${s.activities30d === 1 ? "" : "s"} in 30 days`)
  }
  if (s.meetings30d > 0) add(10, "Met in the last 30 days")

  if (s.openDealValue >= 50_000) add(15, "Open deal over $50k")
  else if (s.openDealValue >= 10_000) add(10, "Open deal over $10k")
  else if (s.openDealValue > 0) add(5, "Has an open deal")

  if (s.lifecycle === "customer") add(5, "Existing customer")
  if (s.lifecycle === "churned") add(-20, "Churned customer")

  if (s.daysSinceActivity !== null && s.daysSinceActivity > 30) add(-15, `No activity in ${s.daysSinceActivity} days`)
  else if (s.daysSinceActivity !== null && s.daysSinceActivity > 14) add(-5, `Quiet for ${s.daysSinceActivity} days`)

  const score = Math.max(0, Math.min(100, parts.reduce((n, p) => n + p.points, 0)))
  const reasons = parts
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .map((p) => `${p.points > 0 ? "+" : "−"}${Math.abs(p.points)} ${p.reason}`)
  return { score, reasons: reasons.slice(0, 5) }
}

export function scoreBand(score: number) {
  if (score >= 75) return { label: "Hot", className: "text-red-500" }
  if (score >= 50) return { label: "Warm", className: "text-amber-500" }
  return { label: "Cold", className: "text-sky-500" }
}

export type HealthSignals = {
  openTickets: number
  urgentOpenTickets: number
  avgCsat: number | null
  wonDeals90d: number
  daysSinceActivity: number | null
}

/** Account health (0–100): support load, satisfaction, momentum and engagement. */
export function accountHealth(s: HealthSignals) {
  let score = 80
  score -= s.urgentOpenTickets * 12
  score -= Math.max(0, s.openTickets - s.urgentOpenTickets) * 4
  if (s.avgCsat !== null) score += Math.round((s.avgCsat - 3.5) * 10)
  if (s.wonDeals90d > 0) score += 10
  if (s.daysSinceActivity === null || s.daysSinceActivity > 30) score -= 15
  return Math.max(0, Math.min(100, score))
}

export function healthBand(score: number) {
  if (score >= 70) return { label: "Healthy", className: "text-emerald-600 dark:text-emerald-300", bar: "bg-emerald-500" }
  if (score >= 45) return { label: "Watch", className: "text-amber-600 dark:text-amber-300", bar: "bg-amber-500" }
  return { label: "At risk", className: "text-red-600 dark:text-red-300", bar: "bg-red-500" }
}

export const DEFAULT_SETTINGS: OrgSettings = {
  slaHours: { urgent: 2, high: 8, normal: 24, low: 72 },
  autoTriage: true,
  autoAssign: true,
  seats: 12,
}

export function slaDueAt(createdAt: Date, priority: TicketPriority, settings: OrgSettings = DEFAULT_SETTINGS) {
  return new Date(createdAt.getTime() + settings.slaHours[priority] * 3_600_000)
}

export type SlaState = "met" | "missed" | "breached" | "at_risk" | "on_track" | "none"

/** First-response SLA state for a ticket at time `now`. */
export function slaState(
  t: { createdAt: Date; dueAt: Date | null; firstResponseAt: Date | null; status: string },
  now: number
): SlaState {
  if (!t.dueAt) return "none"
  const due = t.dueAt.getTime()
  if (t.firstResponseAt) return t.firstResponseAt.getTime() <= due ? "met" : "missed"
  if (t.status === "resolved" || t.status === "closed") return "none"
  if (now > due) return "breached"
  const total = due - t.createdAt.getTime()
  return due - now < total * 0.25 ? "at_risk" : "on_track"
}

export function daysBetween(from: Date | null | undefined, now: number) {
  return from ? Math.floor((now - from.getTime()) / DAY) : null
}

/** Rule-based triage, used when no model is available and as a hint for the model. */
export function triageTicket(text: string): { priority: TicketPriority; team: string; tags: string[] } {
  const t = text.toLowerCase()
  const tags = new Set<string>()
  let team = "Support"
  if (/refund|invoice|billing|charge|payment|card|receipt/.test(t)) tags.add("billing")
  if (/api|webhook|integration|sdk|error|bug|500|crash|outage|down/.test(t)) {
    team = "Engineering"
    tags.add("technical")
  }
  if (/sso|saml|2fa|two-factor|password|login|locked/.test(t)) tags.add("access")
  if (/upgrade|pricing|quote|seats|enterprise|demo/.test(t)) {
    team = "Sales"
    tags.add("expansion")
  }
  if (/cancel|churn|leaving|competitor/.test(t)) tags.add("churn-risk")
  if (/gdpr|dpa|security|breach|data (request|deletion)/.test(t)) tags.add("compliance")

  // Requests and questions are low priority even if they mention words like "urgent".
  let priority: TicketPriority = "normal"
  if (/feature request|suggestion|would be (great|nice)|wondering|how do i|question:/.test(t)) priority = "low"
  else if (/outage|is down|sync is down|breach|urgent|asap|critical|can.?t log ?in|cannot log ?in|locked out|data loss/.test(t)) priority = "urgent"
  else if (/error|failed|failing|broken|not working|refund|cancel|charged twice/.test(t)) priority = "high"
  return { priority, team, tags: [...tags] }
}
