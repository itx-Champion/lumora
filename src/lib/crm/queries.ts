import "server-only"
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm"
import * as s from "@/db/schema"
import { OPEN_STAGES, stageProbability } from "./constants"
import type { CrmContext } from "./context"
import { slaState } from "./scoring"

const DAY = 86_400_000
const like = (q: string) => `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`

export type MemberLite = Pick<s.Member, "id" | "name" | "email" | "role" | "status" | "title" | "team" | "avatarHue">

export async function listMembers(ctx: CrmContext): Promise<MemberLite[]> {
  return ctx.db
    .select({
      id: s.members.id,
      name: s.members.name,
      email: s.members.email,
      role: s.members.role,
      status: s.members.status,
      title: s.members.title,
      team: s.members.team,
      avatarHue: s.members.avatarHue,
    })
    .from(s.members)
    .where(eq(s.members.orgId, ctx.org.id))
    .orderBy(sql`case ${s.members.role} when 'owner' then 0 when 'admin' then 1 when 'manager' then 2 when 'agent' then 3 else 4 end`, asc(s.members.name))
}

// ---------------------------------------------------------------------------
// Pulse (CRM home)
// ---------------------------------------------------------------------------

export type Signal = {
  id: string
  severity: "critical" | "warning" | "opportunity"
  title: string
  detail: string
  href: string
  cta: string
}

export async function getPulse(ctx: CrmContext) {
  const { db, org } = ctx
  const now = Date.now()
  const since = new Date(now - 14 * DAY)

  const [deals, ticketsOpen, ticketsRecent, overdueTasks, hotLeads, atRisk, members] = await Promise.all([
    db
      .select({ id: s.deals.id, title: s.deals.title, stage: s.deals.stage, value: s.deals.value, stageChangedAt: s.deals.stageChangedAt, updatedAt: s.deals.updatedAt, ownerId: s.deals.ownerId, expectedCloseAt: s.deals.expectedCloseAt })
      .from(s.deals)
      .where(eq(s.deals.orgId, org.id)),
    db
      .select({ id: s.tickets.id, number: s.tickets.number, subject: s.tickets.subject, status: s.tickets.status, priority: s.tickets.priority, createdAt: s.tickets.createdAt, dueAt: s.tickets.dueAt, firstResponseAt: s.tickets.firstResponseAt, assigneeId: s.tickets.assigneeId })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, org.id), inArray(s.tickets.status, ["open", "pending"]))),
    db
      .select({ createdAt: s.tickets.createdAt, resolvedAt: s.tickets.resolvedAt, firstResponseAt: s.tickets.firstResponseAt, dueAt: s.tickets.dueAt, csat: s.tickets.csat })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, org.id), or(gte(s.tickets.createdAt, since), gte(s.tickets.resolvedAt, since)))),
    db
      .select({ n: count() })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, org.id), eq(s.tasks.done, false), lt(s.tasks.dueAt, new Date(now)))),
    db
      .select({ id: s.contacts.id, name: s.contacts.name, score: s.contacts.score, lastActivityAt: s.contacts.lastActivityAt, company: s.companies.name })
      .from(s.contacts)
      .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
      .where(and(eq(s.contacts.orgId, org.id), gte(s.contacts.score, 70), ne(s.contacts.lifecycle, "churned")))
      .orderBy(desc(s.contacts.score))
      .limit(6),
    db
      .select({ id: s.companies.id, name: s.companies.name, health: s.companies.health })
      .from(s.companies)
      .where(and(eq(s.companies.orgId, org.id), lt(s.companies.health, 45)))
      .orderBy(asc(s.companies.health))
      .limit(5),
    listMembers(ctx),
  ])

  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
  const openValue = open.reduce((n, d) => n + d.value, 0)
  const weighted = open.reduce((n, d) => n + (d.value * stageProbability(d.stage)) / 100, 0)
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime()
  const wonThisMonth = deals.filter((d) => d.stage === "won" && d.stageChangedAt.getTime() >= monthStart)
  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost")
  const winRate = closed.length ? deals.filter((d) => d.stage === "won").length / closed.length : 0
  const stalled = open.filter((d) => now - d.stageChangedAt.getTime() > 14 * DAY).sort((a, b) => b.value - a.value)

  const sla = ticketsOpen.map((t) => ({ ...t, sla: slaState(t, now) }))
  const breached = sla.filter((t) => t.sla === "breached")
  const atRiskTickets = sla.filter((t) => t.sla === "at_risk")
  const unassigned = ticketsOpen.filter((t) => !t.assigneeId)

  const responded = ticketsRecent.filter((t) => t.firstResponseAt && t.createdAt >= since)
  const slaMet = responded.filter((t) => t.dueAt && t.firstResponseAt! <= t.dueAt).length
  const rated = ticketsRecent.filter((t) => t.csat)
  const medianFirstResponseH = (() => {
    const v = responded.map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 3_600_000).sort((a, b) => a - b)
    return v.length ? v[Math.floor(v.length / 2)] : null
  })()

  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const ticketTrend = Array.from({ length: 14 }, (_, i) => {
    const start = startOfToday - (13 - i) * DAY
    const end = start + DAY
    return {
      label: new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(start),
      created: ticketsRecent.filter((t) => t.createdAt.getTime() >= start && t.createdAt.getTime() < end).length,
      resolved: ticketsRecent.filter((t) => t.resolvedAt && t.resolvedAt.getTime() >= start && t.resolvedAt.getTime() < end).length,
    }
  })

  const pipeline = OPEN_STAGES.map((stage) => {
    const inStage = open.filter((d) => d.stage === stage)
    return { stage, value: inStage.reduce((n, d) => n + d.value, 0), count: inStage.length }
  })

  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? "Unassigned"
  const signals: Signal[] = []
  if (breached.length) {
    signals.push({
      id: "sla-breached",
      severity: "critical",
      title: `${breached.length} ticket${breached.length > 1 ? "s" : ""} breached the first-response SLA`,
      detail: breached
        .slice(0, 3)
        .map((t) => `#${t.number} ${t.subject} (${name(t.assigneeId)})`)
        .join(" · "),
      href: `/app/crm/inbox?t=${breached[0].id}`,
      cta: "Open inbox",
    })
  }
  if (atRiskTickets.length) {
    signals.push({
      id: "sla-risk",
      severity: "warning",
      title: `${atRiskTickets.length} ticket${atRiskTickets.length > 1 ? "s are" : " is"} about to breach SLA`,
      detail: atRiskTickets.slice(0, 3).map((t) => `#${t.number} ${t.subject}`).join(" · "),
      href: `/app/crm/inbox?t=${atRiskTickets[0].id}`,
      cta: "Reply now",
    })
  }
  if (stalled.length) {
    const value = stalled.reduce((n, d) => n + d.value, 0)
    signals.push({
      id: "stalled",
      severity: "warning",
      title: `${stalled.length} deals worth $${Math.round(value / 1000)}k haven't moved in 14+ days`,
      detail: stalled.slice(0, 3).map((d) => `${d.title} (${name(d.ownerId)})`).join(" · "),
      href: "/app/crm/deals?stalled=1",
      cta: "Review pipeline",
    })
  }
  if (unassigned.length) {
    signals.push({
      id: "unassigned",
      severity: "warning",
      title: `${unassigned.length} open ticket${unassigned.length > 1 ? "s have" : " has"} no owner`,
      detail: "Assign them or turn on round-robin in Automations.",
      href: "/app/crm/inbox?view=unassigned",
      cta: "Assign",
    })
  }
  const coldHot = hotLeads.filter((c) => !c.lastActivityAt || now - c.lastActivityAt.getTime() > 3 * DAY)
  if (coldHot.length) {
    signals.push({
      id: "hot-leads",
      severity: "opportunity",
      title: `${coldHot.length} hot lead${coldHot.length > 1 ? "s" : ""} not contacted in 3+ days`,
      detail: coldHot.slice(0, 3).map((c) => `${c.name}${c.company ? `, ${c.company}` : ""} (score ${c.score})`).join(" · "),
      href: `/app/crm/contacts/${coldHot[0].id}`,
      cta: "Reach out",
    })
  }
  if (atRisk.length) {
    signals.push({
      id: "accounts-risk",
      severity: "critical",
      title: `${atRisk.length} account${atRisk.length > 1 ? "s are" : " is"} at risk of churning`,
      detail: atRisk.map((c) => `${c.name} (health ${c.health})`).join(" · "),
      href: `/app/crm/companies/${atRisk[0].id}`,
      cta: "View account",
    })
  }
  const closingSoon = open.filter((d) => d.expectedCloseAt && d.expectedCloseAt.getTime() - now < 14 * DAY && d.expectedCloseAt.getTime() > now)
  if (closingSoon.length) {
    signals.push({
      id: "closing",
      severity: "opportunity",
      title: `${closingSoon.length} deals expected to close in the next 2 weeks`,
      detail: closingSoon.slice(0, 3).map((d) => d.title).join(" · "),
      href: "/app/crm/deals",
      cta: "Push to close",
    })
  }
  if (overdueTasks[0]?.n) {
    signals.push({
      id: "tasks",
      severity: "warning",
      title: `${overdueTasks[0].n} overdue tasks across the team`,
      detail: "Clear them or reassign to keep follow-ups on time.",
      href: "/app/crm/tasks?view=overdue",
      cta: "See tasks",
    })
  }

  return {
    kpis: {
      openValue,
      weighted: Math.round(weighted),
      wonThisMonth: wonThisMonth.reduce((n, d) => n + d.value, 0),
      wonThisMonthCount: wonThisMonth.length,
      winRate,
      openTickets: ticketsOpen.length,
      slaRate: responded.length ? slaMet / responded.length : null,
      medianFirstResponseH,
      csat: rated.length ? rated.reduce((n, t) => n + (t.csat ?? 0), 0) / rated.length : null,
      csatCount: rated.length,
    },
    pipeline,
    ticketTrend,
    signals,
    hotLeads,
    atRisk,
  }
}

export type Pulse = Awaited<ReturnType<typeof getPulse>>

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const CONTACT_PAGE_SIZE = 25

export async function listContacts(
  ctx: CrmContext,
  f: { q?: string; lifecycle?: string; owner?: string; sort?: string; page?: number; tag?: string }
) {
  const where: SQL[] = [eq(s.contacts.orgId, ctx.org.id)]
  if (f.q) where.push(or(ilike(s.contacts.name, like(f.q)), ilike(s.contacts.email, like(f.q)), ilike(s.companies.name, like(f.q)))!)
  if (f.lifecycle && s.lifecycleStage.enumValues.includes(f.lifecycle as s.Lifecycle)) where.push(eq(s.contacts.lifecycle, f.lifecycle as s.Lifecycle))
  if (f.owner === "me") where.push(eq(s.contacts.ownerId, ctx.member.id))
  else if (f.owner === "none") where.push(isNull(s.contacts.ownerId))
  else if (f.owner) where.push(eq(s.contacts.ownerId, f.owner))
  if (f.tag) where.push(sql`${s.contacts.tags} ? ${f.tag}`)

  const order =
    f.sort === "name"
      ? [asc(s.contacts.name)]
      : f.sort === "recent"
        ? [desc(s.contacts.createdAt)]
        : f.sort === "activity"
          ? [sql`${s.contacts.lastActivityAt} desc nulls last`]
          : [desc(s.contacts.score), asc(s.contacts.name)]
  const page = Math.max(1, f.page ?? 1)

  const [rows, [{ total }], lifecycleCounts] = await Promise.all([
    ctx.db
      .select({
        id: s.contacts.id,
        name: s.contacts.name,
        email: s.contacts.email,
        title: s.contacts.title,
        lifecycle: s.contacts.lifecycle,
        score: s.contacts.score,
        tags: s.contacts.tags,
        source: s.contacts.source,
        lastActivityAt: s.contacts.lastActivityAt,
        createdAt: s.contacts.createdAt,
        ownerId: s.contacts.ownerId,
        companyId: s.contacts.companyId,
        company: s.companies.name,
      })
      .from(s.contacts)
      .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
      .where(and(...where))
      .orderBy(...order)
      .limit(CONTACT_PAGE_SIZE)
      .offset((page - 1) * CONTACT_PAGE_SIZE),
    ctx.db
      .select({ total: count() })
      .from(s.contacts)
      .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
      .where(and(...where)),
    ctx.db
      .select({ lifecycle: s.contacts.lifecycle, n: count() })
      .from(s.contacts)
      .where(eq(s.contacts.orgId, ctx.org.id))
      .groupBy(s.contacts.lifecycle),
  ])
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE)), lifecycleCounts }
}

export type ContactRow = Awaited<ReturnType<typeof listContacts>>["rows"][number]

export async function getContactDetail(ctx: CrmContext, id: string) {
  const [row] = await ctx.db
    .select({ contact: s.contacts, company: s.companies })
    .from(s.contacts)
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(and(eq(s.contacts.id, id), eq(s.contacts.orgId, ctx.org.id)))
    .limit(1)
  if (!row) return null
  const [dealRows, ticketRows, taskRows, timeline, colleagues] = await Promise.all([
    ctx.db.select().from(s.deals).where(and(eq(s.deals.orgId, ctx.org.id), eq(s.deals.contactId, id))).orderBy(desc(s.deals.updatedAt)),
    ctx.db.select().from(s.tickets).where(and(eq(s.tickets.orgId, ctx.org.id), eq(s.tickets.contactId, id))).orderBy(desc(s.tickets.createdAt)),
    ctx.db
      .select()
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.org.id), eq(s.tasks.relatedType, "contact"), eq(s.tasks.relatedId, id)))
      .orderBy(asc(s.tasks.done), asc(s.tasks.dueAt)),
    ctx.db
      .select()
      .from(s.activities)
      .where(and(eq(s.activities.orgId, ctx.org.id), eq(s.activities.contactId, id)))
      .orderBy(desc(s.activities.occurredAt))
      .limit(60),
    row.company
      ? ctx.db
          .select({ id: s.contacts.id, name: s.contacts.name, title: s.contacts.title })
          .from(s.contacts)
          .where(and(eq(s.contacts.orgId, ctx.org.id), eq(s.contacts.companyId, row.company.id), ne(s.contacts.id, id)))
      : Promise.resolve([]),
  ])
  return { ...row, deals: dealRows, tickets: ticketRows, tasks: taskRows, timeline, colleagues }
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContactDetail>>>

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export async function listCompanies(ctx: CrmContext, f: { q?: string; sort?: string }) {
  const where: SQL[] = [eq(s.companies.orgId, ctx.org.id)]
  if (f.q) where.push(or(ilike(s.companies.name, like(f.q)), ilike(s.companies.domain, like(f.q)), ilike(s.companies.industry, like(f.q)))!)
  // Drizzle prints columns unqualified in single-table selects, so correlate on an explicit name.
  const companyId = sql.raw(`"companies"."id"`)
  const contactsCount = sql<number>`(select count(*)::int from ${s.contacts} c where c.company_id = ${companyId})`
  const openDeals = sql<number>`(select coalesce(sum(d.value), 0)::int from ${s.deals} d where d.company_id = ${companyId} and d.stage in ('new','qualified','proposal','negotiation'))`
  const wonValue = sql<number>`(select coalesce(sum(d.value), 0)::int from ${s.deals} d where d.company_id = ${companyId} and d.stage = 'won')`
  const openTickets = sql<number>`(select count(*)::int from ${s.tickets} t join ${s.contacts} c on c.id = t.contact_id where c.company_id = ${companyId} and t.status in ('open','pending'))`
  const order =
    f.sort === "name" ? [asc(s.companies.name)] : f.sort === "health" ? [asc(s.companies.health)] : f.sort === "pipeline" ? [desc(openDeals)] : [desc(wonValue), asc(s.companies.name)]
  return ctx.db
    .select({
      id: s.companies.id,
      name: s.companies.name,
      domain: s.companies.domain,
      industry: s.companies.industry,
      size: s.companies.size,
      country: s.companies.country,
      health: s.companies.health,
      ownerId: s.companies.ownerId,
      contacts: contactsCount,
      openDeals,
      wonValue,
      openTickets,
    })
    .from(s.companies)
    .where(and(...where))
    .orderBy(...order)
}

export async function getCompanyDetail(ctx: CrmContext, id: string) {
  const [company] = await ctx.db.select().from(s.companies).where(and(eq(s.companies.id, id), eq(s.companies.orgId, ctx.org.id))).limit(1)
  if (!company) return null
  const people = await ctx.db.select().from(s.contacts).where(and(eq(s.contacts.orgId, ctx.org.id), eq(s.contacts.companyId, id))).orderBy(desc(s.contacts.score))
  const ids = people.map((p) => p.id)
  const [dealRows, ticketRows, timeline] = await Promise.all([
    ctx.db.select().from(s.deals).where(and(eq(s.deals.orgId, ctx.org.id), eq(s.deals.companyId, id))).orderBy(desc(s.deals.updatedAt)),
    ids.length
      ? ctx.db.select().from(s.tickets).where(and(eq(s.tickets.orgId, ctx.org.id), inArray(s.tickets.contactId, ids))).orderBy(desc(s.tickets.createdAt))
      : Promise.resolve([] as s.Ticket[]),
    ctx.db
      .select()
      .from(s.activities)
      .where(and(eq(s.activities.orgId, ctx.org.id), eq(s.activities.companyId, id)))
      .orderBy(desc(s.activities.occurredAt))
      .limit(50),
  ])
  return { company, people, deals: dealRows, tickets: ticketRows, timeline }
}

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export async function getPipeline(ctx: CrmContext) {
  return ctx.db
    .select({
      id: s.deals.id,
      title: s.deals.title,
      stage: s.deals.stage,
      value: s.deals.value,
      probability: s.deals.probability,
      position: s.deals.position,
      nextStep: s.deals.nextStep,
      lostReason: s.deals.lostReason,
      expectedCloseAt: s.deals.expectedCloseAt,
      stageChangedAt: s.deals.stageChangedAt,
      ownerId: s.deals.ownerId,
      companyId: s.deals.companyId,
      contactId: s.deals.contactId,
      company: s.companies.name,
      contact: s.contacts.name,
    })
    .from(s.deals)
    .leftJoin(s.companies, eq(s.companies.id, s.deals.companyId))
    .leftJoin(s.contacts, eq(s.contacts.id, s.deals.contactId))
    .where(eq(s.deals.orgId, ctx.org.id))
    .orderBy(asc(s.deals.position))
}

export type PipelineDeal = Awaited<ReturnType<typeof getPipeline>>[number]

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export async function listTickets(ctx: CrmContext, f: { status?: string; view?: string; priority?: string; q?: string }) {
  const base: SQL[] = [eq(s.tickets.orgId, ctx.org.id)]
  if (f.view === "mine") base.push(eq(s.tickets.assigneeId, ctx.member.id))
  if (f.view === "unassigned") base.push(isNull(s.tickets.assigneeId))
  if (f.priority && s.ticketPriority.enumValues.includes(f.priority as s.TicketPriority)) base.push(eq(s.tickets.priority, f.priority as s.TicketPriority))
  if (f.q) {
    const n = Number(f.q.replace(/^#/, ""))
    base.push(or(ilike(s.tickets.subject, like(f.q)), ilike(s.contacts.name, like(f.q)), ...(Number.isInteger(n) && n > 0 ? [eq(s.tickets.number, n)] : []))!)
  }
  const status = f.status ?? "active"
  const statusFilter =
    status === "active"
      ? inArray(s.tickets.status, ["open", "pending"])
      : status === "all"
        ? undefined
        : s.ticketStatus.enumValues.includes(status as s.TicketStatus)
          ? eq(s.tickets.status, status as s.TicketStatus)
          : undefined

  const [rows, counts] = await Promise.all([
    ctx.db
      .select({
        id: s.tickets.id,
        number: s.tickets.number,
        subject: s.tickets.subject,
        status: s.tickets.status,
        priority: s.tickets.priority,
        channel: s.tickets.channel,
        tags: s.tickets.tags,
        createdAt: s.tickets.createdAt,
        updatedAt: s.tickets.updatedAt,
        dueAt: s.tickets.dueAt,
        firstResponseAt: s.tickets.firstResponseAt,
        assigneeId: s.tickets.assigneeId,
        contact: s.contacts.name,
        preview: sql<string>`(select m.body from ${s.ticketMessages} m where m.ticket_id = "tickets"."id" and m.internal = false order by m.created_at desc limit 1)`,
      })
      .from(s.tickets)
      .leftJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
      .where(and(...base, ...(statusFilter ? [statusFilter] : [])))
      .orderBy(
        sql`case when ${s.tickets.status} in ('open','pending') then 0 else 1 end`,
        sql`case ${s.tickets.priority} when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end`,
        desc(s.tickets.updatedAt)
      )
      .limit(100),
    ctx.db
      .select({ status: s.tickets.status, n: count() })
      .from(s.tickets)
      .leftJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
      .where(and(...base))
      .groupBy(s.tickets.status),
  ])
  return { rows, counts }
}

export type TicketRow = Awaited<ReturnType<typeof listTickets>>["rows"][number]

export async function getTicketThread(ctx: CrmContext, id: string) {
  const [row] = await ctx.db
    .select({ ticket: s.tickets, contact: s.contacts, company: s.companies })
    .from(s.tickets)
    .leftJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(and(eq(s.tickets.id, id), eq(s.tickets.orgId, ctx.org.id)))
    .limit(1)
  if (!row) return null
  const [messages, otherTickets] = await Promise.all([
    ctx.db.select().from(s.ticketMessages).where(eq(s.ticketMessages.ticketId, id)).orderBy(asc(s.ticketMessages.createdAt)),
    row.contact
      ? ctx.db
          .select({ id: s.tickets.id, number: s.tickets.number, subject: s.tickets.subject, status: s.tickets.status })
          .from(s.tickets)
          .where(and(eq(s.tickets.orgId, ctx.org.id), eq(s.tickets.contactId, row.contact.id), ne(s.tickets.id, id)))
          .orderBy(desc(s.tickets.createdAt))
          .limit(5)
      : Promise.resolve([]),
  ])
  return { ...row, messages, otherTickets }
}

export type TicketThread = NonNullable<Awaited<ReturnType<typeof getTicketThread>>>

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(ctx: CrmContext, f: { view?: string }) {
  const where: SQL[] = [eq(s.tasks.orgId, ctx.org.id)]
  if (f.view !== "team") where.push(eq(s.tasks.assigneeId, ctx.member.id))
  const rows = await ctx.db
    .select({
      task: s.tasks,
      contact: s.contacts.name,
    })
    .from(s.tasks)
    .leftJoin(s.contacts, and(eq(s.tasks.relatedType, "contact"), eq(s.contacts.id, s.tasks.relatedId)))
    .where(and(...where))
    .orderBy(asc(s.tasks.done), sql`${s.tasks.dueAt} asc nulls last`)
    .limit(200)
  return rows.map((r) => ({ ...r.task, contact: r.contact }))
}

export type TaskRow = Awaited<ReturnType<typeof listTasks>>[number]

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getTeamOverview(ctx: CrmContext) {
  const memberRows = await ctx.db.select().from(s.members).where(eq(s.members.orgId, ctx.org.id))
  const [ticketLoad, dealLoad, resolved] = await Promise.all([
    ctx.db
      .select({ id: s.tickets.assigneeId, n: count() })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, ctx.org.id), inArray(s.tickets.status, ["open", "pending"])))
      .groupBy(s.tickets.assigneeId),
    ctx.db
      .select({ id: s.deals.ownerId, value: sql<number>`coalesce(sum(${s.deals.value}),0)::int` })
      .from(s.deals)
      .where(and(eq(s.deals.orgId, ctx.org.id), inArray(s.deals.stage, OPEN_STAGES)))
      .groupBy(s.deals.ownerId),
    ctx.db
      .select({ id: s.tickets.assigneeId, n: count() })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, ctx.org.id), gte(s.tickets.resolvedAt, new Date(Date.now() - 30 * DAY))))
      .groupBy(s.tickets.assigneeId),
  ])
  const order = { owner: 0, admin: 1, manager: 2, agent: 3, viewer: 4 }
  return memberRows
    .map((m) => ({
      ...m,
      openTickets: ticketLoad.find((t) => t.id === m.id)?.n ?? 0,
      pipeline: dealLoad.find((d) => d.id === m.id)?.value ?? 0,
      resolved30d: resolved.find((r) => r.id === m.id)?.n ?? 0,
    }))
    .sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name))
}

export type TeamMember = Awaited<ReturnType<typeof getTeamOverview>>[number]

export async function getMemberProfile(ctx: CrmContext, id: string) {
  const [member] = await ctx.db.select().from(s.members).where(and(eq(s.members.id, id), eq(s.members.orgId, ctx.org.id))).limit(1)
  if (!member) return null
  const since = new Date(Date.now() - 30 * DAY)
  const [tickets, deals, tasks, activity, audit] = await Promise.all([
    ctx.db
      .select({ status: s.tickets.status, createdAt: s.tickets.createdAt, firstResponseAt: s.tickets.firstResponseAt, dueAt: s.tickets.dueAt, csat: s.tickets.csat, resolvedAt: s.tickets.resolvedAt })
      .from(s.tickets)
      .where(and(eq(s.tickets.orgId, ctx.org.id), eq(s.tickets.assigneeId, id))),
    ctx.db
      .select({ stage: s.deals.stage, value: s.deals.value, title: s.deals.title, id: s.deals.id })
      .from(s.deals)
      .where(and(eq(s.deals.orgId, ctx.org.id), eq(s.deals.ownerId, id))),
    ctx.db
      .select({ done: s.tasks.done, dueAt: s.tasks.dueAt })
      .from(s.tasks)
      .where(and(eq(s.tasks.orgId, ctx.org.id), eq(s.tasks.assigneeId, id))),
    ctx.db
      .select()
      .from(s.activities)
      .where(and(eq(s.activities.orgId, ctx.org.id), eq(s.activities.actorId, id)))
      .orderBy(desc(s.activities.occurredAt))
      .limit(15),
    ctx.db
      .select()
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.orgId, ctx.org.id), or(eq(s.auditLogs.actorId, id), eq(s.auditLogs.targetId, id))))
      .orderBy(desc(s.auditLogs.createdAt))
      .limit(10),
  ])
  const responded = tickets.filter((t) => t.firstResponseAt && t.createdAt >= since)
  const rated = tickets.filter((t) => t.csat)
  return {
    member,
    stats: {
      openTickets: tickets.filter((t) => t.status === "open" || t.status === "pending").length,
      resolved30d: tickets.filter((t) => t.resolvedAt && t.resolvedAt >= since).length,
      slaRate: responded.length ? responded.filter((t) => t.dueAt && t.firstResponseAt! <= t.dueAt).length / responded.length : null,
      csat: rated.length ? rated.reduce((n, t) => n + (t.csat ?? 0), 0) / rated.length : null,
      pipeline: deals.filter((d) => OPEN_STAGES.includes(d.stage)).reduce((n, d) => n + d.value, 0),
      won: deals.filter((d) => d.stage === "won").reduce((n, d) => n + d.value, 0),
      openTasks: tasks.filter((t) => !t.done).length,
      overdueTasks: tasks.filter((t) => !t.done && t.dueAt && t.dueAt.getTime() < Date.now()).length,
    },
    deals: deals.filter((d) => OPEN_STAGES.includes(d.stage)).sort((a, b) => b.value - a.value).slice(0, 5),
    activity,
    audit,
  }
}

export const AUDIT_PAGE_SIZE = 30

export async function listAudit(ctx: CrmContext, f: { q?: string; actor?: string; type?: string; page?: number }) {
  const where: SQL[] = [eq(s.auditLogs.orgId, ctx.org.id)]
  if (f.q) where.push(or(ilike(s.auditLogs.summary, like(f.q)), ilike(s.auditLogs.actorName, like(f.q)))!)
  if (f.actor) where.push(eq(s.auditLogs.actorId, f.actor))
  if (f.type) where.push(ilike(s.auditLogs.action, `${f.type.replace(/[%_\\]/g, "")}.%`))
  const page = Math.max(1, f.page ?? 1)
  const [rows, [{ total }]] = await Promise.all([
    ctx.db
      .select()
      .from(s.auditLogs)
      .where(and(...where))
      .orderBy(desc(s.auditLogs.createdAt))
      .limit(AUDIT_PAGE_SIZE)
      .offset((page - 1) * AUDIT_PAGE_SIZE),
    ctx.db.select({ total: count() }).from(s.auditLogs).where(and(...where)),
  ])
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) }
}

export async function listAutomations(ctx: CrmContext) {
  return ctx.db.select().from(s.automations).where(eq(s.automations.orgId, ctx.org.id)).orderBy(desc(s.automations.enabled), asc(s.automations.createdAt))
}

export async function listApiKeys(ctx: CrmContext) {
  return ctx.db
    .select({
      id: s.apiKeys.id,
      name: s.apiKeys.name,
      prefix: s.apiKeys.prefix,
      scopes: s.apiKeys.scopes,
      createdAt: s.apiKeys.createdAt,
      lastUsedAt: s.apiKeys.lastUsedAt,
      revokedAt: s.apiKeys.revokedAt,
      createdBy: s.members.name,
    })
    .from(s.apiKeys)
    .leftJoin(s.members, eq(s.members.id, s.apiKeys.createdById))
    .where(eq(s.apiKeys.orgId, ctx.org.id))
    .orderBy(sql`${s.apiKeys.revokedAt} is not null`, desc(s.apiKeys.createdAt))
}

export async function getNotifications(ctx: CrmContext) {
  const [rows, [{ unread }]] = await Promise.all([
    ctx.db.select().from(s.notifications).where(eq(s.notifications.memberId, ctx.member.id)).orderBy(desc(s.notifications.createdAt)).limit(20),
    ctx.db
      .select({ unread: count() })
      .from(s.notifications)
      .where(and(eq(s.notifications.memberId, ctx.member.id), isNull(s.notifications.readAt))),
  ])
  return { rows, unread }
}

export async function getUsage(ctx: CrmContext) {
  const [[members], [contacts], [tickets], [aiTickets], [automationRuns]] = await Promise.all([
    ctx.db.select({ n: count() }).from(s.members).where(and(eq(s.members.orgId, ctx.org.id), ne(s.members.status, "suspended"))),
    ctx.db.select({ n: count() }).from(s.contacts).where(eq(s.contacts.orgId, ctx.org.id)),
    ctx.db.select({ n: count() }).from(s.tickets).where(and(eq(s.tickets.orgId, ctx.org.id), gte(s.tickets.createdAt, new Date(Date.now() - 30 * DAY)))),
    ctx.db.select({ n: count() }).from(s.ticketMessages).where(and(eq(s.ticketMessages.orgId, ctx.org.id), eq(s.ticketMessages.authorType, "ai"))),
    ctx.db.select({ n: sql<number>`coalesce(sum(${s.automations.runCount}),0)::int` }).from(s.automations).where(eq(s.automations.orgId, ctx.org.id)),
  ])
  return { seats: members.n, contacts: contacts.n, tickets30d: tickets.n, aiActions: aiTickets.n, automationRuns: automationRuns.n }
}
