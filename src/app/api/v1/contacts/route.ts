import { and, desc, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { apiRoute, readJson } from "@/lib/crm/rest"
import { createContactRecord } from "@/lib/crm/services"

export const GET = apiRoute("crm:read", async (req, ctx) => {
  const url = new URL(req.url)
  const q = url.searchParams.get("q")?.slice(0, 80)
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(url.searchParams.get("limit") ?? 20)
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  const rows = await ctx.db
    .select({
      id: s.contacts.id,
      name: s.contacts.name,
      email: s.contacts.email,
      title: s.contacts.title,
      company: s.companies.name,
      lifecycle: s.contacts.lifecycle,
      score: s.contacts.score,
      tags: s.contacts.tags,
      createdAt: s.contacts.createdAt,
    })
    .from(s.contacts)
    .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
    .where(and(eq(s.contacts.orgId, ctx.org.id), like ? or(ilike(s.contacts.name, like), ilike(s.contacts.email, like), ilike(s.companies.name, like)) : undefined))
    .orderBy(desc(s.contacts.score))
    .limit(limit)
  return Response.json({ data: rows })
})

const body = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email(),
  title: z.string().max(80).optional(),
  company: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
})

export const POST = apiRoute("crm:write", async (req, ctx) => {
  const { company, ...input } = body.parse(await readJson(req))
  const { contact, duplicateId } = await createContactRecord(ctx, { ...input, companyName: company, source: "api" })
  if (!contact) return Response.json({ error: "duplicate", existingId: duplicateId }, { status: 409 })
  return Response.json({ data: { id: contact.id, score: contact.score, scoreReasons: contact.scoreReasons } }, { status: 201 })
})
