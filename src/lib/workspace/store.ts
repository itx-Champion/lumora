import { createStore, del, get, set } from "idb-keyval"
import type { TemplateId } from "@/lib/demo/templates"
import type { LumoraUIMessage } from "@/lib/ai/types"
import type { KnowledgeDocument } from "@/lib/rag/types"
import { createSeedWorkspace } from "./seed"
import type { ActionRecord, Conversation, QuestionLog, Workspace, WorkspaceMeta } from "./types"

const idb = typeof indexedDB === "undefined" ? undefined : createStore("lumora", "workspaces")

const dataKey = (userId: string, workspaceId: string) => `workspace:${userId}:${workspaceId}`

/**
 * One workspace's data, persisted to IndexedDB and scoped to the signed-in user.
 * State is immutable: every mutation produces a new object, which keeps
 * useSyncExternalStore snapshots stable and persistence trivial.
 */
export class WorkspaceStore {
  private state: Workspace | null = null
  private listeners = new Set<() => void>()
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private readonly key: string
  private readonly legacyKey: string
  private readonly template: TemplateId

  constructor(userId: string, meta: WorkspaceMeta) {
    this.key = dataKey(userId, meta.id)
    this.legacyKey = `workspace:${userId}`
    this.template = meta.template
    // Data lives in the browser; during server rendering the store stays empty.
    if (typeof window !== "undefined") void this.load(meta.id === "default")
  }

  private async load(allowLegacy: boolean) {
    let saved = idb ? await get<Workspace>(this.key, idb).catch(() => undefined) : undefined
    // Workspaces created before multi-workspace support lived under a per-user key.
    if (!saved && allowLegacy && idb) {
      saved = await get<Workspace>(this.legacyKey, idb).catch(() => undefined)
    }
    this.state = saved?.version === 1 ? { ...saved, template: saved.template ?? this.template } : createSeedWorkspace(this.template)
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

  /** Thumbs up/down on an answer; the log shares the assistant message's id. */
  rateAnswer(messageId: string, rating: "up" | "down" | undefined) {
    this.update((ws) => ({
      ...ws,
      logs: ws.logs.map((l) => (l.id === messageId ? { ...l, rating } : l)),
    }))
  }

  async reset() {
    if (idb) await del(this.key, idb)
    this.state = createSeedWorkspace(this.template)
    this.persist()
    this.emit()
  }

  async destroy() {
    clearTimeout(this.saveTimer)
    if (idb) await del(this.key, idb)
  }
}

type RegistryState = { active: string; workspaces: WorkspaceMeta[] }

const DEFAULT_WORKSPACE: WorkspaceMeta = { id: "default", name: "Customer Support", template: "support", createdAt: 0 }

/** What the server renders (and the client hydrates with) before localStorage is read. */
export const defaultRegistryState: RegistryState = { active: DEFAULT_WORKSPACE.id, workspaces: [DEFAULT_WORKSPACE] }

/**
 * The list of a user's workspaces and which one is open. Small and read
 * synchronously on startup, so it lives in localStorage.
 */
export class WorkspaceRegistry {
  private state: RegistryState
  private listeners = new Set<() => void>()
  private readonly storageKey: string
  private readonly userId: string

  constructor(userId: string) {
    this.userId = userId
    this.storageKey = `lumora:workspaces:${userId}`
    this.state = this.read()
  }

  private read(): RegistryState {
    if (typeof window === "undefined") return defaultRegistryState
    try {
      const raw = localStorage.getItem(this.storageKey)
      const parsed = raw ? (JSON.parse(raw) as RegistryState) : null
      if (parsed?.workspaces?.length) return parsed
    } catch {}
    return defaultRegistryState
  }

  private write(next: RegistryState) {
    this.state = next
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(next))
    } catch {}
    this.listeners.forEach((l) => l())
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  get active(): WorkspaceMeta {
    return this.state.workspaces.find((w) => w.id === this.state.active) ?? this.state.workspaces[0]
  }

  create(template: TemplateId, name: string): WorkspaceMeta {
    const meta: WorkspaceMeta = { id: crypto.randomUUID(), name, template, createdAt: Date.now() }
    this.write({ active: meta.id, workspaces: [...this.state.workspaces, meta] })
    return meta
  }

  switchTo(id: string) {
    if (this.state.workspaces.some((w) => w.id === id)) this.write({ ...this.state, active: id })
  }

  async remove(id: string) {
    const remaining = this.state.workspaces.filter((w) => w.id !== id)
    if (!remaining.length) return
    if (idb) await del(dataKey(this.userId, id), idb)
    this.write({ active: this.state.active === id ? remaining[0].id : this.state.active, workspaces: remaining })
  }
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
