import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { and, desc, eq, or } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { authenticateApiKey } from "@/lib/crm/api-keys"
import { MCP_TOOLS, type McpToolName } from "@/lib/crm/mcp-tools"
import { PermissionError } from "@/lib/crm/permissions"
import {
  createContactRecord,
  createTaskRecord,
  createTicketRecord,
  findDealByName,
  findMemberByName,
  moveDealRecord,
  openTicketsSummary,
  pipelineSummary,
  searchCrm,
  type ServiceContext,
} from "@/lib/crm/services"

export const maxDuration = 30

type ToolCtx = { http?: { authInfo?: { token: string } } }

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] })
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true })

/** Resolves the caller's organization from the verified API key and checks the tool's scope. */
async function withOrg(name: McpToolName, ctx: ToolCtx, run: (org: ServiceContext) => Promise<unknown>) {
  const auth = await authenticateApiKey(ctx.http?.authInfo?.token)
  if (!auth) return fail("Invalid or revoked API key.")
  const scope = MCP_TOOLS.find((t) => t.name === name)!.scope
  if (!auth.scopes.includes(scope)) return fail(`This key is missing the ${scope} scope.`)
  try {
    return text(await run({ ...auth, via: `MCP · ${auth.via}` }))
  } catch (error) {
    if (error instanceof PermissionError) return fail(error.message)
    if (error instanceof Error && error.message.length < 200) return fail(error.message)
    console.error("[mcp]", error)
    return fail("The tool failed. Try again.")
  }
}

const describe = (name: McpToolName) => MCP_TOOLS.find((t) => t.name === name)!.description

const handler = createMcpHandler(
  (server) => {
    server.registerTool("search_crm", { title: "Search CRM", description: describe("search_crm"), inputSchema: z.object({ query: z.string().min(1).max(80) }) }, async ({ query }, ctx) =>
      withOrg("search_crm", ctx as ToolCtx, (org) => searchCrm(org, query, 8))
    )

    server.registerTool(
      "get_contact",
      { title: "Get contact", description: describe("get_contact"), inputSchema: z.object({ idOrEmail: z.string().min(3).max(120) }) },
      async ({ idOrEmail }, ctx) =>
        withOrg("get_contact", ctx as ToolCtx, async (org) => {
          const [contact] = await org.db
            .select()
            .from(s.contacts)
            .where(and(eq(s.contacts.orgId, org.org.id), or(eq(s.contacts.id, idOrEmail), eq(s.contacts.email, idOrEmail.toLowerCase()))))
            .limit(1)
          if (!contact) throw new Error("No contact with that id or email.")
          const [deals, tickets, activity] = await Promise.all([
            org.db.select({ title: s.deals.title, stage: s.deals.stage, value: s.deals.value, nextStep: s.deals.nextStep }).from(s.deals).where(eq(s.deals.contactId, contact.id)),
            org.db.select({ number: s.tickets.number, subject: s.tickets.subject, status: s.tickets.status, priority: s.tickets.priority }).from(s.tickets).where(eq(s.tickets.contactId, contact.id)),
            org.db
              .select({ type: s.activities.type, title: s.activities.title, at: s.activities.occurredAt })
              .from(s.activities)
              .where(and(eq(s.activities.orgId, org.org.id), eq(s.activities.contactId, contact.id)))
              .orderBy(desc(s.activities.occurredAt))
              .limit(8),
          ])
          return {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            title: contact.title,
            lifecycle: contact.lifecycle,
            leadScore: contact.score,
            scoreReasons: contact.scoreReasons,
            tags: contact.tags,
            deals,
            tickets,
            recentActivity: activity,
          }
        })
    )

    server.registerTool("pipeline_summary", { title: "Pipeline summary", description: describe("pipeline_summary"), inputSchema: z.object({}) }, async (_args, ctx) =>
      withOrg("pipeline_summary", ctx as ToolCtx, (org) => pipelineSummary(org))
    )

    server.registerTool(
      "list_open_tickets",
      { title: "List open tickets", description: describe("list_open_tickets"), inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(10) }) },
      async ({ limit }, ctx) => withOrg("list_open_tickets", ctx as ToolCtx, (org) => openTicketsSummary(org, limit))
    )

    server.registerTool(
      "create_ticket",
      {
        title: "Create ticket",
        description: describe("create_ticket"),
        inputSchema: z.object({
          subject: z.string().min(4).max(160),
          body: z.string().min(4).max(5000),
          contactEmail: z.email().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Leave empty to let Lumora triage it"),
        }),
      },
      async (input, ctx) =>
        withOrg("create_ticket", ctx as ToolCtx, async (org) => {
          const { ticket, automations } = await createTicketRecord(org, { ...input, channel: "api" })
          return { number: ticket.number, id: ticket.id, priority: ticket.priority, team: ticket.team, slaDueAt: ticket.dueAt, automationsRan: automations }
        })
    )

    server.registerTool(
      "create_contact",
      {
        title: "Create contact",
        description: describe("create_contact"),
        inputSchema: z.object({ name: z.string().min(2).max(80), email: z.email(), title: z.string().max(80).optional(), company: z.string().max(80).optional() }),
      },
      async ({ company, ...input }, ctx) =>
        withOrg("create_contact", ctx as ToolCtx, async (org) => {
          const { contact, duplicateId } = await createContactRecord(org, { ...input, companyName: company, source: "api" })
          return contact ? { id: contact.id, leadScore: contact.score, scoreReasons: contact.scoreReasons } : { duplicate: true, existingId: duplicateId }
        })
    )

    server.registerTool(
      "move_deal",
      {
        title: "Move deal",
        description: describe("move_deal"),
        inputSchema: z.object({ deal: z.string().min(2).max(120).describe("Deal id or part of its name"), stage: z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost"]) }),
      },
      async ({ deal, stage }, ctx) =>
        withOrg("move_deal", ctx as ToolCtx, async (org) => {
          const found = deal.startsWith("deal_") ? { id: deal } : await findDealByName(org, deal)
          if (!found) throw new Error(`No deal matches “${deal}”.`)
          const moved = await moveDealRecord(org, found.id, stage)
          return { deal: moved.title, stage, changed: moved.changed }
        })
    )

    server.registerTool(
      "create_task",
      {
        title: "Create task",
        description: describe("create_task"),
        inputSchema: z.object({ title: z.string().min(2).max(160), dueInDays: z.number().int().min(0).max(90).default(1), assignee: z.string().max(80).optional() }),
      },
      async ({ title, dueInDays, assignee }, ctx) =>
        withOrg("create_task", ctx as ToolCtx, async (org) => {
          const member = assignee ? await findMemberByName(org, assignee) : null
          const task = await createTaskRecord(org, { title, dueAt: new Date(Date.now() + dueInDays * 86_400_000), assigneeId: member?.id, source: "agent" })
          return { id: task.id, title: task.title, dueAt: task.dueAt, assignee: member?.name ?? org.member.name }
        })
    )
  },
  { serverInfo: { name: "lumora-crm", version: "1.0.0" } }
)

const authed = withMcpAuth(
  handler,
  async (_req, token) => {
    const auth = await authenticateApiKey(token)
    return auth ? { token: token!, clientId: auth.org.id, scopes: auth.scopes } : undefined
  },
  { required: true }
)

export { authed as GET, authed as POST, authed as DELETE }
