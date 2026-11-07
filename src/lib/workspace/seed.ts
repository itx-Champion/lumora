import { templates, type TemplateId } from "@/lib/demo/templates"
import type { KnowledgeDocument } from "@/lib/rag/types"
import type { QuestionLog, Workspace } from "./types"

const DAY = 24 * 60 * 60 * 1000

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createTemplateDocuments(templateId: TemplateId, now = Date.now()): KnowledgeDocument[] {
  return templates[templateId].docs.map((doc, i) => ({
    id: `${templateId}-sample-${i + 1}`,
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
function createSampleLogs(templateId: TemplateId, documents: KnowledgeDocument[], now: number): QuestionLog[] {
  const { history, gaps } = templates[templateId]
  if (!history.length || !documents.length) return []

  const rand = mulberry32(2026 + templateId.length)
  const pool = [...history, ...gaps]
  const logs: QuestionLog[] = []
  for (let day = 21; day >= 1; day--) {
    const weekday = new Date(now - day * DAY).getDay()
    const base = weekday === 0 || weekday === 6 ? 3 : 9
    const count = Math.round(base + rand() * 6 + (21 - day) * 0.35)
    for (let i = 0; i < count; i++) {
      const question = pool[Math.floor(rand() * pool.length)]
      const answered = !gaps.includes(question)
      const doc = documents[Math.floor(rand() * documents.length)]
      const rated = rand() < 0.35
      logs.push({
        id: `sample-log-${day}-${i}`,
        at: now - day * DAY + Math.floor((8 + rand() * 10) * 60 * 60 * 1000),
        question,
        latencyMs: Math.round(650 + rand() * 1400),
        answered,
        mode: "gemini",
        citedDocIds: answered ? [doc.id] : [],
        rating: rated ? (answered && rand() < 0.88 ? "up" : "down") : undefined,
        sample: true,
      })
    }
  }
  return logs
}

export function createSeedWorkspace(templateId: TemplateId = "support", now = Date.now()): Workspace {
  const documents = createTemplateDocuments(templateId, now)
  return {
    version: 1,
    template: templateId,
    documents,
    conversations: [],
    actions: [],
    logs: createSampleLogs(templateId, documents, now),
  }
}
