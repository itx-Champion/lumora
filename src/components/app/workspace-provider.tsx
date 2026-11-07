"use client"

import { createContext, use, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"
import { templates, type TemplateId, type WorkspaceTemplate } from "@/lib/demo/templates"
import { Bm25Index } from "@/lib/rag/bm25"
import { chunkDocument } from "@/lib/rag/chunk"
import type { Chunk } from "@/lib/rag/types"
import { WorkspaceRegistry, WorkspaceStore, defaultRegistryState } from "@/lib/workspace/store"
import type { Workspace, WorkspaceMeta } from "@/lib/workspace/types"

export type WorkspaceUser = { id: string; name: string; email: string; image?: string | null }

type WorkspaceContextValue = {
  user: WorkspaceUser
  store: WorkspaceStore
  workspace: Workspace | null
  chunks: Chunk[]
  index: Bm25Index
  workspaces: WorkspaceMeta[]
  activeWorkspace: WorkspaceMeta
  template: WorkspaceTemplate
  createWorkspace: (template: TemplateId, name: string) => void
  switchWorkspace: (id: string) => void
  removeWorkspace: (id: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ user, children }: { user: WorkspaceUser; children: ReactNode }) {
  const registry = useMemo(() => new WorkspaceRegistry(user.id), [user.id])
  const registryState = useSyncExternalStore(registry.subscribe, registry.getSnapshot, () => defaultRegistryState)
  const activeWorkspace =
    registryState.workspaces.find((w) => w.id === registryState.active) ?? registryState.workspaces[0]

  // Each workspace gets its own store; switching swaps the whole data set.
  const store = useMemo(() => new WorkspaceStore(user.id, activeWorkspace), [user.id, activeWorkspace])
  const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null)
  const documents = workspace?.documents

  // Re-index only when the document list changes.
  const { chunks, index } = useMemo(() => {
    const chunks = (documents ?? []).flatMap(chunkDocument)
    return { chunks, index: new Bm25Index(chunks) }
  }, [documents])

  useEffect(() => {
    document.title = `${activeWorkspace.name} · Lumora`
  }, [activeWorkspace.name])

  const value: WorkspaceContextValue = {
    user,
    store,
    workspace,
    chunks,
    index,
    workspaces: registryState.workspaces,
    activeWorkspace,
    template: templates[workspace?.template ?? activeWorkspace.template],
    createWorkspace: (template, name) => registry.create(template, name),
    switchWorkspace: (id) => registry.switchTo(id),
    removeWorkspace: (id) => registry.remove(id),
  }

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>
}

export function useWorkspace() {
  const ctx = use(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>")
  return ctx
}
