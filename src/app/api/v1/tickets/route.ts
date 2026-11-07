import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { apiRoute, readJson } from "@/lib/crm/rest"
import { createTicketRecord } from "@/lib/crm/services"

export const GET = apiRoute("crm:read", async (req, ctx) => {
  const url = new URL(req.url)
  const status = z.enum(s.ticketStatus.enumValues).optional().catch(undefined).parse(url.searchParams.get("status") ?? undefined)
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(url.searchParams.get("limit") ?? 20)
  const rows = await ctx.db
    .select({
      id: s.tickets.id,
      number: s.tickets.number,
      subject: s.tickets.subject,
      status: s.tickets.status,
      priority: s.tickets.priority,
      team: s.tickets.team,
      tags: s.tickets.tags,
      customer: s.contacts.email,
      createdAt: s.tickets.createdAt,
      slaDueAt: s.tickets.dueAt,
      firstResponseAt: s.tickets.firstResponseAt,
    })
    .from(s.tickets)
    .leftJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
    .where(and(eq(s.tickets.orgId, ctx.org.id), status ? eq(s.tickets.status, status) : undefined))
    .orderBy(desc(s.tickets.createdAt))
    .limit(limit)
  return Response.json({ data: rows })
})

const body = z.object({
  subject: z.string().trim().min(4).max(160),
  body: z.string().trim().min(4).max(5000),
  contactEmail: z.email().optional(),
  contactName: z.string().max(80).optional(),
  priority: z.enum(s.ticketPriority.enumValues).optional(),
})

export const POST = apiRoute("crm:write", async (req, ctx) => {
  const input = body.parse(await readJson(req))
  const { ticket, automations } = await createTicketRecord(ctx, { ...input, channel: "api" })
  return Response.json(
    { data: { id: ticket.id, number: ticket.number, priority: ticket.priority, team: ticket.team, tags: ticket.tags, assigneeId: ticket.assigneeId, slaDueAt: ticket.dueAt, automationsRan: automations } },
    { status: 201 }
  )
})
