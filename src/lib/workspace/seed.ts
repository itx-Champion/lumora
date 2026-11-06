import { sampleDocs } from "@/lib/demo/sample-docs"
import type { KnowledgeDocument } from "@/lib/rag/types"
import type { QuestionLog, Workspace } from "./types"

const DAY = 24 * 60 * 60 * 1000

const sampleQuestions = [
  "How long do refunds take?",
  "Can we refund an annual plan after 2 months?",
  "What's the API rate limit on Pro?",
  "How many vacation days carry over?",
  "Where is EU customer data stored?",
  "Who approves refunds over $500?",
  "How do I reset 2FA for a member?",
  "What was ARR at the end of Q3?",
  "What is the parental leave policy?",
  "Do we have a mobile app?",
  "What happens after a failed payment?",
  "Is customer data used to train AI?",
  "What's our uptime SLA?",
  "What is the learning budget?",
  "Do we support SAML for Starter plans?",
  "What's the office address in Berlin?",
]

// Questions with no answer in the sample docs show up as knowledge gaps.
const unanswerable = new Set(["Do we support SAML for Starter plans?", "What's the office address in Berlin?"])

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createSampleDocuments(now = Date.now()): KnowledgeDocument[] {
  return sampleDocs.map((doc, i) => ({
    id: `sample-${i + 1}`,
    title: doc.title,
    fileName: doc.fileName,
    type: doc.type,
    content: doc.content,
    size: new Blob([doc.content]).size,
    createdAt: now - (30 - i * 3) * DAY,
    sample: true,
  }))
}

/** Three weeks of plausible usage so the analytics dashboard isn't empty on first visit. */
function createSampleLogs(documents: KnowledgeDocument[], now: number): QuestionLog[] {
  const rand = mulberry32(2026)
  const logs: QuestionLog[] = []
  for (let day = 21; day >= 1; day--) {
    const weekday = new Date(now - day * DAY).getDay()
    const base = weekday === 0 || weekday === 6 ? 3 : 9
    const count = Math.round(base + rand() * 6 + (21 - day) * 0.35)
    for (let i = 0; i < count; i++) {
      const question = sampleQuestions[Math.floor(rand() * sampleQuestions.length)]
      const answered = !unanswerable.has(question)
      const doc = documents[Math.floor(rand() * documents.length)]
      logs.push({
        id: `sample-log-${day}-${i}`,
        at: now - day * DAY + Math.floor((8 + rand() * 10) * 60 * 60 * 1000),
        question,
        latencyMs: Math.round(650 + rand() * 1400),
        answered,
        mode: "gemini",
        citedDocIds: answered ? [doc.id] : [],
        sample: true,
      })
    }
  }
  return logs
}

export function createSeedWorkspace(now = Date.now()): Workspace {
  const documents = createSampleDocuments(now)
  return {
    version: 1,
    documents,
    conversations: [],
    actions: [],
    logs: createSampleLogs(documents, now),
  }
}
