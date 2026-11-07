import "server-only"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { authenticateApiKey, bearerToken, type ApiScope } from "./api-keys"
import { PermissionError } from "./permissions"
import type { ServiceContext } from "./services"

/** RFC 9457 problem details. */
export function problem(status: number, title: string, detail?: string, extra?: Record<string, unknown>) {
  return Response.json({ type: "about:blank", title, status, ...(detail ? { detail } : {}), ...extra }, { status, headers: { "content-type": "application/problem+json" } })
}

/**
 * Wraps a REST handler with API-key auth, scope checks, per-key rate limiting
 * and consistent error responses.
 */
export function apiRoute(scope: ApiScope, handler: (req: Request, ctx: ServiceContext) => Promise<Response>) {
  return async (req: Request) => {
    const ctx = await authenticateApiKey(bearerToken(req))
    if (!ctx) return problem(401, "Unauthorized", "Send a valid API key as `Authorization: Bearer lum_live_…`.")
    if (!ctx.scopes.includes(scope)) return problem(403, "Forbidden", `This key is missing the ${scope} scope.`)
    const limit = await rateLimit(`api:${ctx.org.id}:${bearerToken(req)?.slice(0, 16)}`)
    if (!limit.success) return problem(429, "Too many requests", "Slow down and retry shortly.", { retryAfter: Math.ceil((limit.reset - Date.now()) / 1000) })
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof z.ZodError) return problem(422, "Invalid request", error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "))
      if (error instanceof PermissionError) return problem(403, "Forbidden", error.message)
      console.error("[api]", error)
      return problem(500, "Internal error")
    }
  }
}

export async function readJson(req: Request) {
  try {
    return await req.json()
  } catch {
    throw new z.ZodError([{ code: "custom", path: [], message: "Body must be valid JSON", input: undefined }])
  }
}
