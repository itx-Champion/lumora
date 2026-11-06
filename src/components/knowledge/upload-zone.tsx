"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CheckCircle2, FileUp, Loader2, TriangleAlert, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { DocumentType, KnowledgeDocument } from "@/lib/rag/types"
import { useWorkspace } from "@/components/app/workspace-provider"

const ACCEPT = [".pdf", ".md", ".markdown", ".txt", ".csv", ".json"]
const MAX_BYTES = 4 * 1024 * 1024

type UploadItem = { id: string; name: string; state: "reading" | "done" | "error"; message?: string }

function typeOf(name: string): DocumentType {
  const ext = name.toLowerCase().split(".").pop()
  if (ext === "pdf") return "pdf"
  if (ext === "md" || ext === "markdown") return "md"
  if (ext === "csv") return "csv"
  if (ext === "json") return "json"
  return "txt"
}

function titleFrom(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim()
  return base.charAt(0).toUpperCase() + base.slice(1)
}

async function readFile(file: File): Promise<string> {
  if (typeOf(file.name) !== "pdf") {
    const text = await file.text()
    if (typeOf(file.name) === "json") {
      try {
        return JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        return text
      }
    }
    return text
  }
  const body = new FormData()
  body.append("file", file)
  const res = await fetch("/api/parse", { method: "POST", body })
  const data = (await res.json()) as { text?: string; error?: string }
  if (!res.ok || !data.text) throw new Error(data.error ?? "Couldn't read this PDF.")
  return data.text
}

export function UploadZone() {
  const { store } = useWorkspace()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [items, setItems] = useState<UploadItem[]>([])

  async function handleFiles(files: FileList | File[]) {
    const list = [...files]
    for (const file of list) {
      const id = crypto.randomUUID()
      const update = (patch: Partial<UploadItem>) =>
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
      setItems((prev) => [{ id, name: file.name, state: "reading" as const }, ...prev].slice(0, 6))

      if (!ACCEPT.some((ext) => file.name.toLowerCase().endsWith(ext))) {
        update({ state: "error", message: "Unsupported file type" })
        continue
      }
      if (file.size > MAX_BYTES) {
        update({ state: "error", message: "Larger than 4 MB" })
        continue
      }

      try {
        const content = (await readFile(file)).trim()
        if (content.length < 20) throw new Error("The file looks empty.")
        const doc: KnowledgeDocument = {
          id,
          title: titleFrom(file.name),
          fileName: file.name,
          type: typeOf(file.name),
          content,
          size: file.size,
          createdAt: Date.now(),
        }
        store.addDocuments([doc])
        update({ state: "done" })
        toast.success(`${doc.title} indexed`, { description: "It's now searchable by the assistant." })
      } catch (error) {
        update({ state: "error", message: error instanceof Error ? error.message : "Upload failed" })
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFiles(e.dataTransfer.files)
        }}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all",
          dragging ? "scale-[1.01] border-violet bg-violet/5" : "hover:border-violet/50 hover:bg-foreground/[0.02]"
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white shadow-[0_10px_30px_-8px_var(--brand-glow)] transition-transform group-hover:-translate-y-1">
          <UploadCloud className="size-6" />
        </span>
        <p className="mt-4 font-medium">Drop files here or click to upload</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF, Markdown, TXT, CSV or JSON · up to 4 MB each</p>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </button>

      <AnimatePresence initial={false}>
        {items.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-3 space-y-2"
          >
            {items.map((it) => (
              <motion.li
                key={it.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 rounded-xl border bg-card/60 px-3 py-2 text-sm"
              >
                <FileUp className="size-4 text-muted-foreground" />
                <span className="truncate">{it.name}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs">
                  {it.state === "reading" && (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-violet" /> Parsing & indexing
                    </>
                  )}
                  {it.state === "done" && (
                    <>
                      <CheckCircle2 className="size-3.5 text-emerald-500" /> Indexed
                    </>
                  )}
                  {it.state === "error" && (
                    <>
                      <TriangleAlert className="size-3.5 text-destructive" /> {it.message}
                    </>
                  )}
                </span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
