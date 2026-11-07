import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { and, eq, inArray, sql } from "drizzle-orm"
import { auth } from "@/auth"
import { getDb, type DB } from "@/db"
import * as s from "@/db/schema"
import { newId } from "./ids"
import { can, canImpersonate, PermissionError, type Permission } from "./permissions"
import { DEFAULT_SETTINGS } from "./scoring"
import { buildSeed } from "./seed"

export const VIEW_AS_COOKIE = "lumora_view_as"

export type CrmContext = {
  db: DB
  org: s.Organization
  /** The member whose permissions apply (the impersonated member while "viewing as"). */
  member: s.Member
  /** The person who actually signed in. */
  realMember: s.Member
  impersonating: boolean
}

const hueFor = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7)

/** Inserts in chunks to stay well under Postgres' bind-parameter limit. */
async function insertAll<T extends s.Organization | object>(tx: DB, table: Parameters<DB["insert"]>[0], rows: T[]) {
  for (let i = 0; i < rows.length; i += 200) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rows.length) await tx.insert(table).values(rows.slice(i, i + 200) as any)
  }
}

export async function seedOrganization(db: DB, orgId: string, owner: { id: string; name: string }) {
  const seed = buildSeed({ orgId, owner })
  await insertAll(db, s.members, seed.members)
  await insertAll(db, s.companies, seed.companies)
  await insertAll(db, s.contacts, seed.contacts)
  await insertAll(db, s.deals, seed.deals)
  await insertAll(db, s.tickets, seed.tickets)
  await insertAll(db, s.ticketMessages, seed.ticketMessages)
  await insertAll(db, s.tasks, seed.tasks)
  await insertAll(db, s.activities, seed.activities)
  await insertAll(db, s.automations, seed.automations)
  await insertAll(db, s.notifications, seed.notifications)
  await insertAll(db, s.auditLogs, seed.auditLogs)
}

/**
 * First sign-in: create a private sandbox organization owned by this person and fill it
 * with a realistic team and CRM history, so every visitor can act as an admin without
 * touching anyone else's data.
 */
async function provision(db: DB, user: { identity: string; email: string; name: string }) {
  const orgId = newId("org")
  const ownerId = newId("mem")
  try {
    await db.transaction(async (tx) => {
      await tx.insert(s.organizations).values({ id: orgId, name: "Kitelane", settings: DEFAULT_SETTINGS })
      await tx.insert(s.members).values({
        id: ownerId,
        orgId,
        userId: user.identity,
        name: user.name,
        email: user.email,
        role: "owner",
        status: "active",
        title: "Founder",
        team: "Operations",
        avatarHue: hueFor(user.email),
        signature: `${user.name}\nKitelane`,
        lastActiveAt: new Date(),
      })
      await seedOrganization(tx as unknown as DB, orgId, { id: ownerId, name: user.name })
    })
  } catch (error) {
    // Two requests raced to provision the same person; the other one won.
    const [existing] = await db.select().from(s.members).where(eq(s.members.userId, user.identity)).limit(1)
    if (!existing) throw error
  }
}

async function loadMembership(db: DB, identity: string) {
  const [row] = await db
    .select({ member: s.members, org: s.organizations })
    .from(s.members)
    .innerJoin(s.organizations, eq(s.organizations.id, s.members.orgId))
    .where(eq(s.members.userId, identity))
    .limit(1)
  return row
}

/** Resolves the signed-in member and organization once per request. Null when signed out. */
export const getContext = cache(async (): Promise<CrmContext | null> => {
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return null
  const identity = session?.user?.id ?? email
  const name = session?.user?.name?.trim() || email.split("@")[0]

  const db = await getDb()
  let row = await loadMembership(db, identity)
  if (!row) {
    await provision(db, { identity, email, name })
    row = await loadMembership(db, identity)
  }
  if (!row || row.member.status === "suspended") return null

  const realMember = row.member
  let member = realMember
  const viewAs = (await cookies()).get(VIEW_AS_COOKIE)?.value
  if (viewAs && viewAs !== realMember.id) {
    const [target] = await db
      .select()
      .from(s.members)
      .where(and(eq(s.members.id, viewAs), eq(s.members.orgId, realMember.orgId)))
      .limit(1)
    if (target && canImpersonate(realMember, target)) member = target
  }

  // Keep "last active" fresh without writing on every request.
  const stale = !realMember.lastActiveAt || Date.now() - realMember.lastActiveAt.getTime() > 5 * 60_000
  if (stale) {
    const now = new Date()
    await Promise.all([
      db.update(s.members).set({ lastActiveAt: now }).where(eq(s.members.id, realMember.id)),
      db.update(s.organizations).set({ lastActiveAt: now }).where(eq(s.organizations.id, realMember.orgId)),
    ])
  }

  return { db, org: row.org, member, realMember, impersonating: member.id !== realMember.id }
})

export async function requireContext(permission: Permission = "crm:read") {
  const ctx = await getContext()
  if (!ctx) throw new PermissionError("Please sign in again.")
  if (!can(ctx.member.role, permission)) throw new PermissionError()
  return ctx
}

export async function recordAudit(
  ctx: CrmContext & { via?: string },
  entry: {
    action: string
    targetType: string
    targetId?: string | null
    summary: string
    changes?: Record<string, { from: unknown; to: unknown }>
  }
) {
  await ctx.db.insert(s.auditLogs).values({
    id: newId("aud"),
    orgId: ctx.org.id,
    actorId: ctx.member.id,
    actorName: ctx.via ? `${ctx.member.name} · ${ctx.via}` : ctx.member.name,
    impersonatorName: ctx.impersonating ? ctx.realMember.name : null,
    ...entry,
  })
}

export async function notify(
  ctx: Pick<CrmContext, "db" | "org" | "member">,
  memberIds: (string | null | undefined)[],
  n: { kind: string; title: string; body?: string; href?: string }
) {
  const targets = [...new Set(memberIds.filter((id): id is string => Boolean(id) && id !== ctx.member.id))]
  if (!targets.length) return
  const active = await ctx.db
    .select({ id: s.members.id })
    .from(s.members)
    .where(and(eq(s.members.orgId, ctx.org.id), inArray(s.members.id, targets), eq(s.members.status, "active")))
  if (!active.length) return
  await ctx.db.insert(s.notifications).values(active.map((m) => ({ id: newId("ntf"), orgId: ctx.org.id, memberId: m.id, ...n })))
}

export async function logActivity(
  ctx: Pick<CrmContext, "db" | "org" | "member">,
  a: Omit<typeof s.activities.$inferInsert, "id" | "orgId">
) {
  await ctx.db.insert(s.activities).values({ id: newId("act"), orgId: ctx.org.id, actorId: ctx.member.id, ...a })
  if (a.contactId) {
    await ctx.db
      .update(s.contacts)
      .set({ lastActivityAt: sql`greatest(${s.contacts.lastActivityAt}, now())` })
      .where(and(eq(s.contacts.id, a.contactId), eq(s.contacts.orgId, ctx.org.id)))
  }
}

/** Wipes the org's CRM data and reseeds it, keeping the signed-in owner. */
export async function resetOrganization(ctx: CrmContext) {
  const { db, org, realMember } = ctx
  await db.transaction(async (tx) => {
    for (const table of [
      s.notifications,
      s.auditLogs,
      s.activities,
      s.tasks,
      s.ticketMessages,
      s.tickets,
      s.deals,
      s.contacts,
      s.companies,
      s.automations,
      s.apiKeys,
    ]) {
      await tx.delete(table).where(eq(table.orgId, org.id))
    }
    await tx.delete(s.members).where(and(eq(s.members.orgId, org.id), sql`${s.members.id} <> ${realMember.id}`))
    await tx.update(s.members).set({ role: "owner", status: "active" }).where(eq(s.members.id, realMember.id))
    await tx.update(s.organizations).set({ name: "Kitelane", settings: DEFAULT_SETTINGS }).where(eq(s.organizations.id, org.id))
    await seedOrganization(tx as unknown as DB, org.id, { id: realMember.id, name: realMember.name })
  })
}
