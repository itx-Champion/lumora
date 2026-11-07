import { tool } from "ai"
import { and, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"
import * as s from "@/db/schema"
import { logActivity } from "@/lib/crm/context"
import { compactMoney, stageLabel } from "@/lib/crm/constants"
import {
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

const shortId = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export const createTicketInput = z.object({
  title: z.string().min(3).max(120).describe("Short summary of the issue or task"),
  description: z.string().max(1000).describe("What needs to happen, including relevant policy details"),
  priority: z.enum(["P1", "P2", "P3", "P4"]).describe("P1 is most urgent"),
  team: z.enum(["Support", "Billing", "Engineering", "Sales", "People"]),
  customerEmail: z.string().max(120).optional().describe("Customer's email if the ticket is about a specific customer"),
})

export const draftEmailInput = z.object({
  to: z.string().min(2).max(200).describe("Recipient name or email address"),
  subject: z.string().min(3).max(150),
  body: z.string().min(10).max(2000).describe("Complete, ready-to-send email body"),
})

export const scheduleMeetingInput = z.object({
  title: z.string().min(3).max(120),
  attendees: z.array(z.string().max(80)).min(1).max(12),
  date: z.string().describe("Meeting date in YYYY-MM-DD format"),
  time: z.string().describe("Start time in 24h HH:MM format"),
  durationMinutes: z.number().int().min(15).max(240),
  agenda: z.string().max(600).optional(),
})

export const updateDealInput = z.object({
  deal: z.string().min(2).max(120).describe("Deal name or company name, e.g. 'Acme Robotics'"),
  stage: z.enum(["new", "qualified", "proposal", "negotiation", "won", "lost"]),
})

export const createTaskInput = z.object({
  title: z.string().min(3).max(160),
  dueInDays: z.number().int().min(0).max(90).describe("0 means today"),
  assignee: z.string().max(80).optional().describe("Teammate's name; omit to assign to the user"),
})

type TicketInput = z.infer<typeof createTicketInput>
type EmailInput = z.infer<typeof draftEmailInput>
type MeetingInput = z.infer<typeof scheduleMeetingInput>

export const makeTicket = (input: TicketInput) => ({
  ...input,
  id: `LUM-${shortId()}`,
  status: "open" as const,
  createdAt: Date.now(),
  href: undefined as string | undefined,
  assignee: undefined as string | undefined,
  automations: [] as string[],
})

export const makeEmail = (input: EmailInput) => ({
  ...input,
  id: `EML-${shortId()}`,
  status: "draft" as const,
  createdAt: Date.now(),
  href: undefined as string | undefined,
})

export const makeMeeting = (input: MeetingInput) => ({
  ...input,
  id: `MTG-${shortId()}`,
  status: "scheduled" as const,
  createdAt: Date.now(),
  href: undefined as string | undefined,
})

const priorityMap = { P1: "urgent", P2: "high", P3: "normal", P4: "low" } as const
const crmUnavailable = { error: "The CRM isn't connected in this environment." }

async function findContact(crm: ServiceContext, who: string) {
  const term = who.trim().toLowerCase()
  const [row] = await crm.db
    .select()
    .from(s.contacts)
    .where(and(eq(s.contacts.orgId, crm.org.id), or(eq(s.contacts.email, term), ilike(s.contacts.name, `%${term.replace(/[%_\\]/g, "")}%`))))
    .limit(1)
  return row ?? null
}

/**
 * What the agent can do. With a CRM context every action writes to the organization's
 * database through the same service layer as the UI (permissions, audit log, automations).
 * Without one (for example no database configured) the original in-memory records are returned.
 */
export function agentActions(crm: ServiceContext | null) {
  return {
    createTicket: async (input: TicketInput) => {
      if (!crm) return makeTicket(input)
      const { ticket, automations } = await createTicketRecord(crm, {
        subject: input.title,
        body: input.description || input.title,
        contactEmail: input.customerEmail?.includes("@") ? input.customerEmail : undefined,
        priority: priorityMap[input.priority],
        team: input.team === "Billing" || input.team === "People" ? "Support" : input.team,
        tags: input.team === "Billing" ? ["billing"] : [],
        channel: "agent",
      })
      const [assignee] = ticket.assigneeId ? await crm.db.select({ name: s.members.name }).from(s.members).where(eq(s.members.id, ticket.assigneeId)) : []
      return { ...makeTicket(input), id: `#${ticket.number}`, href: `/app/crm/inbox?t=${ticket.id}`, assignee: assignee?.name, automations }
    },
    draftEmail: async (input: EmailInput) => {
      const base = makeEmail(input)
      if (!crm) return base
      const contact = await findContact(crm, input.to)
      if (!contact) return base
      await logActivity(crm, {
        type: "email",
        subjectType: "contact",
        subjectId: contact.id,
        contactId: contact.id,
        companyId: contact.companyId,
        title: `AI drafted: ${input.subject}`,
        body: input.body.slice(0, 600),
        meta: { status: "draft", source: "agent" },
      })
      return { ...base, to: `${contact.name} <${contact.email}>`, href: `/app/crm/contacts/${contact.id}` }
    },
    scheduleMeeting: async (input: MeetingInput) => {
      const base = makeMeeting(input)
      if (!crm) return base
      const contact = (await Promise.all(input.attendees.map((a) => findContact(crm, a)))).find(Boolean)
      if (!contact) return base
      await logActivity(crm, {
        type: "meeting",
        subjectType: "contact",
        subjectId: contact.id,
        contactId: contact.id,
        companyId: contact.companyId,
        title: `Scheduled: ${input.title}`,
        body: `${input.date} ${input.time} · ${input.durationMinutes} min${input.agenda ? ` · ${input.agenda}` : ""}`,
        meta: { startsAt: `${input.date}T${input.time}`, durationMinutes: input.durationMinutes, source: "agent" },
      })
      return { ...base, href: `/app/crm/contacts/${contact.id}` }
    },
    searchCrm: async ({ query }: { query: string }) => {
      if (!crm) return { ...crmUnavailable, contacts: [], companies: [], deals: [], tickets: [] }
      return { error: undefined, ...(await searchCrm(crm, query, 5)) }
    },
    pipelineSummary: async () => {
      if (!crm) return crmUnavailable
      const p = await pipelineSummary(crm)
      return {
        openPipeline: compactMoney.format(p.openValue),
        weightedForecast: compactMoney.format(p.weightedForecast),
        wonToDate: compactMoney.format(p.won.value),
        winRate: p.winRate === null ? "n/a" : `${p.winRate}%`,
        stages: p.stages.map((x) => ({ stage: x.stage, deals: x.count, value: compactMoney.format(x.value) })),
        topDeals: p.topDeals.map((d) => ({ title: d.title, stage: stageLabel(d.stage), value: compactMoney.format(d.value), owner: d.owner, nextStep: d.nextStep })),
      }
    },
    listOpenTickets: async ({ limit }: { limit: number }) => {
      if (!crm) return { ...crmUnavailable, tickets: [] }
      const rows = await openTicketsSummary(crm, limit)
      return { tickets: rows.map((t) => ({ number: t.number, subject: t.subject, priority: t.priority, status: t.status, assignee: t.assignee ?? "Unassigned", dueAt: t.dueAt?.toISOString() ?? null, href: `/app/crm/inbox?t=${t.id}` })) }
    },
    updateDealStage: async ({ deal, stage }: z.infer<typeof updateDealInput>) => {
      if (!crm) return crmUnavailable
      const found = await findDealByName(crm, deal)
      if (!found) return { error: `No deal matches “${deal}”.` }
      const moved = await moveDealRecord(crm, found.id, stage)
      return { deal: found.title, from: stageLabel(found.stage), to: stageLabel(stage), value: compactMoney.format(found.value), changed: moved.changed, href: `/app/crm/deals?deal=${found.id}` }
    },
    createTask: async ({ title, dueInDays, assignee }: z.infer<typeof createTaskInput>) => {
      if (!crm) return crmUnavailable
      const member = assignee ? await findMemberByName(crm, assignee) : null
      const task = await createTaskRecord(crm, { title, dueAt: new Date(new Date(Date.now() + dueInDays * 86_400_000).setHours(10, 0, 0, 0)), assigneeId: member?.id, source: "agent" })
      return { title: task.title, dueAt: task.dueAt?.toISOString() ?? null, assignee: member?.name ?? crm.member.name, href: "/app/crm/tasks" }
    },
  }
}

export type AgentActions = ReturnType<typeof agentActions>

/** Agent tools. Each returns a structured record the chat renders as a card. */
export function buildAgentTools(crm: ServiceContext | null) {
  const a = agentActions(crm)
  return {
    createTicket: tool({
      description: "Create a support ticket in the CRM inbox when the user asks to open, file, log or escalate a ticket or issue.",
      inputSchema: createTicketInput,
      execute: a.createTicket,
    }),
    draftEmail: tool({
      description: "Draft an email when the user asks to write, draft or reply to someone by email. Logged on the contact's timeline if they're in the CRM.",
      inputSchema: draftEmailInput,
      execute: a.draftEmail,
    }),
    scheduleMeeting: tool({
      description: "Schedule a meeting when the user asks to book, schedule or set up a meeting or call.",
      inputSchema: scheduleMeetingInput,
      execute: a.scheduleMeeting,
    }),
    searchCrm: tool({
      description: "Look up customers, companies, deals or tickets in the CRM. Use for any question about a specific customer, account, deal or ticket.",
      inputSchema: z.object({ query: z.string().min(1).max(80).describe("A name, company, email or ticket number") }),
      execute: a.searchCrm,
    }),
    pipelineSummary: tool({
      description: "Get the sales pipeline: open value by stage, weighted forecast, win rate and the biggest open deals.",
      inputSchema: z.object({}),
      execute: a.pipelineSummary,
    }),
    listOpenTickets: tool({
      description: "List open and pending support tickets, most urgent first, with SLA due times.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
      execute: a.listOpenTickets,
    }),
    updateDealStage: tool({
      description: "Move a deal to another pipeline stage when the user asks to update, advance, win or lose a deal.",
      inputSchema: updateDealInput,
      execute: a.updateDealStage,
    }),
    createTask: tool({
      description: "Create a follow-up task or reminder for the user or a teammate.",
      inputSchema: createTaskInput,
      execute: a.createTask,
    }),
  }
}

export type AgentTools = ReturnType<typeof buildAgentTools>
