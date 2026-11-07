import "server-only"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createGroq } from "@ai-sdk/groq"
import type { LanguageModel } from "ai"
import type { AnswerMode } from "./types"

export type ModelCandidate = {
  mode: Exclude<AnswerMode, "demo">
  label: string
  model: LanguageModel
}

// The "-latest" alias tracks Google's current Flash-Lite model, so the app survives model
// retirements. Flash-Lite answers in a few seconds and has the most generous free-tier limits.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest"
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"

/**
 * Providers in priority order. Only those with an API key configured are returned.
 * A preferred provider moves to the front; the rest remain as fallbacks.
 */
export function getModelCandidates(preference: "auto" | "gemini" | "groq" = "auto"): ModelCandidate[] {
  const candidates: ModelCandidate[] = []

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY })
    candidates.push({ mode: "gemini", label: GEMINI_MODEL, model: google(GEMINI_MODEL) })
  }

  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })
    candidates.push({ mode: "groq", label: GROQ_MODEL, model: groq(GROQ_MODEL) })
  }

  if (preference !== "auto") candidates.sort((a, b) => Number(b.mode === preference) - Number(a.mode === preference))
  return candidates
}

export function getProviderStatus() {
  return {
    gemini: Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    rateLimit: process.env.UPSTASH_REDIS_REST_URL ? ("upstash" as const) : ("memory" as const),
    models: { gemini: GEMINI_MODEL, groq: GROQ_MODEL },
  }
}
