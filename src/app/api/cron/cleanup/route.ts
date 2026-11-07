import { and, eq, lt } from "drizzle-orm"
import { getDb } from "@/db"
import * as s from "@/db/schema"

/**
 * Daily Vercel Cron job: deletes demo sandboxes nobody has opened for a week, so the free
 * database stays small. Every table cascades from organizations. Vercel signs cron
 * requests with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const db = await getDb()
  const cutoff = new Date(Date.now() - 7 * 86_400_000)
  const removed = await db
    .delete(s.organizations)
    .where(and(eq(s.organizations.isSandbox, true), lt(s.organizations.lastActiveAt, cutoff)))
    .returning({ id: s.organizations.id })
  console.log(`[cron] removed ${removed.length} idle sandboxes`)
  return Response.json({ removed: removed.length })
}
