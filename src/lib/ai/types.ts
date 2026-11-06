import type { InferUITools, UIMessage } from "ai"
import type { Source } from "@/lib/rag/types"
import type { AgentTools } from "./tools"

export type AnswerMode = "gemini" | "groq" | "demo"

export type AnswerMeta = {
  mode: AnswerMode
  model: string
  latencyMs?: number
}

export type LumoraDataParts = {
  sources: Source[]
  meta: AnswerMeta
}

export type LumoraTools = InferUITools<AgentTools>

export type LumoraUIMessage = UIMessage<never, LumoraDataParts, LumoraTools>

export type ToolName = keyof LumoraTools
export type ToolOutput<T extends ToolName> = LumoraTools[T]["output"]
