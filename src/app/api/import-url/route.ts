import { z } from "zod"
import { auth } from "@/auth"
import { ImportError, importPage } from "@/lib/web/fetch-page"
import { clientKey, rateLimit } from "@/lib/rate-limit"

export const maxDuration = 30

const bodySchema = z.object({ url: z.string().min(4).max(2048) })

/** Fetches a public web page and returns its readable text for indexing. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const limit = await rateLimit(`import:${clientKey(req)}`)
  if (!limit.success) {
    return Response.json({ error: "Too many imports. Please wait a minute." }, { status: 429 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Please enter a URL." }, { status: 400 })

  try {
    return Response.json(await importPage(parsed.data.url))
  } catch (error) {
    if (error instanceof ImportError) return Response.json({ error: error.message }, { status: 422 })
    console.error("[import-url]", error)
    return Response.json({ error: "We couldn't import that page." }, { status: 500 })
  }
}
