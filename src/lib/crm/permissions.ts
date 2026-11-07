import type { MemberRole } from "@/db/schema"

export const ROLES = ["owner", "admin", "manager", "agent", "viewer"] as const satisfies readonly MemberRole[]

export const roleInfo: Record<MemberRole, { label: string; description: string }> = {
  owner: { label: "Owner", description: "Full access, including billing and ownership transfer." },
  admin: { label: "Admin", description: "Manages members, settings, API keys and all CRM data." },
  manager: { label: "Manager", description: "Runs a team: assigns work, deletes records, builds automations." },
  agent: { label: "Agent", description: "Works tickets, contacts and deals assigned to the team." },
  viewer: { label: "Viewer", description: "Read-only access to CRM data and reports." },
}

/** Single source of truth for authorization. Checked on the server for every mutation. */
export const PERMISSIONS = {
  "org:manage": { label: "Edit organization settings", roles: ["owner", "admin"] },
  "billing:manage": { label: "Manage plan and billing", roles: ["owner"] },
  "members:manage": { label: "Invite, change roles, suspend members", roles: ["owner", "admin"] },
  "members:impersonate": { label: "View the app as another member", roles: ["owner", "admin"] },
  "api-keys:manage": { label: "Create and revoke API keys", roles: ["owner", "admin"] },
  "audit:read": { label: "Read the audit log", roles: ["owner", "admin", "manager"] },
  "automations:manage": { label: "Create and edit automations", roles: ["owner", "admin", "manager"] },
  "crm:delete": { label: "Delete contacts, companies and deals", roles: ["owner", "admin", "manager"] },
  "tickets:assign": { label: "Assign tickets to anyone", roles: ["owner", "admin", "manager"] },
  "crm:write": { label: "Create and edit CRM records", roles: ["owner", "admin", "manager", "agent"] },
  "crm:read": { label: "View CRM records and reports", roles: ["owner", "admin", "manager", "agent", "viewer"] },
} as const satisfies Record<string, { label: string; roles: readonly MemberRole[] }>

export type Permission = keyof typeof PERMISSIONS

export function can(role: MemberRole, permission: Permission) {
  return (PERMISSIONS[permission].roles as readonly MemberRole[]).includes(role)
}

export function permissionsFor(role: MemberRole) {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p))
}

const rank: Record<MemberRole, number> = { owner: 4, admin: 3, manager: 2, agent: 1, viewer: 0 }

export class PermissionError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message)
    this.name = "PermissionError"
  }
}

/**
 * Rules for changing another member: you need members:manage, you can't touch someone
 * at or above your own rank (owners excepted), and you can't grant a role above yours.
 * Returns an error message, or null when the change is allowed.
 */
export function memberChangeError(
  actor: { id: string; role: MemberRole },
  target: { id: string; role: MemberRole },
  change: { role?: MemberRole; status?: "active" | "suspended" | "removed" },
  ownerCount: number
): string | null {
  if (!can(actor.role, "members:manage")) return "Only owners and admins can manage members."
  const self = actor.id === target.id
  if (self && change.status) return "You can't suspend or remove yourself."
  if (target.role === "owner" && (change.status || (change.role && change.role !== "owner")) && ownerCount <= 1) {
    return "An organization needs at least one owner. Make someone else owner first."
  }
  if (actor.role !== "owner" && !self && rank[target.role] >= rank[actor.role]) {
    return `Admins can't change other ${roleInfo[target.role].label.toLowerCase()}s.`
  }
  if (change.role && rank[change.role] > rank[actor.role]) {
    return `You can't grant a role above your own (${roleInfo[actor.role].label}).`
  }
  return null
}

export function canImpersonate(actor: { id: string; role: MemberRole }, target: { id: string; role: MemberRole; status: string }) {
  if (actor.id === target.id || target.status !== "active") return false
  if (!can(actor.role, "members:impersonate")) return false
  return actor.role === "owner" || rank[target.role] < rank[actor.role]
}
