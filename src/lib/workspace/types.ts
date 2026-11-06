import type { AnswerMode, LumoraUIMessage, ToolOutput } from "@/lib/ai/types"
import type { KnowledgeDocument } from "@/lib/rag/types"

export type Conversation = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: LumoraUIMessage[]
}

export type ActionRecord =
  | { kind: "ticket"; toolCallId: string; conversationId?: string; data: ToolOutput<"createTicket">; done?: boolean }
  | { kind: "email"; toolCallId: string; conversationId?: string; data: ToolOutput<"draftEmail">; done?: boolean }
  | { kind: "meeting"; toolCallId: string; conversationId?: string; data: ToolOutput<"scheduleMeeting">; done?: boolean }

export type QuestionLog = {
  id: string
  at: number
  question: string
  latencyMs: number
  answered: boolean
  mode: AnswerMode
  citedDocIds: string[]
  sample?: boolean
}

export type Workspace = {
  version: 1
  documents: KnowledgeDocument[]
  conversations: Conversation[]
  actions: ActionRecord[]
  logs: QuestionLog[]
}
