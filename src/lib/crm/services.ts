import "server-only"
import { and, asc, desc, eq, ilike, inArray, max, ne, or, sql } from "drizzle-orm"
import * as s from "@/db/schema"
import { automationMatches, pickRoundRobin, type EventRecord } from "./automation-engine"
import { OPEN_STAGES, stageLabel, stageProbability } from "./constants"
import { logActivity, notify, recordAudit, type CrmContext } from "./context"
import { newId } from "./ids"
import { can, PermissionError } from "./permissions"
import { leadScore, slaDueAt, triageTicket } from "./scoring"

/*
 * Business operations shared by the UI (server actions), the AI agent's tools,
 * the REST API and the MCP server. Each one checks permissions, writes an audit
 * entry and fires automations, so every entry point behaves the same way.
 */

export type ServiceContext = CrmContext & { via?: string }

function assert(ctx: ServiceContext, permission: Parameters<typeof can>[1]) {
  if (!can(ctx.member.role, permission)) throw new PermissionError()
}

const ilikeAny = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`

// ---------------------------------------------------------------------------
// Automations
// ---------------------------------------------------------------------------

type AutomationTarget =
  | { kind: "ticket"; id: string; contactId?: string | null }
  | { kind: "deal"; id: string; contactId?: string | null; companyId?: string | null }
  | { kind: "contact"; id: string }

async function openLoad(ctx: ServiceContext, team: string) {
  const mates = await ctx.db
    .select({ id: s.members.id })
    .from(s.members)
    .where(and(eq(s.members.orgId, ctx.org.id), eq(s.members.team, team), eq(s.members.status, "active"), ne(s.members.role, "viewer")))
  if (!mates.length) return []
  const loads = await ctx.db
    .select({ id: s.tickets.assigneeId, n: sql<number>`count(*)::int` })
    .from(s.tickets)
    .where(and(eq(s.tickets.orgId, ctx.org.id), inArray(s.tickets.status, ["open", "pending"]), inArray(s.tickets.assigneeId, mates.map((m) => m.id))))
    .groupBy(s.tickets.assigneeId)
  return mates.map((m) => ({ id: m.id, openLoad: loads.find((l) => l.id === m.id)?.n ?? 0 }))
}

/** Runs every enabled automation for a trigger whose conditions match the record. */
export async function runAutomations(ctx: ServiceContext, trigger: s.AutomationTrigger, record: EventRecord, target: AutomationTarget) {
  const rules = await ctx.db
    .select()
    .from(s.automations)
    .where(and(eq(s.automations.orgId, ctx.org.id), eq(s.automations.trigger, trigger), eq(s.automations.enabled, true)))
    .orderBy(asc(s.automations.createdAt))

  const ran: string[] = []
  for (const rule of rules) {
    if (!automationMatches(rule.conditions, record)) continue
    for (const action of rule.actions) {
      switch (action.type) {
        case "assign":
        case "round_robin": {
          const memberId = action.type === "assign" ? action.memberId : pickRoundRobin(await openLoad(ctx, action.team))
          if (!memberId) break
          if (target.kind === "ticket") {
            await ctx.db.update(s.tickets).set({ assigneeId: memberId }).where(and(eq(s.tickets.id, target.id), eq(s.tickets.orgId, ctx.org.id)))
            await notify(ctx, [memberId], { kind: "assignment", title: `A ticket was assigned to you by “${rule.name}”`, href: `/app/crm/inbox?t=${target.id}` })
          } else if (target.kind === "deal") {
            await ctx.db.update(s.deals).set({ ownerId: memberId }).where(and(eq(s.deals.id, target.id), eq(s.deals.orgId, ctx.org.id)))
          } else {
            await ctx.db.update(s.contacts).set({ ownerId: memberId }).where(and(eq(s.contacts.id, target.id), eq(s.contacts.orgId, ctx.org.id)))
          }
          break
        }
        case "set_priority":
          if (target.kind === "ticket") {
            await ctx.db.update(s.tickets).set({ priority: action.priority }).where(and(eq(s.tickets.id, target.id), eq(s.tickets.orgId, ctx.org.id)))
          }
          break
        case "add_tag": {
          const table = target.kind === "ticket" ? s.tickets : target.kind === "contact" ? s.contacts : null
          if (table) {
            await ctx.db
              .update(table)
              .set({ tags: sql`(select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(${table.tags} || ${JSON.stringify([action.tag])}::jsonb) t)` })
              .where(and(eq(table.id, target.id), eq(table.orgId, ctx.org.id)))
          }
          break
        }
        case "set_lifecycle":
          if (target.kind === "contact") {
            await ctx.db.update(s.contacts).set({ lifecycle: action.lifecycle }).where(and(eq(s.contacts.id, target.id), eq(s.contacts.orgId, ctx.org.id)))
          }
          break
        case "create_task":
          await ctx.db.insert(s.tasks).values({
            id: newId("task"),
            orgId: ctx.org.id,
            title: action.title,
            dueAt: new Date(Date.now() + action.dueInDays * 86_400_000),
            assigneeId: ctx.member.id,
            relatedType: target.kind,
            relatedId: target.id,
            source: "automation",
            createdById: ctx.member.id,
          })
          break
        case "notify":
          await notify({ ...ctx, member: { ...ctx.member, id: "__automation__" } }, [action.memberId], {
            kind: "automation",
            title: action.message,
            body: `From automation “${rule.name}”`,
            href: target.kind === "ticket" ? `/app/crm/inbox?t=${target.id}` : target.kind === "deal" ? "/app/crm/deals" : `/app/crm/contacts/${target.id}`,
          })
          break
      }
    }
    await ctx.db
      .update(s.automations)
      .set({ runCount: sql`${s.automations.runCount} + 1`, lastRunAt: new Date() })
      .where(eq(s.automations.id, rule.id))
    ran.push(rule.name)
  }
  return ran
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export type NewTicket = {
  subject: string
  body: string
  contactEmail?: string
  contactName?: string
  contactId?: string | null
  priority?: s.TicketPriority
  team?: string
  channel?: string
  assigneeId?: string | null
  tags?: string[]
}

async function nextTicketNumber(ctx: ServiceContext) {
  const [row] = await ctx.db.select({ n: max(s.tickets.number) }).from(s.tickets).where(eq(s.tickets.orgId, ctx.org.id))
  return (row?.n ?? 1000) + 1
}

/** Finds a contact by email, or creates a lead for an unknown sender. */
async function resolveContact(ctx: ServiceContext, email?: string, name?: string) {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  const [existing] = await ctx.db
    .select()
    .from(s.contacts)
    .where(and(eq(s.contacts.orgId, ctx.org.id), eq(s.contacts.email, normalized)))
    .limit(1)
  if (existing) return existing
  const [created] = await ctx.db
    .insert(s.contacts)
    .values({
      id: newId("con"),
      orgId: ctx.org.id,
      name: name?.trim() || normalized.split("@")[0],
      email: normalized,
      source: "chat",
      lifecycle: "lead",
      score: 20,
      scoreReasons: ["+6 Started in live chat", "+14 Opened a support ticket"],
    })
    .returning()
  return created
}

export async function createTicketRecord(ctx: ServiceContext, input: NewTicket) {
  assert(ctx, "crm:write")
  const triage = triageTicket(`${input.subject} ${input.body}`)
  const useTriage = ctx.org.settings.autoTriage
  const priority = input.priority ?? (useTriage ? triage.priority : "normal")
  const team = input.team ?? (useTriage ? triage.team : "Support")
  const contact = input.contactId
    ? ((await ctx.db.select().from(s.contacts).where(and(eq(s.contacts.id, input.contactId), eq(s.contacts.orgId, ctx.org.id))).limit(1))[0] ?? null)
    : await resolveContact(ctx, input.contactEmail, input.contactName)

  const now = new Date()
  const id = newId("tkt")
  // Retry once if two tickets grab the same number concurrently.
  let number = await nextTicketNumber(ctx)
  const values = {
    id,
    orgId: ctx.org.id,
    subject: input.subject.trim(),
    contactId: contact?.id ?? null,
    assigneeId: input.assigneeId ?? null,
    priority,
    team,
    channel: input.channel ?? "web",
    tags: [...new Set([...(input.tags ?? []), ...(useTriage ? triage.tags : [])])],
    dueAt: slaDueAt(now, priority, ctx.org.settings),
    createdAt: now,
    updatedAt: now,
  }
  try {
    await ctx.db.insert(s.tickets).values({ ...values, number })
  } catch {
    number = await nextTicketNumber(ctx)
    await ctx.db.insert(s.tickets).values({ ...values, number })
  }

  await ctx.db.insert(s.ticketMessages).values({
    id: newId("msg"),
    orgId: ctx.org.id,
    ticketId: id,
    authorType: contact ? "contact" : "member",
    authorId: contact?.id ?? ctx.member.id,
    authorName: contact?.name ?? ctx.member.name,
    body: input.body.trim(),
    createdAt: now,
  })
  if (useTriage) {
    await ctx.db.insert(s.ticketMessages).values({
      id: newId("msg"),
      orgId: ctx.org.id,
      ticketId: id,
      authorType: "ai",
      authorName: "Lumora",
      internal: true,
      body: `Auto-triage: ${priority} priority, routed to ${team}${values.tags.length ? `, tagged ${values.tags.join(", ")}` : ""}. First response due within ${ctx.org.settings.slaHours[priority]}h.`,
      createdAt: new Date(now.getTime() + 1000),
    })
  }
  await logActivity(ctx, {
    type: "ticket",
    subjectType: "ticket",
    subjectId: id,
    contactId: contact?.id,
    companyId: contact?.companyId,
    title: `Opened ticket #${number}: ${values.subject}`,
    meta: { priority },
  })

  const ran = await runAutomations(
    ctx,
    "ticket.created",
    { priority, channel: values.channel, team, subject: values.subject, contactLifecycle: contact?.lifecycle },
    { kind: "ticket", id, contactId: contact?.id }
  )
  if (ctx.org.settings.autoAssign && !input.assigneeId) {
    const [t] = await ctx.db.select({ assigneeId: s.tickets.assigneeId }).from(s.tickets).where(eq(s.tickets.id, id))
    if (!t?.assigneeId) {
      const pick = pickRoundRobin(await openLoad(ctx, team === "Engineering" || team === "Sales" ? "Support" : team))
      if (pick) await ctx.db.update(s.tickets).set({ assigneeId: pick }).where(eq(s.tickets.id, id))
    }
  }
  await recordAudit(ctx, { action: "ticket.created", targetType: "ticket", targetId: id, summary: `Created ticket #${number} “${values.subject}”${ctx.via ? ` via ${ctx.via}` : ""}` })

  const [ticket] = await ctx.db.select().from(s.tickets).where(eq(s.tickets.id, id))
  return { ticket, contact, automations: ran }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export type NewContact = {
  name: string
  email: string
  title?: string | null
  phone?: string | null
  companyName?: string | null
  companyId?: string | null
  source?: string
  lifecycle?: s.Lifecycle
  ownerId?: string | null
}

async function findOrCreateCompany(ctx: ServiceContext, name?: string | null) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const [existing] = await ctx.db
    .select()
    .from(s.companies)
    .where(and(eq(s.companies.orgId, ctx.org.id), ilike(s.companies.name, trimmed)))
    .limit(1)
  if (existing) return existing
  const [created] = await ctx.db
    .insert(s.companies)
    .values({ id: newId("co"), orgId: ctx.org.id, name: trimmed, ownerId: ctx.member.id, health: 70 })
    .returning()
  return created
}

export async function createContactRecord(ctx: ServiceContext, input: NewContact, opts: { audit?: boolean } = {}) {
  assert(ctx, "crm:write")
  const email = input.email.trim().toLowerCase()
  const [dupe] = await ctx.db
    .select({ id: s.contacts.id })
    .from(s.contacts)
    .where(and(eq(s.contacts.orgId, ctx.org.id), eq(s.contacts.email, email)))
    .limit(1)
  if (dupe) return { contact: null, duplicateId: dupe.id }

  const company = input.companyId
    ? ((await ctx.db.select().from(s.companies).where(and(eq(s.companies.id, input.companyId), eq(s.companies.orgId, ctx.org.id))).limit(1))[0] ?? null)
    : await findOrCreateCompany(ctx, input.companyName)
  const source = input.source ?? "website"
  const lifecycle = input.lifecycle ?? "lead"
  const { score, reasons } = leadScore({
    title: input.title,
    source,
    lifecycle,
    companySize: company?.size,
    activities30d: 0,
    meetings30d: 0,
    openDealValue: 0,
    daysSinceActivity: null,
  })
  const [contact] = await ctx.db
    .insert(s.contacts)
    .values({
      id: newId("con"),
      orgId: ctx.org.id,
      name: input.name.trim(),
      email,
      title: input.title?.trim() || null,
      phone: input.phone?.trim() || null,
      companyId: company?.id ?? null,
      source,
      lifecycle,
      ownerId: input.ownerId ?? ctx.member.id,
      score,
      scoreReasons: reasons,
    })
    .returning()

  await runAutomations(ctx, "contact.created", { source, title: contact.title, score }, { kind: "contact", id: contact.id })
  if (opts.audit !== false) {
    await recordAudit(ctx, { action: "contact.created", targetType: "contact", targetId: contact.id, summary: `Created contact ${contact.name}${ctx.via ? ` via ${ctx.via}` : ""}` })
  }
  return { contact, duplicateId: null }
}

/** Recomputes a contact's explainable lead score from its current activity and deals. */
export async function rescoreContact(ctx: ServiceContext, contactId: string) {
  const now = Date.now()
  const [c] = await ctx.db
    .select({ contact: s.contacts, size: s.companies.size })
    .from(s.contacts)
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(and(eq(s.contacts.id, contactId), eq(s.contacts.orgId, ctx.org.id)))
  if (!c) return null
  const [acts] = await ctx.db
    .select({
      n: sql<number>`count(*) filter (where ${s.activities.occurredAt} > now() - interval '30 days')::int`,
      meetings: sql<number>`count(*) filter (where ${s.activities.type} = 'meeting' and ${s.activities.occurredAt} > now() - interval '30 days')::int`,
      last: max(s.activities.occurredAt),
    })
    .from(s.activities)
    .where(and(eq(s.activities.orgId, ctx.org.id), eq(s.activities.contactId, contactId)))
  const [deal] = await ctx.db
    .select({ v: sql<number>`coalesce(sum(${s.deals.value}), 0)::int` })
    .from(s.deals)
    .where(and(eq(s.deals.orgId, ctx.org.id), eq(s.deals.contactId, contactId), inArray(s.deals.stage, OPEN_STAGES)))
  const { score, reasons } = leadScore({
    title: c.contact.title,
    source: c.contact.source,
    lifecycle: c.contact.lifecycle,
    companySize: c.size,
    activities30d: acts?.n ?? 0,
    meetings30d: acts?.meetings ?? 0,
    openDealValue: deal?.v ?? 0,
    daysSinceActivity: acts?.last ? Math.floor((now - new Date(acts.last).getTime()) / 86_400_000) : null,
  })
  await ctx.db.update(s.contacts).set({ score, scoreReasons: reasons }).where(eq(s.contacts.id, contactId))
  return { score, reasons }
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export async function moveDealRecord(ctx: ServiceContext, dealId: string, stage: s.DealStage, position?: number, lostReason?: string) {
  assert(ctx, "crm:write")
  const [deal] = await ctx.db.select().from(s.deals).where(and(eq(s.deals.id, dealId), eq(s.deals.orgId, ctx.org.id))).limit(1)
  if (!deal) throw new Error("Deal not found.")
  const changed = deal.stage !== stage
  let nextPosition = position
  if (nextPosition === undefined) {
    const [row] = await ctx.db
      .select({ p: max(s.deals.position) })
      .from(s.deals)
      .where(and(eq(s.deals.orgId, ctx.org.id), eq(s.deals.stage, stage)))
    nextPosition = (row?.p ?? 0) + 1000
  }
  await ctx.db
    .update(s.deals)
    .set({
      stage,
      position: nextPosition,
      updatedAt: new Date(),
      ...(changed
        ? { probability: stageProbability(stage), stageChangedAt: new Date(), lostReason: stage === "lost" ? (lostReason ?? deal.lostReason) : null }
        : {}),
    })
    .where(eq(s.deals.id, dealId))

  if (changed) {
    await logActivity(ctx, {
      type: "stage_change",
      subjectType: "deal",
      subjectId: deal.id,
      contactId: deal.contactId,
      companyId: deal.companyId,
      title: `Moved ${deal.title} from ${stageLabel(deal.stage)} to ${stageLabel(stage)}`,
      meta: { from: deal.stage, to: stage },
    })
    await recordAudit(ctx, {
      action: "deal.stage_changed",
      targetType: "deal",
      targetId: deal.id,
      summary: `Moved “${deal.title}” to ${stageLabel(stage)}${ctx.via ? ` via ${ctx.via}` : ""}`,
      changes: { stage: { from: deal.stage, to: stage } },
    })
    if (deal.ownerId && deal.ownerId !== ctx.member.id) {
      await notify(ctx, [deal.ownerId], { kind: "deal", title: `${ctx.member.name} moved “${deal.title}” to ${stageLabel(stage)}`, href: "/app/crm/deals" })
    }
    await runAutomations(ctx, "deal.stage_changed", { stage, fromStage: deal.stage, value: deal.value }, { kind: "deal", id: deal.id, contactId: deal.contactId, companyId: deal.companyId })
    if (stage === "won" && deal.contactId) {
      await ctx.db.update(s.contacts).set({ lifecycle: "customer" }).where(and(eq(s.contacts.id, deal.contactId), eq(s.contacts.orgId, ctx.org.id)))
    }
    if (deal.contactId) await rescoreContact(ctx, deal.contactId)
  }
  return { ...deal, stage, changed }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTaskRecord(
  ctx: ServiceContext,
  input: { title: string; dueAt?: Date | null; assigneeId?: string | null; priority?: "low" | "normal" | "high"; relatedType?: s.SubjectType; relatedId?: string; source?: "manual" | "agent" | "automation"; notes?: string }
) {
  assert(ctx, "crm:write")
  const [task] = await ctx.db
    .insert(s.tasks)
    .values({
      id: newId("task"),
      orgId: ctx.org.id,
      title: input.title.trim(),
      notes: input.notes,
      dueAt: input.dueAt ?? null,
      assigneeId: input.assigneeId ?? ctx.member.id,
      priority: input.priority ?? "normal",
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      source: input.source ?? "manual",
      createdById: ctx.member.id,
    })
    .returning()
  if (task.assigneeId && task.assigneeId !== ctx.member.id) {
    await notify(ctx, [task.assigneeId], { kind: "assignment", title: `${ctx.member.name} assigned you “${task.title}”`, href: "/app/crm/tasks" })
  }
  return task
}

// ---------------------------------------------------------------------------
// Read models used by the agent, REST API and MCP server
// ---------------------------------------------------------------------------

export async function searchCrm(ctx: ServiceContext, query: string, limit = 5) {
  const q = query.trim()
  if (!q) return { contacts: [], companies: [], deals: [], tickets: [] }
  const like = ilikeAny(q)
  const number = Number(q.replace(/^#/, ""))
  const [contactRows, companyRows, dealRows, ticketRows] = await Promise.all([
    ctx.db
      .select({ id: s.contacts.id, name: s.contacts.name, email: s.contacts.email, title: s.contacts.title, lifecycle: s.contacts.lifecycle, score: s.contacts.score, company: s.companies.name })
      .from(s.contacts)
      .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
      .where(and(eq(s.contacts.orgId, ctx.org.id), or(ilike(s.contacts.name, like), ilike(s.contacts.email, like), ilike(s.companies.name, like))))
      .orderBy(desc(s.contacts.score))
      .limit(limit),
    ctx.db
      .select({ id: s.companies.id, name: s.companies.name, domain: s.companies.domain, industry: s.companies.industry, health: s.companies.health })
      .from(s.companies)
      .where(and(eq(s.companies.orgId, ctx.org.id), or(ilike(s.companies.name, like), ilike(s.companies.domain, like))))
      .limit(limit),
    ctx.db
      .select({ id: s.deals.id, title: s.deals.title, stage: s.deals.stage, value: s.deals.value, owner: s.members.name })
      .from(s.deals)
      .leftJoin(s.members, eq(s.members.id, s.deals.ownerId))
      .where(and(eq(s.deals.orgId, ctx.org.id), ilike(s.deals.title, like)))
      .orderBy(desc(s.deals.value))
      .limit(limit),
    ctx.db
      .select({ id: s.tickets.id, number: s.tickets.number, subject: s.tickets.subject, status: s.tickets.status, priority: s.tickets.priority })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, ctx.org.id), Number.isInteger(number) && number > 0 ? or(eq(s.tickets.number, number), ilike(s.tickets.subject, like)) : ilike(s.tickets.subject, like)))
      .orderBy(desc(s.tickets.updatedAt))
      .limit(limit),
  ])
  return { contacts: contactRows, companies: companyRows, deals: dealRows, tickets: ticketRows }
}

export async function pipelineSummary(ctx: ServiceContext) {
  const rows = await ctx.db
    .select({ stage: s.deals.stage, count: sql<number>`count(*)::int`, value: sql<number>`coalesce(sum(${s.deals.value}), 0)::int` })
    .from(s.deals)
    .where(eq(s.deals.orgId, ctx.org.id))
    .groupBy(s.deals.stage)
  const byStage = OPEN_STAGES.map((stage) => rows.find((r) => r.stage === stage) ?? { stage, count: 0, value: 0 })
  const open = byStage.reduce((n, r) => n + r.value, 0)
  const weighted = byStage.reduce((n, r) => n + r.value * (stageProbability(r.stage) / 100), 0)
  const won = rows.find((r) => r.stage === "won") ?? { count: 0, value: 0 }
  const lost = rows.find((r) => r.stage === "lost") ?? { count: 0, value: 0 }
  const top = await ctx.db
    .select({ id: s.deals.id, title: s.deals.title, stage: s.deals.stage, value: s.deals.value, owner: s.members.name, nextStep: s.deals.nextStep })
    .from(s.deals)
    .leftJoin(s.members, eq(s.members.id, s.deals.ownerId))
    .where(and(eq(s.deals.orgId, ctx.org.id), inArray(s.deals.stage, OPEN_STAGES)))
    .orderBy(desc(s.deals.value))
    .limit(5)
  return {
    stages: byStage.map((r) => ({ stage: stageLabel(r.stage), count: r.count, value: r.value })),
    openValue: open,
    weightedForecast: Math.round(weighted),
    won: { count: won.count, value: won.value },
    winRate: won.count + lost.count ? Math.round((won.count / (won.count + lost.count)) * 100) : null,
    topDeals: top,
  }
}

export async function openTicketsSummary(ctx: ServiceContext, limit = 10) {
  return ctx.db
    .select({
      id: s.tickets.id,
      number: s.tickets.number,
      subject: s.tickets.subject,
      status: s.tickets.status,
      priority: s.tickets.priority,
      dueAt: s.tickets.dueAt,
      assignee: s.members.name,
    })
    .from(s.tickets)
    .leftJoin(s.members, eq(s.members.id, s.tickets.assigneeId))
    .where(and(eq(s.tickets.orgId, ctx.org.id), inArray(s.tickets.status, ["open", "pending"])))
    .orderBy(sql`case ${s.tickets.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`, asc(s.tickets.dueAt))
    .limit(limit)
}

export async function findDealByName(ctx: ServiceContext, name: string) {
  const [deal] = await ctx.db
    .select()
    .from(s.deals)
    .where(and(eq(s.deals.orgId, ctx.org.id), ilike(s.deals.title, ilikeAny(name.trim()))))
    .orderBy(sql`case when ${s.deals.stage} in ('won','lost') then 1 else 0 end`, desc(s.deals.value))
    .limit(1)
  return deal ?? null
}

export async function findMemberByName(ctx: ServiceContext, name: string) {
  const [m] = await ctx.db
    .select()
    .from(s.members)
    .where(and(eq(s.members.orgId, ctx.org.id), eq(s.members.status, "active"), or(ilike(s.members.name, ilikeAny(name.trim())), ilike(s.members.email, ilikeAny(name.trim())))))
    .limit(1)
  return m ?? null
}

