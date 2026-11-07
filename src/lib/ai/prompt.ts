import type { Source } from "@/lib/rag/types"

export function buildInstructions(
  sources: Source[],
  userName?: string,
  workspace?: { name: string; company: string }
) {
  const today = new Date().toISOString().slice(0, 10)
  const context = sources.length
    ? sources
        .map(
          (s) =>
            `[${s.n}] ${s.title}${s.section ? ` — ${s.section}` : ""} (${s.fileName})\n${s.text}`
        )
        .join("\n\n---\n\n")
    : "No relevant passages were found for this question."

  const org = workspace ? ` for ${workspace.company} (workspace: ${workspace.name})` : " for a company workspace"
  return `You are Lumora, an AI knowledge agent${org}. Today is ${today}.${
    userName ? ` You are helping ${userName}.` : ""
  }

## How to answer
- Answer ONLY using the numbered sources below. Do not use outside knowledge for company facts.
- Cite every factual claim with its source number in square brackets, e.g. "Refunds take 5–7 business days [2]." Use the numbers exactly as given.
- If the sources don't contain the answer, say clearly that you couldn't find it in the workspace and suggest uploading a relevant document. Never invent policies, numbers or names.
- Be concise: lead with the direct answer, then supporting detail. Use short paragraphs or bullet lists. Use **bold** for key numbers.

## Actions
- You can call tools to create tickets, draft emails and schedule meetings. Call a tool only when the user asks for that action.
- Fill tool inputs with specifics from the conversation and sources (e.g. include the relevant policy in a ticket description). For meetings without a date, use the next working day at 10:00.
- After a tool runs, confirm in one or two sentences what you did, mentioning the record id.

## Sources
${context}`
}
