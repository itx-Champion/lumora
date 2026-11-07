import type { AutomationAction, AutomationCondition, AutomationTrigger } from "@/db/schema"

type FieldDef = { id: string; label: string; type: "enum" | "text" | "number"; options?: string[] }

/** Fields each trigger exposes to conditions, and the actions that make sense for it. */
export const TRIGGERS: Record<
  AutomationTrigger,
  { label: string; description: string; fields: FieldDef[]; actions: AutomationAction["type"][] }
> = {
  "ticket.created": {
    label: "Ticket is created",
    description: "Runs when a ticket arrives from email, chat, the API or the AI agent.",
    fields: [
      { id: "priority", label: "Priority", type: "enum", options: ["urgent", "high", "normal", "low"] },
      { id: "channel", label: "Channel", type: "enum", options: ["email", "chat", "web", "agent", "api"] },
      { id: "team", label: "Team", type: "enum", options: ["Support", "Sales", "Success", "Engineering", "Operations"] },
      { id: "subject", label: "Subject", type: "text" },
      { id: "contactLifecycle", label: "Contact lifecycle", type: "enum", options: ["lead", "qualified", "customer", "churned"] },
    ],
    actions: ["assign", "round_robin", "set_priority", "add_tag", "create_task", "notify"],
  },
  "deal.stage_changed": {
    label: "Deal changes stage",
    description: "Runs when a deal moves on the pipeline board, in the API or through the AI agent.",
    fields: [
      { id: "stage", label: "New stage", type: "enum", options: ["new", "qualified", "proposal", "negotiation", "won", "lost"] },
      { id: "fromStage", label: "Previous stage", type: "enum", options: ["new", "qualified", "proposal", "negotiation", "won", "lost"] },
      { id: "value", label: "Deal value", type: "number" },
    ],
    actions: ["assign", "create_task", "notify"],
  },
  "contact.created": {
    label: "Contact is created",
    description: "Runs for contacts added by hand, imported from CSV or created through the API.",
    fields: [
      { id: "source", label: "Source", type: "enum", options: ["website", "referral", "event", "outbound", "chat", "import", "api"] },
      { id: "title", label: "Job title", type: "text" },
      { id: "score", label: "Lead score", type: "number" },
    ],
    actions: ["assign", "round_robin", "add_tag", "set_lifecycle", "create_task", "notify"],
  },
}

export const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  assign: "Assign to member",
  round_robin: "Round-robin across a team",
  set_priority: "Set priority",
  add_tag: "Add tag",
  create_task: "Create a follow-up task",
  notify: "Notify a member",
  set_lifecycle: "Set lifecycle stage",
}

export const OPERATOR_LABELS: Record<AutomationCondition["op"], string> = {
  eq: "is",
  neq: "is not",
  contains: "contains",
  gte: "is at least",
  lte: "is at most",
}

export type EventRecord = Record<string, string | number | null | undefined>

export function conditionMatches(c: AutomationCondition, record: EventRecord) {
  const raw = record[c.field]
  if (raw === undefined || raw === null) return c.op === "neq"
  const value = String(raw).toLowerCase()
  const expected = c.value.trim().toLowerCase()
  switch (c.op) {
    case "eq":
      return value === expected
    case "neq":
      return value !== expected
    case "contains":
      return expected.length > 0 && value.includes(expected)
    case "gte":
      return Number(raw) >= Number(c.value)
    case "lte":
      return Number(raw) <= Number(c.value)
  }
}

/** All conditions must match (AND). An automation with no conditions always runs. */
export function automationMatches(conditions: AutomationCondition[], record: EventRecord) {
  return conditions.every((c) => conditionMatches(c, record))
}

/** Round-robin by load: whoever has the fewest open items gets the next one; ties go by id. */
export function pickRoundRobin(candidates: { id: string; openLoad: number }[]) {
  return [...candidates].sort((a, b) => a.openLoad - b.openLoad || a.id.localeCompare(b.id))[0]?.id ?? null
}

/** Plain-English sentence for an automation, used in the list and in the audit log. */
export function describeAutomation(
  trigger: AutomationTrigger,
  conditions: AutomationCondition[],
  actions: AutomationAction[],
  memberName: (id: string) => string = (id) => id
) {
  const when = TRIGGERS[trigger].label.toLowerCase()
  const fieldLabel = (id: string) => TRIGGERS[trigger].fields.find((f) => f.id === id)?.label.toLowerCase() ?? id
  const ifs = conditions.map((c) => `${fieldLabel(c.field)} ${OPERATOR_LABELS[c.op]} “${c.value}”`).join(" and ")
  const thens = actions
    .map((a) => {
      switch (a.type) {
        case "assign":
          return `assign to ${memberName(a.memberId)}`
        case "round_robin":
          return `round-robin across ${a.team}`
        case "set_priority":
          return `set priority to ${a.priority}`
        case "add_tag":
          return `tag “${a.tag}”`
        case "create_task":
          return `create task “${a.title}” due in ${a.dueInDays}d`
        case "notify":
          return `notify ${memberName(a.memberId)}`
        case "set_lifecycle":
          return `mark as ${a.lifecycle}`
      }
    })
    .join(", ")
  return `When ${when}${ifs ? ` and ${ifs}` : ""}: ${thens || "do nothing"}.`
}
