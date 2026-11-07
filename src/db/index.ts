import "server-only"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema"

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * One database handle per server instance.
 * - Production / preview: Neon serverless Postgres over WebSockets (supports transactions).
 * - Local development without DATABASE_URL: PGlite, a real Postgres compiled to WASM,
 *   persisted under .data/ and migrated on first use. Same SQL, same migrations.
 */
const globalForDb = globalThis as unknown as { lumoraDb?: Promise<DB> }

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL
  if (url) {
    const [{ Pool, neonConfig }, { drizzle }, ws] = await Promise.all([
      import("@neondatabase/serverless"),
      import("drizzle-orm/neon-serverless"),
      import("ws"),
    ])
    if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws.default
    return drizzle({ client: new Pool({ connectionString: url, max: 5 }), schema }) as unknown as DB
  }

  const [{ PGlite }, { drizzle }, { migrate }, path, fs] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
    import("node:path"),
    import("node:fs/promises"),
  ])
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite")
  if (dataDir !== "memory") await fs.mkdir(dataDir, { recursive: true })
  const client = new PGlite(dataDir === "memory" ? undefined : dataDir)
  const db = drizzle({ client, schema })
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") })
  return db as unknown as DB
}

export function getDb() {
  globalForDb.lumoraDb ??= connect().catch((error) => {
    globalForDb.lumoraDb = undefined
    throw error
  })
  return globalForDb.lumoraDb
}

export { schema }
