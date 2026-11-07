import { sql } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

/*
 * Multi-tenant CRM schema. Every business table carries `org_id` and every query is
 * scoped by it (see src/lib/crm/context.ts), so one database safely hosts many orgs.
 */

export const memberRole = pgEnum("member_role", ["owner", "admin", "manager", "agent", "viewer"])
export const memberStatus = pgEnum("member_status", ["active", "invited", "suspended"])
export const lifecycleStage = pgEnum("lifecycle_stage", ["lead", "qualified", "customer", "churned"])
export const dealStage = pgEnum("deal_stage", ["new", "qualified", "proposal", "negotiation", "won", "lost"])
export const ticketStatus = pgEnum("ticket_status", ["open", "pending", "resolved", "closed"])
export const ticketPriority = pgEnum("ticket_priority", ["low", "normal", "high", "urgent"])

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
const ts = (name: string) => timestamp(name, { withTimezone: true })

export type OrgSettings = {
  /** Hours until a ticket breaches its first-response SLA, per priority. */
  slaHours: Record<"urgent" | "high" | "normal" | "low", number>
  /** Classify priority and team for new tickets automatically. */
  autoTriage: boolean
  /** Round-robin new unassigned tickets across the Support team. */
  autoAssign: boolean
  seats: number
}

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("growth"),
  isSandbox: boolean("is_sandbox").notNull().default(true),
  settings: jsonb("settings").$type<OrgSettings>().notNull(),
  createdAt: createdAt(),
  lastActiveAt: ts("last_active_at").notNull().defaultNow(),
})

export type NotificationPrefs = { assignments: boolean; mentions: boolean; slaAlerts: boolean; weeklyDigest: boolean }

export const members = pgTable(
  "members",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** The sign-in identity (email) for people who can log in. Seeded teammates have none. */
    userId: text("user_id"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: memberRole("role").notNull().default("agent"),
    status: memberStatus("status").notNull().default("active"),
    title: text("title"),
    team: text("team").notNull().default("Support"),
    avatarHue: integer("avatar_hue").notNull().default(280),
    timezone: text("timezone").notNull().default("UTC"),
    signature: text("signature"),
    prefs: jsonb("prefs")
      .$type<NotificationPrefs>()
      .notNull()
      .default({ assignments: true, mentions: true, slaAlerts: true, weeklyDigest: false }),
    invitedById: text("invited_by_id"),
    createdAt: createdAt(),
    lastActiveAt: ts("last_active_at"),
  },
  (t) => [
    uniqueIndex("members_org_email_idx").on(t.orgId, t.email),
    uniqueIndex("members_user_idx")
      .on(t.userId)
      .where(sql`${t.userId} is not null`),
  ]
)

export const companies = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    industry: text("industry"),
    size: text("size"),
    country: text("country"),
    ownerId: text("owner_id").references(() => members.id, { onDelete: "set null" }),
    /** 0–100, recomputed from tickets, activity and deals. */
    health: integer("health").notNull().default(70),
    createdAt: createdAt(),
  },
  (t) => [index("companies_org_idx").on(t.orgId, t.name)]
)

export const contacts = pgTable(
  "contacts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    title: text("title"),
    lifecycle: lifecycleStage("lifecycle").notNull().default("lead"),
    source: text("source").notNull().default("website"),
    ownerId: text("owner_id").references(() => members.id, { onDelete: "set null" }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    score: integer("score").notNull().default(0),
    scoreReasons: jsonb("score_reasons").$type<string[]>().notNull().default([]),
    lastActivityAt: ts("last_activity_at"),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_org_idx").on(t.orgId, t.createdAt), index("contacts_org_email_idx").on(t.orgId, t.email)]
)

export const deals = pgTable(
  "deals",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    ownerId: text("owner_id").references(() => members.id, { onDelete: "set null" }),
    stage: dealStage("stage").notNull().default("new"),
    value: integer("value").notNull().default(0),
    probability: integer("probability").notNull().default(10),
    /** Fractional index so a card can be dropped between two others with one write. */
    position: real("position").notNull().default(0),
    nextStep: text("next_step"),
    lostReason: text("lost_reason"),
    expectedCloseAt: ts("expected_close_at"),
    stageChangedAt: ts("stage_changed_at").notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("deals_org_stage_idx").on(t.orgId, t.stage, t.position)]
)

export const tickets = pgTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    subject: text("subject").notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    assigneeId: text("assignee_id").references(() => members.id, { onDelete: "set null" }),
    status: ticketStatus("status").notNull().default("open"),
    priority: ticketPriority("priority").notNull().default("normal"),
    channel: text("channel").notNull().default("email"),
    team: text("team").notNull().default("Support"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    csat: integer("csat"),
    dueAt: ts("due_at"),
    firstResponseAt: ts("first_response_at"),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tickets_org_number_idx").on(t.orgId, t.number),
    index("tickets_org_status_idx").on(t.orgId, t.status, t.updatedAt),
  ]
)

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorType: text("author_type").$type<"contact" | "member" | "ai" | "system">().notNull(),
    authorId: text("author_id"),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    internal: boolean("internal").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)]
)

export const tasks = pgTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    priority: text("priority").$type<"low" | "normal" | "high">().notNull().default("normal"),
    dueAt: ts("due_at"),
    assigneeId: text("assignee_id").references(() => members.id, { onDelete: "set null" }),
    done: boolean("done").notNull().default(false),
    completedAt: ts("completed_at"),
    relatedType: text("related_type").$type<"contact" | "company" | "deal" | "ticket">(),
    relatedId: text("related_id"),
    source: text("source").$type<"manual" | "automation" | "agent">().notNull().default("manual"),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_org_idx").on(t.orgId, t.done, t.dueAt)]
)

export type ActivityType = "note" | "call" | "email" | "meeting" | "stage_change" | "ticket" | "task" | "ai"
export type SubjectType = "contact" | "company" | "deal" | "ticket"

export const activities = pgTable(
  "activities",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").$type<ActivityType>().notNull(),
    subjectType: text("subject_type").$type<SubjectType>().notNull(),
    subjectId: text("subject_id").notNull(),
    /** Denormalized so a contact's timeline also shows activity logged on its deals and tickets. */
    contactId: text("contact_id"),
    companyId: text("company_id"),
    actorId: text("actor_id"),
    title: text("title").notNull(),
    body: text("body"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("activities_subject_idx").on(t.orgId, t.subjectType, t.subjectId),
    index("activities_contact_idx").on(t.orgId, t.contactId),
    index("activities_company_idx").on(t.orgId, t.companyId),
    index("activities_org_time_idx").on(t.orgId, t.occurredAt),
  ]
)

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: text("actor_id"),
    actorName: text("actor_name").notNull(),
    /** Set when an admin acted while viewing the app as another member. */
    impersonatorName: text("impersonator_name"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_time_idx").on(t.orgId, t.createdAt)]
)

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_member_idx").on(t.memberId, t.createdAt)]
)

export type AutomationTrigger = "ticket.created" | "deal.stage_changed" | "contact.created"
export type AutomationCondition = { field: string; op: "eq" | "neq" | "contains" | "gte" | "lte"; value: string }
export type AutomationAction =
  | { type: "assign"; memberId: string }
  | { type: "round_robin"; team: string }
  | { type: "set_priority"; priority: "low" | "normal" | "high" | "urgent" }
  | { type: "add_tag"; tag: string }
  | { type: "create_task"; title: string; dueInDays: number }
  | { type: "notify"; memberId: string; message: string }
  | { type: "set_lifecycle"; lifecycle: "lead" | "qualified" | "customer" | "churned" }

export const automations = pgTable(
  "automations",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: text("trigger").$type<AutomationTrigger>().notNull(),
    conditions: jsonb("conditions").$type<AutomationCondition[]>().notNull().default([]),
    actions: jsonb("actions").$type<AutomationAction[]>().notNull().default([]),
    enabled: boolean("enabled").notNull().default(true),
    runCount: integer("run_count").notNull().default(0),
    lastRunAt: ts("last_run_at"),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
  },
  (t) => [index("automations_org_idx").on(t.orgId, t.trigger)]
)

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** First characters of the key, shown in the UI so people can tell keys apart. */
    prefix: text("prefix").notNull(),
    /** SHA-256 of the full key. The key itself is shown once and never stored. */
    hash: text("hash").notNull(),
    scopes: jsonb("scopes").$type<("crm:read" | "crm:write")[]>().notNull(),
    createdById: text("created_by_id"),
    createdAt: createdAt(),
    lastUsedAt: ts("last_used_at"),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("api_keys_hash_idx").on(t.hash), index("api_keys_org_idx").on(t.orgId)]
)

export type Organization = typeof organizations.$inferSelect
export type Member = typeof members.$inferSelect
export type Company = typeof companies.$inferSelect
export type Contact = typeof contacts.$inferSelect
export type Deal = typeof deals.$inferSelect
export type Ticket = typeof tickets.$inferSelect
export type TicketMessage = typeof ticketMessages.$inferSelect
export type Task = typeof tasks.$inferSelect
export type Activity = typeof activities.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type Automation = typeof automations.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect
export type MemberRole = (typeof memberRole.enumValues)[number]
export type DealStage = (typeof dealStage.enumValues)[number]
export type TicketStatus = (typeof ticketStatus.enumValues)[number]
export type TicketPriority = (typeof ticketPriority.enumValues)[number]
export type Lifecycle = (typeof lifecycleStage.enumValues)[number]
