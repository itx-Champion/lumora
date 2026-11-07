import { apiRoute } from "@/lib/crm/rest"
import { pipelineSummary } from "@/lib/crm/services"

export const GET = apiRoute("crm:read", async (_req, ctx) => Response.json({ data: await pipelineSummary(ctx) }))
