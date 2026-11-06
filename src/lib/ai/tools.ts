import { tool } from "ai"
import { z } from "zod"

const shortId = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export const createTicketInput = z.object({
  title: z.string().min(3).max(120).describe("Short summary of the issue or task"),
  description: z.string().max(1000).describe("What needs to happen, including relevant policy details"),
  priority: z.enum(["P1", "P2", "P3", "P4"]).describe("P1 is most urgent"),
  team: z.enum(["Support", "Billing", "Engineering", "Sales", "People"]),
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

export const makeTicket = (input: z.infer<typeof createTicketInput>) => ({
  ...input,
  id: `LUM-${shortId()}`,
  status: "open" as const,
  createdAt: Date.now(),
})

export const makeEmail = (input: z.infer<typeof draftEmailInput>) => ({
  ...input,
  id: `EML-${shortId()}`,
  status: "draft" as const,
  createdAt: Date.now(),
})

export const makeMeeting = (input: z.infer<typeof scheduleMeetingInput>) => ({
  ...input,
  id: `MTG-${shortId()}`,
  status: "scheduled" as const,
  createdAt: Date.now(),
})

/**
 * Agent tools. Each one returns a structured record that the UI renders as a
 * card and stores in the workspace's Actions inbox.
 */
export const agentTools = {
  createTicket: tool({
    description:
      "Create a ticket for a team when the user asks to open, file, log or escalate a ticket or task.",
    inputSchema: createTicketInput,
    execute: async (input) => makeTicket(input),
  }),
  draftEmail: tool({
    description: "Draft an email when the user asks to write, draft or reply to someone by email.",
    inputSchema: draftEmailInput,
    execute: async (input) => makeEmail(input),
  }),
  scheduleMeeting: tool({
    description: "Schedule a meeting when the user asks to book, schedule or set up a meeting or call.",
    inputSchema: scheduleMeetingInput,
    execute: async (input) => makeMeeting(input),
  }),
}

export type AgentTools = typeof agentTools
