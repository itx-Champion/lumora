import type { DealStage, Lifecycle, TicketPriority, TicketStatus } from "@/db/schema"

export const DEAL_STAGES: { id: DealStage; label: string; probability: number; open: boolean }[] = [
  { id: "new", label: "New", probability: 10, open: true },
  { id: "qualified", label: "Qualified", probability: 25, open: true },
  { id: "proposal", label: "Proposal", probability: 50, open: true },
  { id: "negotiation", label: "Negotiation", probability: 75, open: true },
  { id: "won", label: "Won", probability: 100, open: false },
  { id: "lost", label: "Lost", probability: 0, open: false },
]
export const OPEN_STAGES = DEAL_STAGES.filter((s) => s.open).map((s) => s.id)
export const stageLabel = (id: DealStage) => DEAL_STAGES.find((s) => s.id === id)?.label ?? id
export const stageProbability = (id: DealStage) => DEAL_STAGES.find((s) => s.id === id)?.probability ?? 0

export const LIFECYCLES: { id: Lifecycle; label: string; className: string }[] = [
  { id: "lead", label: "Lead", className: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
  { id: "qualified", label: "Qualified", className: "bg-violet/12 text-violet" },
  { id: "customer", label: "Customer", className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
  { id: "churned", label: "Churned", className: "bg-foreground/8 text-muted-foreground" },
]

export const TICKET_STATUSES: { id: TicketStatus; label: string; className: string }[] = [
  { id: "open", label: "Open", className: "bg-violet/12 text-violet" },
  { id: "pending", label: "Pending", className: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  { id: "resolved", label: "Resolved", className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" },
  { id: "closed", label: "Closed", className: "bg-foreground/8 text-muted-foreground" },
]

export const PRIORITIES: { id: TicketPriority; label: string; className: string }[] = [
  { id: "urgent", label: "Urgent", className: "bg-red-500/12 text-red-600 dark:text-red-300" },
  { id: "high", label: "High", className: "bg-amber-500/12 text-amber-600 dark:text-amber-300" },
  { id: "normal", label: "Normal", className: "bg-sky-500/12 text-sky-600 dark:text-sky-300" },
  { id: "low", label: "Low", className: "bg-foreground/8 text-muted-foreground" },
]

export const TEAMS = ["Support", "Sales", "Success", "Engineering", "Operations"] as const
export const SOURCES = ["website", "referral", "event", "outbound", "chat", "import", "api"] as const

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
export const compactMoney = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
