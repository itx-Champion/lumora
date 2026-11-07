"use client"

import { useState } from "react"
import { Globe, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useWorkspace } from "@/components/app/workspace-provider"

/** Imports a public web page into the knowledge base through the SSRF-safe server fetcher. */
export function UrlImport() {
  const { store } = useWorkspace()
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = url.trim()
    if (!value) return
    setLoading(true)
    try {
      const res = await fetch("/api/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: /^https?:\/\//i.test(value) ? value : `https://${value}` }),
      })
      const data = (await res.json()) as { title?: string; content?: string; url?: string; error?: string }
      if (!res.ok || !data.content || !data.url) throw new Error(data.error ?? "Import failed.")

      const host = new URL(data.url).hostname.replace(/^www\./, "")
      store.addDocuments([
        {
          id: crypto.randomUUID(),
          title: data.title ?? host,
          fileName: host,
          type: "web",
          content: data.content,
          size: new Blob([data.content]).size,
          createdAt: Date.now(),
          sourceUrl: data.url,
        },
      ])
      setUrl("")
      toast.success(`Imported “${data.title ?? host}”`, { description: "The page is now searchable by the assistant." })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border bg-card/60 p-4">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-violet" />
        <h3 className="font-semibold tracking-tight">Import from a website</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a help-center article, docs page or blog post. Lumora reads the main content and indexes it.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/help/refund-policy"
          inputMode="url"
          aria-label="Website URL"
          className="h-10 min-w-0 flex-1 rounded-xl border bg-background/60 px-3 text-sm outline-none focus:border-violet/50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {loading ? "Importing" : "Import"}
        </button>
      </div>
    </form>
  )
}
