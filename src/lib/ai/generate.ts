import "server-only"
import { generateText } from "ai"
import { getModelCandidates } from "./providers"

export type Generated = { text: string; mode: "gemini" | "groq" | "demo"; model: string }

/**
 * One-shot generation with the same provider fallback chain as chat (Gemini → Groq).
 * Returns null when no provider answers in time, so callers can use a deterministic fallback.
 */
export async function generateWithFallback(opts: { instructions: string; prompt: string; maxOutputTokens?: number; timeoutMs?: number }) {
  for (const candidate of getModelCandidates()) {
    try {
      const { text } = await generateText({
        model: candidate.model,
        instructions: opts.instructions,
        prompt: opts.prompt,
        maxOutputTokens: opts.maxOutputTokens ?? 500,
        temperature: 0.3,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 14_000),
      })
      if (text.trim()) return { text: text.trim(), mode: candidate.mode, model: candidate.label } satisfies Generated
    } catch (error) {
      console.warn(`[ai] ${candidate.mode} failed:`, error instanceof Error ? error.message : error)
    }
  }
  return null
}
