"use client"

import { createContext, use, useMemo, useSyncExternalStore, type ReactNode } from "react"
import { Bm25Index } from "@/lib/rag/bm25"
import { chunkDocument } from "@/lib/rag/chunk"
import type { Chunk } from "@/lib/rag/types"
import { WorkspaceStore } from "@/lib/workspace/store"
import type { Workspace } from "@/lib/workspace/types"

export type WorkspaceUser = { id: string; name: string; email: string; image?: string | null }

type WorkspaceContextValue = {
  user: WorkspaceUser
  store: WorkspaceStore
  workspace: Workspace | null
  chunks: Chunk[]
  index: Bm25Index
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ user, children }: { user: WorkspaceUser; children: ReactNode }) {
  const store = useMemo(() => new WorkspaceStore(user.id), [user.id])
  const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null)
  const documents = workspace?.documents

  // Re-index only when the document list changes.
  const { chunks, index } = useMemo(() => {
    const chunks = (documents ?? []).flatMap(chunkDocument)
    return { chunks, index: new Bm25Index(chunks) }
  }, [documents])

  return (
    <WorkspaceContext value={{ user, store, workspace, chunks, index }}>{children}</WorkspaceContext>
  )
}

export function useWorkspace() {
  const ctx = use(WorkspaceContext)
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>")
  return ctx
}
