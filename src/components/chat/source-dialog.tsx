"use client"

import Link from "next/link"
import { ArrowUpRight, FileText } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { Source } from "@/lib/rag/types"

export function SourceDialog({ source, onClose }: { source: Source | null; onClose: () => void }) {
  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {source && (
          <>
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet">
                <FileText className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-md bg-violet/15 text-[11px] font-semibold text-violet">
                    {source.n}
                  </span>
                  {source.title}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {source.fileName}
                  {source.section && ` · ${source.section}`}
                </DialogDescription>
              </div>
            </div>
            <blockquote
              className="max-h-72 overflow-y-auto rounded-xl border-l-2 border-violet bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-line"
              data-lenis-prevent
            >
              {source.text.replace(/^#+\s/gm, "")}
            </blockquote>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Relevance score {source.score.toFixed(2)} (BM25)</span>
              <Link
                href={`/app/knowledge?doc=${source.docId}`}
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-violet"
              >
                Open document <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
