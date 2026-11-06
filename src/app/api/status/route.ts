import { auth, githubEnabled } from "@/auth"
import { getProviderStatus } from "@/lib/ai/providers"

/** Which integrations are configured — booleans only, never secrets. */
export async function GET() {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  return Response.json({ ...getProviderStatus(), github: githubEnabled })
}
