"use client"

import { Suspense, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { FileCode2, FileSpreadsheet, FileText, Layers, MessageSquare, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useWorkspace } from "@/components/app/workspace-provider"
import { UploadZone } from "@/components/knowledge/upload-zone"
import { RetrievalTester } from "@/components/knowledge/retrieval-tester"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Markdown } from "@/components/chat/markdown"
import type { KnowledgeDocument } from "@/lib/rag/types"
import { cn } from "@/lib/utils"

const typeIcon = { pdf: FileText, md: FileCode2, txt: FileText, csv: FileSpreadsheet, json: FileCode2 }
const typeColor = {
  pdf: "bg-red-500/10 text-red-500",
  md: "bg-violet/10 text-violet",
  txt: "bg-foreground/10 text-muted-foreground",
  csv: "bg-emerald-500/10 text-emerald-500",
  json: "bg-amber-500/10 text-amber-500",
}

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}

const dateFmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" })

function KnowledgeView() {
  const { workspace, chunks, store } = useWorkspace()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [filter, setFilter] = useState("")
  const openId = params.get("doc")

  const passagesByDoc = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of chunks) map.set(c.docId, (map.get(c.docId) ?? 0) + 1)
    return map
  }, [chunks])

  if (!workspace) return <KnowledgeSkeleton />

  const docs = workspace.documents.filter((d) =>
    `${d.title} ${d.fileName}`.toLowerCase().includes(filter.toLowerCase())
  )
  const totalSize = workspace.documents.reduce((s, d) => s + d.size, 0)
  const openDoc = workspace.documents.find((d) => d.id === openId) ?? null
  const citations = workspace.logs.reduce<Record<string, number>>((acc, l) => {
    for (const id of l.citedDocIds) acc[id] = (acc[id] ?? 0) + 1
    return acc
  }, {})

  const setOpen = (doc: KnowledgeDocument | null) =>
    router.replace(doc ? `${pathname}?doc=${doc.id}` : pathname, { scroll: false })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Documents", value: workspace.documents.length, icon: FileText },
          { label: "Indexed passages", value: chunks.length, icon: Layers },
          { label: "Knowledge size", value: formatSize(totalSize), icon: MessageSquare },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-4 rounded-2xl border bg-card/60 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <s.icon className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <UploadZone />

          <div className="rounded-3xl border bg-card/60">
            <div className="flex items-center gap-3 border-b p-4">
              <h3 className="font-semibold tracking-tight">Sources</h3>
              <label className="ml-auto flex items-center gap-2 rounded-lg border bg-background/60 px-2.5">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter"
                  className="h-8 w-28 bg-transparent text-sm outline-none sm:w-40"
                />
              </label>
            </div>
            <ul className="divide-y">
              {docs.map((doc) => {
                const Icon = typeIcon[doc.type]
                return (
                  <li key={doc.id} className="group flex items-center gap-3 p-3 pr-4 transition-colors hover:bg-foreground/[0.02]">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", typeColor[doc.type])}>
                      <Icon className="size-5" />
                    </span>
                    <button onClick={() => setOpen(doc)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-medium group-hover:text-violet">{doc.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {doc.fileName} · {formatSize(doc.size)} · {passagesByDoc.get(doc.id) ?? 0} passages ·{" "}
                        {dateFmt.format(doc.createdAt)}
                      </p>
                    </button>
                    {doc.sample && (
                      <span className="hidden rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
                        Sample
                      </span>
                    )}
                    <span className="hidden w-20 text-right text-xs text-muted-foreground md:inline">
                      {citations[doc.id] ?? 0} citations
                    </span>
                    <button
                      onClick={() => {
                        store.removeDocument(doc.id)
                        toast(`${doc.title} removed`, {
                          action: { label: "Undo", onClick: () => store.addDocuments([doc]) },
                        })
                      }}
                      aria-label={`Delete ${doc.title}`}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                )
              })}
              {docs.length === 0 && (
                <li className="p-8 text-center text-sm text-muted-foreground">
                  {workspace.documents.length ? "No documents match your filter." : "Upload your first document to get started."}
                </li>
              )}
            </ul>
          </div>
        </div>

        <RetrievalTester />
      </div>

      <Sheet open={openDoc !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
          {openDoc && (
            <div className="flex h-full flex-col">
              <div className="border-b p-6 pr-12">
                <SheetTitle className="text-lg">{openDoc.title}</SheetTitle>
                <SheetDescription>
                  {openDoc.fileName} · {formatSize(openDoc.size)} · {passagesByDoc.get(openDoc.id) ?? 0} passages
                </SheetDescription>
              </div>
              <div className="flex-1 overflow-y-auto p-6" data-lenis-prevent>
                {openDoc.type === "md" || openDoc.sample ? (
                  <Markdown text={openDoc.content} sources={[]} onCite={() => {}} />
                ) : (
                  <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{openDoc.content}</pre>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function KnowledgeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  )
}

export default function KnowledgePage() {
  return (
    <Suspense fallback={<KnowledgeSkeleton />}>
      <KnowledgeView />
    </Suspense>
  )
}
