"use server"

import { cookies } from "next/headers"
import { and, count, eq, inArray, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { TRIGGERS } from "../automation-engine"
import { getContext, notify, recordAudit, requireContext, resetOrganization, VIEW_AS_COOKIE } from "../context"
import { hashApiKey, generateApiKey } from "../api-keys"
import { newId } from "../ids"
import { canImpersonate, memberChangeError, roleInfo } from "../permissions"
import { run, UserError } from "./run"

const id = z.string().min(3).max(40)
const role = z.enum(s.memberRole.enumValues)

// Members -------------------------------------------------------------------

const inviteInput = z.object({
  name: z.string().trim().min(2, "Enter their name").max(80),
  email: z.email("Enter a valid email").max(120),
  role,
  team: z.enum(["Support", "Sales", "Success", "Engineering", "Operations"]),
  title: z.string().trim().max(80).optional(),
})

export async function inviteMember(input: z.input<typeof inviteInput>) {
  return run(async () => {
    const ctx = await requireContext("members:manage")
    const data = inviteInput.parse(input)
    const error = memberChangeError(ctx.member, { id: "new", role: "viewer" }, { role: data.role }, 2)
    if (error) throw new UserError(error)
    const email = data.email.toLowerCase()
    const [{ seats }] = await ctx.db
      .select({ seats: count() })
      .from(s.members)
      .where(and(eq(s.members.orgId, ctx.org.id), inArray(s.members.status, ["active", "invited"])))
    if (seats >= ctx.org.settings.seats) throw new UserError(`All ${ctx.org.settings.seats} seats are in use. Remove someone or raise the seat limit.`)
    const [existing] = await ctx.db.select({ id: s.members.id }).from(s.members).where(and(eq(s.members.orgId, ctx.org.id), eq(s.members.email, email)))
    if (existing) throw new UserError("That person is already a member or has a pending invite.")
    const [member] = await ctx.db
      .insert(s.members)
      .values({
        id: newId("mem"),
        orgId: ctx.org.id,
        name: data.name,
        email,
        role: data.role,
        team: data.team,
        title: data.title || null,
        status: "invited",
        invitedById: ctx.member.id,
        avatarHue: Math.floor(Math.random() * 360),
      })
      .returning()
    await recordAudit(ctx, { action: "member.invited", targetType: "member", targetId: member.id, summary: `Invited ${member.name} (${member.email}) as ${roleInfo[member.role].label}` })
    return { id: member.id }
  })
}

const memberPatch = z.object({
  role: role.optional(),
  status: z.enum(["active", "suspended"]).optional(),
  team: z.enum(["Support", "Sales", "Success", "Engineering", "Operations"]).optional(),
  title: z.string().trim().max(80).optional(),
})

async function ownerCount(ctx: Awaited<ReturnType<typeof requireContext>>) {
  const [{ n }] = await ctx.db
    .select({ n: count() })
    .from(s.members)
    .where(and(eq(s.members.orgId, ctx.org.id), eq(s.members.role, "owner"), eq(s.members.status, "active")))
  return n
}

export async function updateMember(memberId: string, patch: z.input<typeof memberPatch>) {
  return run(async () => {
    const ctx = await requireContext("members:manage")
    const data = memberPatch.parse(patch)
    const [target] = await ctx.db.select().from(s.members).where(and(eq(s.members.id, memberId), eq(s.members.orgId, ctx.org.id)))
    if (!target) throw new UserError("Member not found.")
    if (data.role || data.status) {
      const error = memberChangeError(ctx.member, target, { role: data.role, status: data.status === "suspended" ? "suspended" : undefined }, await ownerCount(ctx))
      if (error) throw new UserError(error)
    }
    await ctx.db.update(s.members).set(data).where(eq(s.members.id, memberId))

    if (data.role && data.role !== target.role) {
      await recordAudit(ctx, {
        action: "member.role_changed",
        targetType: "member",
        targetId: memberId,
        summary: `Changed ${target.name}'s role from ${roleInfo[target.role].label} to ${roleInfo[data.role].label}`,
        changes: { role: { from: target.role, to: data.role } },
      })
      await notify(ctx, [memberId], { kind: "member", title: `Your role is now ${roleInfo[data.role].label}`, href: "/app/profile" })
    }
    if (data.status && data.status !== target.status) {
      await recordAudit(ctx, {
        action: data.status === "suspended" ? "member.suspended" : "member.reactivated",
        targetType: "member",
        targetId: memberId,
        summary: `${data.status === "suspended" ? "Suspended" : "Reactivated"} ${target.name}`,
      })
      if (data.status === "suspended") {
        // Hand their open tickets back to the queue so nothing is stranded.
        await ctx.db
          .update(s.tickets)
          .set({ assigneeId: null })
          .where(and(eq(s.tickets.orgId, ctx.org.id), eq(s.tickets.assigneeId, memberId), inArray(s.tickets.status, ["open", "pending"])))
      }
    }
    if (data.team || data.title !== undefined) {
      await recordAudit(ctx, { action: "member.updated", targetType: "member", targetId: memberId, summary: `Updated ${target.name}'s profile` })
    }
    return null
  })
}

export async function removeMember(memberId: string) {
  return run(async () => {
    const ctx = await requireContext("members:manage")
    const [target] = await ctx.db.select().from(s.members).where(and(eq(s.members.id, memberId), eq(s.members.orgId, ctx.org.id)))
    if (!target) throw new UserError("Member not found.")
    const error = memberChangeError(ctx.member, target, { status: "removed" }, await ownerCount(ctx))
    if (error) throw new UserError(error)
    if (target.userId) throw new UserError("This member signs in with their own account. Suspend them instead.")
    await ctx.db.delete(s.members).where(eq(s.members.id, memberId))
    await recordAudit(ctx, {
      action: target.status === "invited" ? "member.invite_revoked" : "member.removed",
      targetType: "member",
      targetId: memberId,
      summary: target.status === "invited" ? `Revoked the invite for ${target.name}` : `Removed ${target.name} from the organization`,
    })
    return null
  })
}

/** Demo-only: marks a pending invite as accepted, since invite emails aren't sent from the sandbox. */
export async function acceptInvite(memberId: string) {
  return run(async () => {
    const ctx = await requireContext("members:manage")
    const [target] = await ctx.db
      .update(s.members)
      .set({ status: "active", lastActiveAt: new Date() })
      .where(and(eq(s.members.id, memberId), eq(s.members.orgId, ctx.org.id), eq(s.members.status, "invited")))
      .returning()
    if (!target) throw new UserError("That invite is no longer pending.")
    await recordAudit(ctx, { action: "member.joined", targetType: "member", targetId: memberId, summary: `${target.name} accepted the invite and joined` })
    return null
  })
}

export async function startViewAs(memberId: string) {
  return run(async () => {
    const ctx = await getContext()
    if (!ctx) throw new UserError("Please sign in again.")
    const [target] = await ctx.db.select().from(s.members).where(and(eq(s.members.id, memberId), eq(s.members.orgId, ctx.org.id)))
    if (!target || !canImpersonate(ctx.realMember, target)) throw new UserError("You can't view the app as this member.")
    ;(await cookies()).set(VIEW_AS_COOKIE, memberId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 })
    await recordAudit({ ...ctx, member: ctx.realMember, impersonating: false }, {
      action: "member.impersonation_started",
      targetType: "member",
      targetId: memberId,
      summary: `Started viewing the app as ${target.name} (${roleInfo[target.role].label})`,
    })
    return { name: target.name }
  })
}

export async function stopViewAs() {
  return run(async () => {
    const ctx = await getContext()
    ;(await cookies()).delete(VIEW_AS_COOKIE)
    if (ctx?.impersonating) {
      await recordAudit({ ...ctx, member: ctx.realMember, impersonating: false }, {
        action: "member.impersonation_ended",
        targetType: "member",
        targetId: ctx.member.id,
        summary: `Stopped viewing as ${ctx.member.name}`,
      })
    }
    return null
  })
}

// Automations ---------------------------------------------------------------

const conditionSchema = z.object({
  field: z.string().min(1).max(40),
  op: z.enum(["eq", "neq", "contains", "gte", "lte"]),
  value: z.string().trim().min(1, "Give every condition a value").max(80),
})
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign"), memberId: id }),
  z.object({ type: z.literal("round_robin"), team: z.string().min(2).max(30) }),
  z.object({ type: z.literal("set_priority"), priority: z.enum(s.ticketPriority.enumValues) }),
  z.object({ type: z.literal("add_tag"), tag: z.string().trim().min(1, "Enter a tag").max(24) }),
  z.object({ type: z.literal("create_task"), title: z.string().trim().min(2, "Enter a task title").max(120), dueInDays: z.coerce.number().int().min(0).max(60) }),
  z.object({ type: z.literal("notify"), memberId: id, message: z.string().trim().min(2, "Enter a message").max(120) }),
  z.object({ type: z.literal("set_lifecycle"), lifecycle: z.enum(s.lifecycleStage.enumValues) }),
])
const automationInput = z
  .object({
    name: z.string().trim().min(3, "Name the automation").max(80),
    trigger: z.enum(["ticket.created", "deal.stage_changed", "contact.created"]),
    conditions: z.array(conditionSchema).max(5),
    actions: z.array(actionSchema).min(1, "Add at least one action").max(5),
  })
  .superRefine((a, ctx) => {
    const t = TRIGGERS[a.trigger]
    a.conditions.forEach((c, i) => {
      if (!t.fields.some((f) => f.id === c.field)) ctx.addIssue({ code: "custom", message: `“${c.field}” isn't available for this trigger`, path: ["conditions", i] })
    })
    a.actions.forEach((act, i) => {
      if (!t.actions.includes(act.type)) ctx.addIssue({ code: "custom", message: `That action isn't available for this trigger`, path: ["actions", i] })
    })
  })

export async function saveAutomation(automationId: string | null, input: z.input<typeof automationInput>) {
  return run(async () => {
    const ctx = await requireContext("automations:manage")
    const data = automationInput.parse(input)
    if (automationId) {
      const [updated] = await ctx.db
        .update(s.automations)
        .set(data)
        .where(and(eq(s.automations.id, automationId), eq(s.automations.orgId, ctx.org.id)))
        .returning()
      if (!updated) throw new UserError("Automation not found.")
      await recordAudit(ctx, { action: "automation.updated", targetType: "automation", targetId: automationId, summary: `Updated “${data.name}”` })
      return { id: automationId }
    }
    const [created] = await ctx.db
      .insert(s.automations)
      .values({ id: newId("auto"), orgId: ctx.org.id, ...data, createdById: ctx.member.id })
      .returning()
    await recordAudit(ctx, { action: "automation.created", targetType: "automation", targetId: created.id, summary: `Created “${data.name}”` })
    return { id: created.id }
  })
}

export async function toggleAutomation(automationId: string, enabled: boolean) {
  return run(async () => {
    const ctx = await requireContext("automations:manage")
    const [row] = await ctx.db
      .update(s.automations)
      .set({ enabled })
      .where(and(eq(s.automations.id, automationId), eq(s.automations.orgId, ctx.org.id)))
      .returning()
    if (!row) throw new UserError("Automation not found.")
    await recordAudit(ctx, { action: enabled ? "automation.enabled" : "automation.disabled", targetType: "automation", targetId: automationId, summary: `${enabled ? "Turned on" : "Paused"} “${row.name}”` })
    return null
  })
}

export async function deleteAutomation(automationId: string) {
  return run(async () => {
    const ctx = await requireContext("automations:manage")
    const [row] = await ctx.db
      .delete(s.automations)
      .where(and(eq(s.automations.id, automationId), eq(s.automations.orgId, ctx.org.id)))
      .returning()
    if (!row) throw new UserError("Automation not found.")
    await recordAudit(ctx, { action: "automation.deleted", targetType: "automation", targetId: automationId, summary: `Deleted “${row.name}”` })
    return null
  })
}

// API keys ------------------------------------------------------------------

const apiKeyInput = z.object({
  name: z.string().trim().min(2, "Name the key").max(60),
  scopes: z.array(z.enum(["crm:read", "crm:write"])).min(1, "Pick at least one scope"),
})

export async function createApiKey(input: z.input<typeof apiKeyInput>) {
  return run(async () => {
    const ctx = await requireContext("api-keys:manage")
    const data = apiKeyInput.parse(input)
    const [{ active }] = await ctx.db
      .select({ active: count() })
      .from(s.apiKeys)
      .where(and(eq(s.apiKeys.orgId, ctx.org.id), isNull(s.apiKeys.revokedAt)))
    if (active >= 10) throw new UserError("Revoke an unused key first (10 active keys max).")
    const key = generateApiKey()
    await ctx.db.insert(s.apiKeys).values({
      id: newId("key"),
      orgId: ctx.org.id,
      name: data.name,
      prefix: key.slice(0, 12),
      hash: await hashApiKey(key),
      scopes: data.scopes,
      createdById: ctx.member.id,
    })
    await recordAudit(ctx, { action: "api_key.created", targetType: "api_key", summary: `Created API key “${data.name}” (${data.scopes.join(", ")})` })
    // Returned once. Only the hash is stored.
    return { key }
  })
}

export async function revokeApiKey(keyId: string) {
  return run(async () => {
    const ctx = await requireContext("api-keys:manage")
    const [row] = await ctx.db
      .update(s.apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(s.apiKeys.id, keyId), eq(s.apiKeys.orgId, ctx.org.id), isNull(s.apiKeys.revokedAt)))
      .returning()
    if (!row) throw new UserError("Key not found or already revoked.")
    await recordAudit(ctx, { action: "api_key.revoked", targetType: "api_key", targetId: keyId, summary: `Revoked API key “${row.name}”` })
    return null
  })
}

// Organization --------------------------------------------------------------

const hours = z.coerce.number().int().min(1).max(240)
const orgInput = z.object({
  name: z.string().trim().min(2, "Enter an organization name").max(60),
  slaHours: z.object({ urgent: hours, high: hours, normal: hours, low: hours }),
  autoTriage: z.boolean(),
  autoAssign: z.boolean(),
  seats: z.coerce.number().int().min(1).max(100),
})

export async function updateOrganization(input: z.input<typeof orgInput>) {
  return run(async () => {
    const ctx = await requireContext("org:manage")
    const data = orgInput.parse(input)
    const before = ctx.org
    const settings: s.OrgSettings = { ...before.settings, slaHours: data.slaHours, autoTriage: data.autoTriage, autoAssign: data.autoAssign, seats: data.seats }
    await ctx.db.update(s.organizations).set({ name: data.name, settings }).where(eq(s.organizations.id, ctx.org.id))
    const changed: string[] = []
    if (data.name !== before.name) changed.push(`name to “${data.name}”`)
    for (const p of ["urgent", "high", "normal", "low"] as const) {
      if (data.slaHours[p] !== before.settings.slaHours[p]) changed.push(`${p} SLA from ${before.settings.slaHours[p]}h to ${data.slaHours[p]}h`)
    }
    if (data.autoTriage !== before.settings.autoTriage) changed.push(`AI triage ${data.autoTriage ? "on" : "off"}`)
    if (data.autoAssign !== before.settings.autoAssign) changed.push(`auto-assign ${data.autoAssign ? "on" : "off"}`)
    if (data.seats !== before.settings.seats) changed.push(`seats to ${data.seats}`)
    if (changed.length) {
      await recordAudit(ctx, { action: "org.settings_updated", targetType: "organization", targetId: ctx.org.id, summary: `Changed ${changed.join(", ")}` })
    }
    return null
  })
}

export async function resetDemoData() {
  return run(async () => {
    const ctx = await requireContext("org:manage")
    if (!ctx.org.isSandbox) throw new UserError("Only demo organizations can be reset.")
    if (ctx.impersonating) throw new UserError("Stop viewing as another member first.")
    ;(await cookies()).delete(VIEW_AS_COOKIE)
    await resetOrganization(ctx)
    return null
  })
}

// Profile -------------------------------------------------------------------

const profileInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  title: z.string().trim().max(80).optional(),
  timezone: z.string().trim().min(1).max(60),
  avatarHue: z.coerce.number().int().min(0).max(359),
  signature: z.string().trim().max(400).optional(),
  prefs: z.object({ assignments: z.boolean(), mentions: z.boolean(), slaAlerts: z.boolean(), weeklyDigest: z.boolean() }),
})

export async function updateProfile(input: z.input<typeof profileInput>) {
  return run(async () => {
    const ctx = await requireContext("crm:read")
    if (ctx.impersonating) throw new UserError("You can't edit someone else's profile while viewing as them.")
    const data = profileInput.parse(input)
    await ctx.db
      .update(s.members)
      .set({ ...data, title: data.title || null, signature: data.signature || null })
      .where(eq(s.members.id, ctx.member.id))
    return null
  })
}

// Notifications -------------------------------------------------------------

export async function markNotificationsRead(ids?: string[]) {
  return run(async () => {
    const ctx = await requireContext("crm:read")
    const where = and(eq(s.notifications.memberId, ctx.member.id), isNull(s.notifications.readAt))
    await ctx.db
      .update(s.notifications)
      .set({ readAt: new Date() })
      .where(ids?.length ? and(where, inArray(s.notifications.id, z.array(id).max(50).parse(ids))) : where)
    return null
  })
}

export async function pollNotifications() {
  return run(
    async () => {
      const ctx = await requireContext("crm:read")
      const rows = await ctx.db
        .select()
        .from(s.notifications)
        .where(eq(s.notifications.memberId, ctx.member.id))
        .orderBy(sql`${s.notifications.createdAt} desc`)
        .limit(20)
      return { rows, unread: rows.filter((r) => !r.readAt).length }
    },
    { revalidate: false }
  )
}
