import type { AnswerMode, LumoraUIMessage, ToolOutput } from "@/lib/ai/types"
import type { TemplateId } from "@/lib/demo/templates"
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
  rating?: "up" | "down"
  sample?: boolean
}

export type Workspace = {
  version: 1
  /** Missing on workspaces saved before templates existed; treat as "support". */
  template?: TemplateId
  documents: KnowledgeDocument[]
  conversations: Conversation[]
  actions: ActionRecord[]
  logs: QuestionLog[]
}

export type WorkspaceMeta = {
  id: string
  name: string
  template: TemplateId
  createdAt: number
}
