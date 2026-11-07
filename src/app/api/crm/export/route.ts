import { desc, eq } from "drizzle-orm"
import * as s from "@/db/schema"
import { getContext } from "@/lib/crm/context"
import { toCsv } from "@/lib/crm/csv"
import { can } from "@/lib/crm/permissions"

/** CSV export of CRM data and the audit log, scoped to the signed-in member's organization. */
export async function GET(req: Request) {
  const ctx = await getContext()
  if (!ctx) return new Response("Sign in required", { status: 401 })
  const type = new URL(req.url).searchParams.get("type")
  const { db, org } = ctx
  const members = await db.select({ id: s.members.id, name: s.members.name }).from(s.members).where(eq(s.members.orgId, org.id))
  const name = (id: string | null) => members.find((m) => m.id === id)?.name ?? ""

  let csv: string
  if (type === "contacts") {
    const rows = await db
      .select({ c: s.contacts, company: s.companies.name })
      .from(s.contacts)
      .leftJoin(s.companies, eq(s.companies.id, s.contacts.companyId))
      .where(eq(s.contacts.orgId, org.id))
      .orderBy(desc(s.contacts.score))
    csv = toCsv(
      ["Name", "Email", "Title", "Company", "Phone", "Lifecycle", "Lead score", "Source", "Owner", "Tags", "Last activity", "Created"],
      rows.map(({ c, company }) => [c.name, c.email, c.title, company, c.phone, c.lifecycle, c.score, c.source, name(c.ownerId), c.tags, c.lastActivityAt, c.createdAt])
    )
  } else if (type === "deals") {
    const rows = await db
      .select({ d: s.deals, company: s.companies.name })
      .from(s.deals)
      .leftJoin(s.companies, eq(s.companies.id, s.deals.companyId))
      .where(eq(s.deals.orgId, org.id))
      .orderBy(desc(s.deals.value))
    csv = toCsv(
      ["Deal", "Company", "Stage", "Value (USD)", "Probability", "Owner", "Expected close", "Next step", "Lost reason", "Created"],
      rows.map(({ d, company }) => [d.title, company, d.stage, d.value, d.probability, name(d.ownerId), d.expectedCloseAt, d.nextStep, d.lostReason, d.createdAt])
    )
  } else if (type === "tickets") {
    const rows = await db
      .select({ t: s.tickets, contact: s.contacts.email })
      .from(s.tickets)
      .leftJoin(s.contacts, eq(s.contacts.id, s.tickets.contactId))
      .where(eq(s.tickets.orgId, org.id))
      .orderBy(desc(s.tickets.number))
    csv = toCsv(
      ["Number", "Subject", "Customer", "Status", "Priority", "Team", "Assignee", "Channel", "Tags", "CSAT", "Created", "First response", "Resolved", "SLA due"],
      rows.map(({ t, contact }) => [t.number, t.subject, contact, t.status, t.priority, t.team, name(t.assigneeId), t.channel, t.tags, t.csat, t.createdAt, t.firstResponseAt, t.resolvedAt, t.dueAt])
    )
  } else if (type === "audit") {
    if (!can(ctx.member.role, "audit:read")) return new Response("Forbidden", { status: 403 })
    const rows = await db.select().from(s.auditLogs).where(eq(s.auditLogs.orgId, org.id)).orderBy(desc(s.auditLogs.createdAt))
    csv = toCsv(
      ["Time", "Actor", "Impersonated by", "Action", "Target", "Summary", "Changes"],
      rows.map((a) => [a.createdAt, a.actorName, a.impersonatorName, a.action, a.targetType, a.summary, a.changes ? JSON.stringify(a.changes) : ""])
    )
  } else {
    return new Response("Unknown export type", { status: 400 })
  }

  const file = `${org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${type}-${new Date().toISOString().slice(0, 10)}.csv`
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${file}"`,
      "cache-control": "no-store",
    },
  })
}
