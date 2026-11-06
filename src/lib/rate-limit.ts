import "server-only"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const WINDOW_MS = 60_000
const LIMIT = 15

type Result = { success: boolean; remaining: number; reset: number }

const upstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(LIMIT, "60 s"),
        prefix: "lumora:chat",
        analytics: false,
      })
    : null

// Best-effort fallback for local development or when Redis isn't configured.
// Serverless instances don't share memory, so this only limits per instance.
const memory = new Map<string, { count: number; reset: number }>()

function memoryLimit(key: string): Result {
  const now = Date.now()
  const entry = memory.get(key)
  if (!entry || entry.reset < now) {
    memory.set(key, { count: 1, reset: now + WINDOW_MS })
    if (memory.size > 5000) {
      for (const [k, v] of memory) if (v.reset < now) memory.delete(k)
    }
    return { success: true, remaining: LIMIT - 1, reset: now + WINDOW_MS }
  }
  entry.count++
  return { success: entry.count <= LIMIT, remaining: Math.max(0, LIMIT - entry.count), reset: entry.reset }
}

export async function rateLimit(key: string): Promise<Result> {
  if (upstash) {
    const { success, remaining, reset } = await upstash.limit(key)
    return { success, remaining, reset }
  }
  return memoryLimit(key)
}

export function clientKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || req.headers.get("x-real-ip") || "anonymous"
}
