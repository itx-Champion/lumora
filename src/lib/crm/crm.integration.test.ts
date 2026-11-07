import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { and, count, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { beforeAll, describe, expect, it, vi } from "vitest"
import type { DB } from "@/db"
import * as s from "@/db/schema"

// The service layer imports the session helpers; tests build contexts directly instead.
vi.mock("@/auth", () => ({ auth: async () => null }))
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }))

const { seedOrganization } = await import("./context")
const { createContactRecord, createTicketRecord, moveDealRecord, searchCrm } = await import("./services")
const { PermissionError } = await import("./permissions")
const { DEFAULT_SETTINGS } = await import("./scoring")

let db: DB

async function createOrg(orgId: string, ownerId: string) {
  await db.insert(s.organizations).values({ id: orgId, name: "Kitelane", settings: DEFAULT_SETTINGS })
  await db.insert(s.members).values({ id: ownerId, orgId, userId: `${ownerId}@test.dev`, name: "Test Owner", email: `${ownerId}@test.dev`, role: "owner" })
  await seedOrganization(db, orgId, { id: ownerId, name: "Test Owner" })
  const [org] = await db.select().from(s.organizations).where(eq(s.organizations.id, orgId))
  const [member] = await db.select().from(s.members).where(eq(s.members.id, ownerId))
  return { db, org, member, realMember: member, impersonating: false }
}

const memberByName = async (orgId: string, name: string) =>
  (await db.select().from(s.members).where(and(eq(s.members.orgId, orgId), eq(s.members.name, name))))[0]

describe("CRM on a real Postgres (PGlite)", () => {
  let ctx: Awaited<ReturnType<typeof createOrg>>

  beforeAll(async () => {
    const client = new PGlite()
    const pg = drizzle({ client, schema: s })
    await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") })
    db = pg as unknown as DB
    ctx = await createOrg("org_a", "mem_owner_a")
  })

  it("seeds a full sandbox organization", async () => {
    const [[m], [c], [t], [a]] = await Promise.all([
      db.select({ n: count() }).from(s.members).where(eq(s.members.orgId, "org_a")),
      db.select({ n: count() }).from(s.contacts).where(eq(s.contacts.orgId, "org_a")),
      db.select({ n: count() }).from(s.tickets).where(eq(s.tickets.orgId, "org_a")),
      db.select({ n: count() }).from(s.automations).where(eq(s.automations.orgId, "org_a")),
    ])
    expect(m.n).toBe(11)
    expect(c.n).toBeGreaterThan(60)
    expect(t.n).toBe(48)
    expect(a.n).toBe(5)
  })

  it("triages new tickets and runs matching automations", async () => {
    const { ticket, automations } = await createTicketRecord(ctx, {
      subject: "Our admin is locked out",
      body: "She can't log in after enabling 2FA and we need access ASAP.",
      contactEmail: "new.person@prospect.example",
      contactName: "New Person",
      channel: "email",
    })
    expect(ticket.priority).toBe("urgent")
    expect(ticket.number).toBeGreaterThan(1048)
    expect(automations).toContain("Urgent tickets go to the Support lead")
    const priya = await memberByName("org_a", "Priya Raman")
    expect(ticket.assigneeId).toBe(priya.id)
    const [contact] = await db.select().from(s.contacts).where(eq(s.contacts.email, "new.person@prospect.example"))
    expect(contact.lifecycle).toBe("lead")
    const notes = await db.select().from(s.notifications).where(and(eq(s.notifications.memberId, ctx.member.id), eq(s.notifications.kind, "automation")))
    expect(notes.length).toBeGreaterThan(0)
  })

  it("routes referral contacts with an automation", async () => {
    const { contact } = await createContactRecord(ctx, { name: "Rhea Kapoor", email: "rhea@lighthouse.example", title: "CTO", source: "referral" })
    const daniel = await memberByName("org_a", "Daniel Kim")
    const [row] = await db.select().from(s.contacts).where(eq(s.contacts.id, contact!.id))
    expect(row.ownerId).toBe(daniel.id)
    expect(row.tags).toContain("referral")
    expect(row.score).toBeGreaterThan(25)
    const again = await createContactRecord(ctx, { name: "Rhea K", email: "RHEA@lighthouse.example" })
    expect(again.duplicateId).toBe(contact!.id)
  })

  it("winning a deal creates an onboarding task and makes the contact a customer", async () => {
    const [deal] = await db.select().from(s.deals).where(and(eq(s.deals.orgId, "org_a"), eq(s.deals.stage, "negotiation"))).limit(1)
    const moved = await moveDealRecord(ctx, deal.id, "won")
    expect(moved.changed).toBe(true)
    const tasks = await db.select().from(s.tasks).where(and(eq(s.tasks.relatedId, deal.id), eq(s.tasks.source, "automation")))
    expect(tasks.map((t) => t.title)).toContain("Kick off onboarding")
    const [contact] = await db.select().from(s.contacts).where(eq(s.contacts.id, deal.contactId!))
    expect(contact.lifecycle).toBe("customer")
    const audit = await db.select().from(s.auditLogs).where(and(eq(s.auditLogs.targetId, deal.id), eq(s.auditLogs.action, "deal.stage_changed")))
    expect(audit).toHaveLength(1)
  })

  it("enforces permissions in the service layer", async () => {
    const viewer = await memberByName("org_a", "Aisha Malik")
    await expect(createTicketRecord({ ...ctx, member: viewer }, { subject: "Test", body: "Should fail" })).rejects.toBeInstanceOf(PermissionError)
  })

  it("keeps organizations isolated", async () => {
    const other = await createOrg("org_b", "mem_owner_b")
    await createContactRecord(other, { name: "Zed Isolation", email: "zed@isolated.example" })
    expect((await searchCrm(other, "Zed Isolation")).contacts).toHaveLength(1)
    expect((await searchCrm(ctx, "Zed Isolation")).contacts).toHaveLength(0)
  })
})
