import "server-only"
import type { UIMessageStreamWriter } from "ai"
import { tokenize } from "@/lib/rag/bm25"
import type { Source } from "@/lib/rag/types"
import { makeEmail, makeMeeting, makeTicket } from "./tools"
import type { LumoraUIMessage } from "./types"

type Writer = UIMessageStreamWriter<LumoraUIMessage>

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const callId = () => `call_${Math.random().toString(36).slice(2, 10)}`

async function streamText(writer: Writer, text: string) {
  const id = `txt_${Math.random().toString(36).slice(2, 8)}`
  writer.write({ type: "text-start", id })
  for (const token of text.match(/\S+\s*/g) ?? []) {
    writer.write({ type: "text-delta", id, delta: token })
    await sleep(14 + Math.random() * 18)
  }
  writer.write({ type: "text-end", id })
}

/** Picks the sentences that best overlap the question, keeping their source numbers for citations. */
function extractAnswer(question: string, sources: Source[]) {
  const queryTerms = new Set(tokenize(question))
  const candidates: { text: string; n: number; score: number; order: number }[] = []

  for (const source of sources) {
    const sentences = source.text
      .replace(/^#+\s.*$/gm, "")
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim().replace(/^\d+\.\s+/, ""))
      .filter((s) => s.length > 25)

    sentences.forEach((sentence, i) => {
      const terms = tokenize(sentence)
      const hits = terms.filter((t) => queryTerms.has(t)).length
      if (!hits) return
      // Favor dense matches and the highest-ranked sources.
      const score = hits / Math.sqrt(terms.length) + 1 / (source.n + 1)
      candidates.push({ text: sentence, n: source.n, score, order: source.n * 100 + i })
    })
  }

  const best = candidates.sort((a, b) => b.score - a.score).slice(0, 3)
  return best.sort((a, b) => a.order - b.order)
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function detectTeam(text: string) {
  if (/refund|invoice|billing|payment|charge/i.test(text)) return "Billing" as const
  if (/bug|api|integration|outage|error|2fa|two-factor/i.test(text)) return "Engineering" as const
  if (/upgrade|pricing|quote|demo|sales|lead/i.test(text)) return "Sales" as const
  if (/leave|vacation|hiring|onboarding|payroll|hr\b/i.test(text)) return "People" as const
  return "Support" as const
}

function subjectFrom(text: string) {
  const match = text.match(/\b(?:for|about|regarding|to)\s+(.+)$/i)
  const subject = (match?.[1] ?? text).replace(/[.?!]+$/, "").trim()
  return capitalize(subject.length > 80 ? `${subject.slice(0, 77)}…` : subject)
}

/** "Open a ticket for billing to process that refund" → "Process refund". */
function ticketTitle(text: string) {
  const match = text.match(/\b(?:ticket|issue)\b(?:\s+for\s+(?:the\s+)?\w+)?(?:\s+(?:to|about|regarding))?\s+(.+)$/i)
  const title = (match?.[1] ?? text)
    .replace(/\b(that|this|it)\b\s*/gi, "")
    .replace(/[.?!]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
  return title.length >= 3 ? capitalize(title.slice(0, 80)) : "Follow-up request"
}

function nextWeekday(from = new Date()) {
  const d = new Date(from)
  do d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6)
  return d.toISOString().slice(0, 10)
}

const citeLine = (sources: Source[]) =>
  sources[0] ? ` I used ${sources[0].title} [1] for the details.` : ""

/**
 * Keyless fallback. Answers extractively from the retrieved passages and runs
 * agent actions from simple intent rules, so the product stays usable with no
 * model provider configured or when every provider is rate-limited.
 */
export async function writeDemoAnswer(writer: Writer, question: string, sources: Source[]) {
  const evidence = extractAnswer(question, sources)
  const summary = evidence[0]?.text

  if (/\b(ticket|escalate|log an? issue|file an? issue)\b/i.test(question)) {
    const team = detectTeam(question)
    const input = {
      title: ticketTitle(question),
      description: summary ? `${question}\n\nPolicy reference: ${summary}` : question,
      priority: /urgent|asap|immediately|outage/i.test(question)
        ? ("P1" as const)
        : team === "Billing"
          ? ("P2" as const)
          : ("P3" as const),
      team,
    }
    await streamText(writer, `I'll open a ${team} ticket for this.`)
    const toolCallId = callId()
    writer.write({ type: "tool-input-available", toolCallId, toolName: "createTicket", input })
    await sleep(600)
    const output = makeTicket(input)
    writer.write({ type: "tool-output-available", toolCallId, output })
    await streamText(
      writer,
      `\n\nDone — **${output.id}** is open for ${team} with priority ${input.priority}.${citeLine(sources)} You'll find it in **Actions**.`
    )
    return
  }

  if (/\b(e-?mail|write to|reply to|draft)\b/i.test(question)) {
    const to = question.match(/\bto\s+([\w.@-]+(?:\s[A-Z][\w-]+)?)/)?.[1] ?? "the customer"
    const input = {
      to,
      subject: subjectFrom(question),
      body: `Hi ${to === "the customer" ? "there" : to},\n\nThanks for reaching out. ${
        summary ?? "I've looked into your request and will follow up shortly with the details."
      }\n\nIf you have any other questions, just reply to this email.\n\nBest regards,\nThe Kitelane team`,
    }
    await streamText(writer, "Here's a draft based on your workspace documents.")
    const toolCallId = callId()
    writer.write({ type: "tool-input-available", toolCallId, toolName: "draftEmail", input })
    await sleep(500)
    const output = makeEmail(input)
    writer.write({ type: "tool-output-available", toolCallId, output })
    await streamText(writer, `\n\nThe draft is saved in **Actions** — review it before sending.${citeLine(sources)}`)
    return
  }

  if (/\b(meeting|schedule|book a|set up a call|sync with)\b/i.test(question)) {
    const who = question.match(/\bwith\s+(?:the\s+)?(.+?)(?:\s+(?:about|on|to|for|tomorrow|next)\b|[.?!]?$)/i)?.[1]
    const input = {
      title: subjectFrom(question.replace(/\bwith\s+(the\s+)?[\w\s]+?(?=\s+about)/i, "")),
      attendees: [who ? capitalize(who) : "Team"],
      date: nextWeekday(),
      time: "10:00",
      durationMinutes: 30,
      agenda: summary,
    }
    await streamText(writer, "Booking that for the next working day.")
    const toolCallId = callId()
    writer.write({ type: "tool-input-available", toolCallId, toolName: "scheduleMeeting", input })
    await sleep(500)
    const output = makeMeeting(input)
    writer.write({ type: "tool-output-available", toolCallId, output })
    await streamText(writer, `\n\nScheduled **${input.date} at ${input.time}** for ${input.durationMinutes} minutes.`)
    return
  }

  if (!evidence.length) {
    await streamText(
      writer,
      "I couldn't find anything about that in your workspace documents, so I won't guess. Try rephrasing the question, or upload a document that covers it in **Knowledge**."
    )
    return
  }

  const body = evidence.map((e) => `${e.text.replace(/[.]?$/, "")} [${e.n}].`).join(" ")
  await streamText(writer, `Here's what your documents say:\n\n${body}`)
}
