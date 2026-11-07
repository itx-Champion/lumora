"use server"

import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { logActivity, notify, recordAudit, requireContext } from "../context"
import { newId } from "../ids"
import { can } from "../permissions"
import { createContactRecord, createTaskRecord, createTicketRecord, moveDealRecord, rescoreContact, searchCrm } from "../services"
import { run, UserError } from "./run"

const id = z.string().min(3).max(40)
const lifecycle = z.enum(s.lifecycleStage.enumValues)
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => v || null)

// Contacts ------------------------------------------------------------------

const contactInput = z.object({
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.email("Enter a valid email").max(120),
  title: optionalText(80),
  phone: optionalText(40),
  companyName: optionalText(80),
  source: z.enum(["website", "referral", "event", "outbound", "chat", "import", "api"]).default("website"),
  lifecycle: lifecycle.default("lead"),
  ownerId: id.optional().nullable(),
})

export async function createContact(input: z.input<typeof contactInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = contactInput.parse(input)
    const { contact, duplicateId } = await createContactRecord(ctx, data)
    if (!contact) throw new UserError(`A contact with that email already exists (${duplicateId}).`)
    return { id: contact.id }
  })
}

const contactPatch = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email().max(120).optional(),
  title: optionalText(80),
  phone: optionalText(40),
  lifecycle: lifecycle.optional(),
  ownerId: id.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional(),
})

export async function updateContact(contactId: string, patch: z.input<typeof contactPatch>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = contactPatch.parse(patch)
    const [before] = await ctx.db.select().from(s.contacts).where(and(eq(s.contacts.id, contactId), eq(s.contacts.orgId, ctx.org.id)))
    if (!before) throw new UserError("Contact not found.")
    const update = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    if (!Object.keys(update).length) return null
    await ctx.db.update(s.contacts).set(update).where(eq(s.contacts.id, contactId))
    const changes = Object.fromEntries(
      Object.entries(update)
        .filter(([k, v]) => JSON.stringify(before[k as keyof typeof before]) !== JSON.stringify(v))
        .map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }])
    )
    if (Object.keys(changes).length) {
      await recordAudit(ctx, { action: "contact.updated", targetType: "contact", targetId: contactId, summary: `Updated ${before.name} (${Object.keys(changes).join(", ")})`, changes })
      if (changes.lifecycle) await rescoreContact(ctx, contactId)
    }
    return null
  })
}

const bulkPatch = z.object({
  ownerId: id.nullable().optional(),
  lifecycle: lifecycle.optional(),
  addTag: z.string().trim().min(1).max(24).optional(),
})

export async function bulkUpdateContacts(ids: string[], patch: z.input<typeof bulkPatch>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const list = z.array(id).min(1).max(200).parse(ids)
    const data = bulkPatch.parse(patch)
    const where = and(eq(s.contacts.orgId, ctx.org.id), inArray(s.contacts.id, list))
    if (data.ownerId !== undefined) await ctx.db.update(s.contacts).set({ ownerId: data.ownerId }).where(where)
    if (data.lifecycle) await ctx.db.update(s.contacts).set({ lifecycle: data.lifecycle }).where(where)
    if (data.addTag) {
      await ctx.db
        .update(s.contacts)
        .set({ tags: sql`(select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from jsonb_array_elements_text(${s.contacts.tags} || ${JSON.stringify([data.addTag])}::jsonb) t)` })
        .where(where)
    }
    await recordAudit(ctx, { action: "contact.bulk_updated", targetType: "contact", summary: `Bulk-updated ${list.length} contacts (${Object.keys(data).join(", ")})` })
    return { count: list.length }
  })
}

export async function deleteContacts(ids: string[]) {
  return run(async () => {
    const ctx = await requireContext("crm:delete")
    const list = z.array(id).min(1).max(200).parse(ids)
    const removed = await ctx.db
      .delete(s.contacts)
      .where(and(eq(s.contacts.orgId, ctx.org.id), inArray(s.contacts.id, list)))
      .returning({ name: s.contacts.name })
    await recordAudit(ctx, {
      action: "contact.deleted",
      targetType: "contact",
      summary: removed.length === 1 ? `Deleted contact ${removed[0].name}` : `Deleted ${removed.length} contacts`,
    })
    return { count: removed.length }
  })
}

const importRow = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(120),
  title: z.string().trim().max(80).optional(),
  company: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
})

export async function importContacts(rows: unknown[]) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    if (!Array.isArray(rows) || rows.length === 0) throw new UserError("The file has no rows.")
    if (rows.length > 500) throw new UserError("Import up to 500 contacts at a time.")
    let created = 0
    let duplicates = 0
    let invalid = 0
    for (const raw of rows) {
      const parsed = importRow.safeParse(raw)
      if (!parsed.success) {
        invalid++
        continue
      }
      const { contact } = await createContactRecord(
        ctx,
        { ...parsed.data, companyName: parsed.data.company, source: "import" },
        { audit: false }
      )
      if (contact) created++
      else duplicates++
    }
    await recordAudit(ctx, { action: "contact.imported", targetType: "contact", summary: `Imported ${created} contacts from CSV (${duplicates} duplicates, ${invalid} invalid rows skipped)` })
    return { created, duplicates, invalid }
  })
}

const activityInput = z.object({
  type: z.enum(["note", "call", "email", "meeting"]),
  title: z.string().trim().min(2, "Add a short title").max(120),
  body: optionalText(4000),
})

export async function logContactActivity(contactId: string, input: z.input<typeof activityInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = activityInput.parse(input)
    const [contact] = await ctx.db.select().from(s.contacts).where(and(eq(s.contacts.id, contactId), eq(s.contacts.orgId, ctx.org.id)))
    if (!contact) throw new UserError("Contact not found.")
    await logActivity(ctx, { ...data, subjectType: "contact", subjectId: contactId, contactId, companyId: contact.companyId })
    await rescoreContact(ctx, contactId)
    return null
  })
}

export async function recalculateScore(contactId: string) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    return rescoreContact(ctx, contactId)
  })
}

// Companies -----------------------------------------------------------------

const companyInput = z.object({
  name: z.string().trim().min(2, "Enter a company name").max(80),
  domain: optionalText(80),
  industry: optionalText(60),
  size: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"]).optional().nullable(),
  country: optionalText(60),
  ownerId: id.optional().nullable(),
})

export async function createCompany(input: z.input<typeof companyInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = companyInput.parse(input)
    const [company] = await ctx.db
      .insert(s.companies)
      .values({ id: newId("co"), orgId: ctx.org.id, ...data, ownerId: data.ownerId ?? ctx.member.id })
      .returning()
    await recordAudit(ctx, { action: "company.created", targetType: "company", targetId: company.id, summary: `Created company ${company.name}` })
    return { id: company.id }
  })
}

export async function updateCompany(companyId: string, patch: Partial<z.input<typeof companyInput>>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = companyInput.partial().parse(patch)
    const update = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    await ctx.db.update(s.companies).set(update).where(and(eq(s.companies.id, companyId), eq(s.companies.orgId, ctx.org.id)))
    await recordAudit(ctx, { action: "company.updated", targetType: "company", targetId: companyId, summary: `Updated company (${Object.keys(update).join(", ")})` })
    return null
  })
}

export async function deleteCompany(companyId: string) {
  return run(async () => {
    const ctx = await requireContext("crm:delete")
    const [removed] = await ctx.db
      .delete(s.companies)
      .where(and(eq(s.companies.id, companyId), eq(s.companies.orgId, ctx.org.id)))
      .returning({ name: s.companies.name })
    if (!removed) throw new UserError("Company not found.")
    await recordAudit(ctx, { action: "company.deleted", targetType: "company", targetId: companyId, summary: `Deleted company ${removed.name}` })
    return null
  })
}

// Deals ---------------------------------------------------------------------

const dealInput = z.object({
  title: z.string().trim().min(3, "Give the deal a name").max(120),
  value: z.coerce.number().int().min(0).max(100_000_000),
  stage: z.enum(s.dealStage.enumValues).default("new"),
  companyId: id.optional().nullable(),
  contactId: id.optional().nullable(),
  ownerId: id.optional().nullable(),
  expectedCloseAt: z.coerce.date().optional().nullable(),
  nextStep: optionalText(160),
})

export async function createDeal(input: z.input<typeof dealInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = dealInput.parse(input)
    const [deal] = await ctx.db
      .insert(s.deals)
      .values({ id: newId("deal"), orgId: ctx.org.id, ...data, ownerId: data.ownerId ?? ctx.member.id, position: Date.now() / 1000 })
      .returning()
    await logActivity(ctx, { type: "stage_change", subjectType: "deal", subjectId: deal.id, contactId: deal.contactId, companyId: deal.companyId, title: `Created deal ${deal.title}` })
    await recordAudit(ctx, { action: "deal.created", targetType: "deal", targetId: deal.id, summary: `Created deal “${deal.title}” ($${deal.value.toLocaleString()})` })
    return { id: deal.id }
  })
}

export async function updateDeal(dealId: string, patch: Partial<z.input<typeof dealInput>>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = dealInput.partial().omit({ stage: true }).parse(patch)
    const update = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    const [before] = await ctx.db.select().from(s.deals).where(and(eq(s.deals.id, dealId), eq(s.deals.orgId, ctx.org.id)))
    if (!before) throw new UserError("Deal not found.")
    await ctx.db.update(s.deals).set({ ...update, updatedAt: new Date() }).where(eq(s.deals.id, dealId))
    await recordAudit(ctx, {
      action: "deal.updated",
      targetType: "deal",
      targetId: dealId,
      summary: `Updated “${before.title}” (${Object.keys(update).join(", ")})`,
      changes: Object.fromEntries(Object.entries(update).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }])),
    })
    return null
  })
}

export async function moveDeal(dealId: string, stage: s.DealStage, position: number, lostReason?: string) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    z.enum(s.dealStage.enumValues).parse(stage)
    const deal = await moveDealRecord(ctx, dealId, stage, z.number().finite().parse(position), lostReason?.slice(0, 160))
    return { changed: deal.changed }
  })
}

export async function deleteDeal(dealId: string) {
  return run(async () => {
    const ctx = await requireContext("crm:delete")
    const [removed] = await ctx.db.delete(s.deals).where(and(eq(s.deals.id, dealId), eq(s.deals.orgId, ctx.org.id))).returning({ title: s.deals.title })
    if (!removed) throw new UserError("Deal not found.")
    await recordAudit(ctx, { action: "deal.deleted", targetType: "deal", targetId: dealId, summary: `Deleted deal “${removed.title}”` })
    return null
  })
}

// Tasks ---------------------------------------------------------------------

const taskInput = z.object({
  title: z.string().trim().min(2, "Describe the task").max(160),
  dueAt: z.coerce.date().optional().nullable(),
  assigneeId: id.optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
  relatedType: z.enum(["contact", "company", "deal", "ticket"]).optional(),
  relatedId: id.optional(),
})

export async function createTask(input: z.input<typeof taskInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = taskInput.parse(input)
    const task = await createTaskRecord(ctx, data)
    return { id: task.id }
  })
}

export async function toggleTask(taskId: string, done: boolean) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const [task] = await ctx.db
      .update(s.tasks)
      .set({ done, completedAt: done ? new Date() : null })
      .where(and(eq(s.tasks.id, taskId), eq(s.tasks.orgId, ctx.org.id)))
      .returning()
    if (!task) throw new UserError("Task not found.")
    if (done && task.relatedType === "contact" && task.relatedId) {
      await logActivity(ctx, { type: "task", subjectType: "contact", subjectId: task.relatedId, contactId: task.relatedId, title: `Completed task: ${task.title}` })
    }
    return null
  })
}

export async function deleteTask(taskId: string) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    await ctx.db.delete(s.tasks).where(and(eq(s.tasks.id, taskId), eq(s.tasks.orgId, ctx.org.id)))
    return null
  })
}

// Tickets -------------------------------------------------------------------

const ticketInput = z.object({
  subject: z.string().trim().min(4, "Add a subject").max(160),
  body: z.string().trim().min(4, "Describe the issue").max(5000),
  contactEmail: z.email("Enter the customer's email").max(120),
  contactName: optionalText(80),
  priority: z.enum(s.ticketPriority.enumValues).optional(),
  channel: z.enum(["email", "chat", "web", "agent", "api"]).default("web"),
})

export async function createTicket(input: z.input<typeof ticketInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = ticketInput.parse(input)
    const { ticket, automations } = await createTicketRecord(ctx, { ...data, contactName: data.contactName ?? undefined })
    return { id: ticket.id, number: ticket.number, priority: ticket.priority, automations }
  })
}

const replyInput = z.object({
  body: z.string().trim().min(1, "Write a reply").max(8000),
  internal: z.boolean().default(false),
  status: z.enum(s.ticketStatus.enumValues).optional(),
  fromAi: z.boolean().default(false),
})

export async function replyToTicket(ticketId: string, input: z.input<typeof replyInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = replyInput.parse(input)
    const [ticket] = await ctx.db.select().from(s.tickets).where(and(eq(s.tickets.id, ticketId), eq(s.tickets.orgId, ctx.org.id)))
    if (!ticket) throw new UserError("Ticket not found.")
    const now = new Date()
    await ctx.db.insert(s.ticketMessages).values({
      id: newId("msg"),
      orgId: ctx.org.id,
      ticketId,
      authorType: "member",
      authorId: ctx.member.id,
      authorName: ctx.member.name,
      body: data.body,
      internal: data.internal,
      createdAt: now,
    })
    const status = data.status ?? (data.internal ? ticket.status : ticket.status === "open" ? "pending" : ticket.status)
    await ctx.db
      .update(s.tickets)
      .set({
        status,
        updatedAt: now,
        assigneeId: ticket.assigneeId ?? ctx.member.id,
        ...(!data.internal && !ticket.firstResponseAt ? { firstResponseAt: now } : {}),
        ...(status === "resolved" || status === "closed" ? { resolvedAt: ticket.resolvedAt ?? now } : { resolvedAt: null }),
      })
      .where(eq(s.tickets.id, ticketId))
    if (!data.internal && ticket.contactId) {
      await logActivity(ctx, {
        type: "email",
        subjectType: "ticket",
        subjectId: ticketId,
        contactId: ticket.contactId,
        title: `Replied on #${ticket.number}${data.fromAi ? " (AI-drafted)" : ""}`,
        body: data.body.slice(0, 280),
      })
    }
    return { status }
  })
}

const ticketPatch = z.object({
  status: z.enum(s.ticketStatus.enumValues).optional(),
  priority: z.enum(s.ticketPriority.enumValues).optional(),
  assigneeId: id.nullable().optional(),
})

export async function updateTicket(ticketId: string, patch: z.input<typeof ticketPatch>) {
  return run(async () => {
    const ctx = await requireContext("crm:write")
    const data = ticketPatch.parse(patch)
    const [ticket] = await ctx.db.select().from(s.tickets).where(and(eq(s.tickets.id, ticketId), eq(s.tickets.orgId, ctx.org.id)))
    if (!ticket) throw new UserError("Ticket not found.")
    if (data.assigneeId !== undefined && data.assigneeId !== ctx.member.id && !can(ctx.member.role, "tickets:assign")) {
      throw new UserError("Only managers and admins can assign tickets to other people.")
    }
    const now = new Date()
    await ctx.db
      .update(s.tickets)
      .set({
        ...data,
        updatedAt: now,
        ...(data.status === "resolved" || data.status === "closed" ? { resolvedAt: ticket.resolvedAt ?? now } : {}),
        ...(data.status === "open" || data.status === "pending" ? { resolvedAt: null } : {}),
      })
      .where(eq(s.tickets.id, ticketId))
    const changes = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, { from: ticket[k as keyof typeof ticket], to: v }]))
    await recordAudit(ctx, { action: "ticket.updated", targetType: "ticket", targetId: ticketId, summary: `Updated #${ticket.number} (${Object.keys(data).join(", ")})`, changes })
    if (data.assigneeId && data.assigneeId !== ctx.member.id) {
      await notify(ctx, [data.assigneeId], { kind: "assignment", title: `${ctx.member.name} assigned you #${ticket.number}`, body: ticket.subject, href: `/app/crm/inbox?t=${ticketId}` })
    }
    return null
  })
}

// Search --------------------------------------------------------------------

export async function searchCrmAction(query: string) {
  return run(
    async () => {
      const ctx = await requireContext("crm:read")
      return searchCrm(ctx, z.string().max(80).parse(query), 4)
    },
    { revalidate: false }
  )
}
