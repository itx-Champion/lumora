import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type TextStreamPart,
} from "ai"
import { z } from "zod"
import { auth } from "@/auth"
import { agentTools, type AgentTools } from "@/lib/ai/tools"
import { getModelCandidates } from "@/lib/ai/providers"
import { buildInstructions } from "@/lib/ai/prompt"
import { writeDemoAnswer } from "@/lib/ai/demo-responder"
import type { LumoraUIMessage } from "@/lib/ai/types"
import { clientKey, rateLimit } from "@/lib/rate-limit"

export const maxDuration = 30

const sourceSchema = z.object({
  n: z.number().int().min(1).max(12),
  chunkId: z.string().max(200),
  docId: z.string().max(100),
  title: z.string().max(200),
  fileName: z.string().max(200),
  section: z.string().max(200).optional(),
  text: z.string().max(2500),
  score: z.number(),
})

const bodySchema = z.object({
  messages: z.array(z.custom<LumoraUIMessage>((m) => typeof m === "object" && m !== null)).min(1).max(60),
  sources: z.array(sourceSchema).max(8).default([]),
  model: z.enum(["auto", "gemini", "groq"]).default("auto"),
  workspace: z.object({ name: z.string().max(80), company: z.string().max(80) }).optional(),
})

/**
 * Waits for the first meaningful event of a model stream. Provider errors such as
 * missing quota surface here, before anything is sent to the client, which lets
 * us fall through to the next provider transparently.
 */
async function probe(stream: ReadableStream<TextStreamPart<AgentTools>>) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) return true
      if (value.type === "error") return false
      if (["text-delta", "tool-call", "tool-input-start", "reasoning-delta", "finish"].includes(value.type)) {
        return true
      }
    }
  } catch {
    return false
  } finally {
    reader.cancel().catch(() => {})
  }
}

function lastUserText(messages: LumoraUIMessage[]) {
  const last = [...messages].reverse().find((m) => m.role === "user")
  return (
    last?.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim() ?? ""
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: "Please sign in to use the assistant." }, { status: 401 })
  }

  const limit = await rateLimit(`${clientKey(req)}:${session.user.email ?? "user"}`)
  if (!limit.success) {
    return Response.json(
      { error: "You're sending messages too quickly. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)) } }
    )
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 })
  }
  const { messages, sources, model, workspace } = parsed.data
  const question = lastUserText(messages)

  const stream = createUIMessageStream<LumoraUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      writer.write({ type: "start" })
      if (sources.length) writer.write({ type: "data-sources", data: sources })

      const modelMessages = await convertToModelMessages(messages, { tools: agentTools })
      const instructions = buildInstructions(sources, session.user?.name ?? undefined, workspace)

      for (const candidate of getModelCandidates(model)) {
        const result = streamText({
          model: candidate.model,
          instructions,
          messages: modelMessages,
          tools: agentTools,
          stopWhen: isStepCount(4),
          temperature: 0.2,
          maxRetries: 0,
        })
        const [probeBranch, mainBranch] = result.stream.tee()
        if (!(await probe(probeBranch))) {
          await mainBranch.cancel().catch(() => {})
          console.warn(`[chat] ${candidate.mode} unavailable, trying next provider`)
          continue
        }

        writer.write({ type: "data-meta", data: { mode: candidate.mode, model: candidate.label } })
        writer.merge(toUIMessageStream({ stream: mainBranch, tools: agentTools, sendStart: false }))
        return
      }

      writer.write({ type: "data-meta", data: { mode: "demo", model: "Extractive (no API key)" } })
      await writeDemoAnswer(writer, question, sources, workspace?.company)
      writer.write({ type: "finish" })
    },
    onError: (error) => {
      console.error("[chat]", error)
      return "The assistant ran into a problem. Please try again."
    },
  })

  return createUIMessageStreamResponse({ stream })
}
