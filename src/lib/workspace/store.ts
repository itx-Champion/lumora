import { createStore, del, get, set } from "idb-keyval"
import type { LumoraUIMessage } from "@/lib/ai/types"
import type { KnowledgeDocument } from "@/lib/rag/types"
import { createSeedWorkspace } from "./seed"
import type { ActionRecord, Conversation, QuestionLog, Workspace } from "./types"

const idb = typeof indexedDB === "undefined" ? undefined : createStore("lumora", "workspaces")

export type WorkspaceStatus = "loading" | "ready"

/**
 * A workspace lives in the browser's IndexedDB, scoped to the signed-in user.
 * State is immutable: every mutation produces a new object, which keeps
 * useSyncExternalStore snapshots stable and makes undo/persistence trivial.
 */
export class WorkspaceStore {
  private state: Workspace | null = null
  private listeners = new Set<() => void>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private readonly key: string

  constructor(userId: string) {
    this.key = `workspace:${userId}`
    void this.load()
  }

  private async load() {
    const saved = idb ? await get<Workspace>(this.key, idb).catch(() => undefined) : undefined
    this.state = saved?.version === 1 ? saved : createSeedWorkspace()
    if (!saved) this.persist()
    this.emit()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  private emit() {
    this.listeners.forEach((l) => l())
  }

  private persist() {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      if (idb && this.state) void set(this.key, this.state, idb)
    }, 250)
  }

  private update(recipe: (ws: Workspace) => Workspace) {
    if (!this.state) return
    this.state = recipe(this.state)
    this.persist()
    this.emit()
  }

  addDocuments(docs: KnowledgeDocument[]) {
    this.update((ws) => ({ ...ws, documents: [...docs, ...ws.documents] }))
  }

  removeDocument(id: string) {
    this.update((ws) => ({ ...ws, documents: ws.documents.filter((d) => d.id !== id) }))
  }

  saveConversation(id: string, messages: LumoraUIMessage[]) {
    this.update((ws) => {
      const now = Date.now()
      const existing = ws.conversations.find((c) => c.id === id)
      const firstText = messages
        .find((m) => m.role === "user")
        ?.parts.find((p) => p.type === "text")?.text
      const conversation: Conversation = {
        id,
        title: existing?.title ?? truncate(firstText ?? "New conversation", 60),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        messages,
      }
      return {
        ...ws,
        conversations: [conversation, ...ws.conversations.filter((c) => c.id !== id)],
      }
    })
  }

  deleteConversation(id: string) {
    this.update((ws) => ({ ...ws, conversations: ws.conversations.filter((c) => c.id !== id) }))
  }

  /** Adds tool results from a chat turn, ignoring ones already recorded. */
  recordActions(actions: ActionRecord[]) {
    this.update((ws) => {
      const known = new Set(ws.actions.map((a) => a.toolCallId))
      const fresh = actions.filter((a) => !known.has(a.toolCallId))
      return fresh.length ? { ...ws, actions: [...fresh, ...ws.actions] } : ws
    })
  }

  toggleActionDone(toolCallId: string) {
    this.update((ws) => ({
      ...ws,
      actions: ws.actions.map((a) => (a.toolCallId === toolCallId ? { ...a, done: !a.done } : a)),
    }))
  }

  logQuestion(log: QuestionLog) {
    this.update((ws) => ({ ...ws, logs: [...ws.logs, log] }))
  }

  async reset() {
    if (idb) await del(this.key, idb)
    this.state = createSeedWorkspace()
    this.persist()
    this.emit()
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
