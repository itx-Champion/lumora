// Applies pending SQL migrations from ./drizzle to the Neon database.
// Runs before `next build` on Vercel; a no-op when no database is configured (CI, local PGlite).
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.log("[migrate] DATABASE_URL not set, skipping")
  process.exit(0)
}

const { Pool, neonConfig } = await import("@neondatabase/serverless")
const { drizzle } = await import("drizzle-orm/neon-serverless")
const { migrate } = await import("drizzle-orm/neon-serverless/migrator")
const ws = (await import("ws")).default
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws

const pool = new Pool({ connectionString: url })
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" })
  console.log("[migrate] database is up to date")
} finally {
  await pool.end()
}
