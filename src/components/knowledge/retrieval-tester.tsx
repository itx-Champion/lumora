"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { FlaskConical, Search } from "lucide-react"
import { useWorkspace } from "@/components/app/workspace-provider"

/** Shows exactly which passages the assistant would receive for a query, with BM25 scores. */
export function RetrievalTester() {
  const { index, template } = useWorkspace()
  const [query, setQuery] = useState(template.suggested[0] ?? "")
  const deferred = useDeferredValue(query)
  const results = useMemo(() => index.search(deferred, 4), [index, deferred])
  const top = results[0]?.score ?? 1

  return (
    <div className="rounded-3xl border bg-card/60 p-5">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 text-violet" />
        <h3 className="font-semibold tracking-tight">Retrieval playground</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        See which passages the assistant receives for a question, ranked by BM25 relevance.
      </p>
      <label className="mt-4 flex items-center gap-2 rounded-xl border bg-background/60 px-3 focus-within:border-violet/40">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try a question…"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </label>

      <ol className="mt-4 space-y-2">
        {results.length === 0 && (
          <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            No passages match — the assistant would say it couldn&apos;t find an answer.
          </li>
        )}
        {results.map((r) => (
          <li key={r.chunkId} className="rounded-xl border bg-background/50 p-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex size-5 items-center justify-center rounded-md bg-violet/15 font-semibold text-violet">
                {r.n}
              </span>
              <span className="truncate font-medium">{r.title}</span>
              {r.section && <span className="truncate text-muted-foreground">· {r.section}</span>}
              <span className="ml-auto font-mono text-muted-foreground">{r.score.toFixed(2)}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-violet),var(--brand-cyan))] transition-[width] duration-500"
                style={{ width: `${(r.score / top) * 100}%` }}
              />
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {r.text.replace(/^#+\s/gm, "")}
            </p>
          </li>
        ))}
      </ol>
    </div>
  )
}
