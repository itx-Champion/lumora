import "server-only"
import { and, eq, isNull } from "drizzle-orm"
import { getDb } from "@/db"
import * as s from "@/db/schema"
import type { ServiceContext } from "./services"

const KEY_PREFIX = "lum_live_"

/** 32 random bytes, base64url: ~190 bits of entropy behind a recognizable prefix. */
export function generateApiKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return KEY_PREFIX + Buffer.from(bytes).toString("base64url")
}

export async function hashApiKey(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))
  return Buffer.from(digest).toString("hex")
}

export type ApiScope = "crm:read" | "crm:write"

/**
 * Resolves a bearer token to an organization context. The key acts with the permissions
 * of the member who created it, narrowed by the key's scopes, and every write it makes
 * is attributed to "API key <name>" in the audit log.
 */
export async function authenticateApiKey(token: string | null | undefined): Promise<(ServiceContext & { scopes: ApiScope[] }) | null> {
  if (!token?.startsWith(KEY_PREFIX) || token.length > 80) return null
  const db = await getDb()
  const [row] = await db
    .select({ key: s.apiKeys, org: s.organizations, member: s.members })
    .from(s.apiKeys)
    .innerJoin(s.organizations, eq(s.organizations.id, s.apiKeys.orgId))
    .innerJoin(s.members, eq(s.members.id, s.apiKeys.createdById))
    .where(and(eq(s.apiKeys.hash, await hashApiKey(token)), isNull(s.apiKeys.revokedAt)))
    .limit(1)
  if (!row || row.member.status !== "active") return null

  // Record usage at most once a minute.
  if (!row.key.lastUsedAt || Date.now() - row.key.lastUsedAt.getTime() > 60_000) {
    await db.update(s.apiKeys).set({ lastUsedAt: new Date() }).where(eq(s.apiKeys.id, row.key.id))
  }
  // Read-only keys are treated as viewers, whatever their creator's role.
  const member = row.key.scopes.includes("crm:write") ? row.member : { ...row.member, role: "viewer" as const }
  return { db, org: row.org, member, realMember: row.member, impersonating: false, via: `API key “${row.key.name}”`, scopes: row.key.scopes }
}

export function bearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? ""
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null
}
