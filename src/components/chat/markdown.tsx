"use client"

import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Source } from "@/lib/rag/types"
import { cn } from "@/lib/utils"

/** Turns "[1]" and "[1, 2]" citation markers into links the renderer can style as chips. */
function linkCitations(text: string) {
  return text.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})*)\](?!\()/g, (_, nums: string) =>
    nums
      .split(",")
      .map((n) => `[${n.trim()}](#cite-${n.trim()})`)
      .join("")
  )
}

type MarkdownProps = {
  text: string
  sources: Source[]
  onCite: (source: Source) => void
}

export const Markdown = memo(function Markdown({ text, sources, onCite }: MarkdownProps) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const n = href?.startsWith("#cite-") ? Number(href.slice(6)) : null
            if (n !== null) {
              const source = sources.find((s) => s.n === n)
              return (
                <button
                  type="button"
                  onClick={() => source && onCite(source)}
                  disabled={!source}
                  title={source ? `${source.title}${source.section ? ` — ${source.section}` : ""}` : undefined}
                  className={cn(
                    "mx-0.5 inline-flex size-[18px] -translate-y-0.5 items-center justify-center rounded-md bg-violet/15 align-middle text-[10px] font-semibold text-violet transition-colors",
                    source && "hover:bg-violet hover:text-white"
                  )}
                >
                  {n}
                </button>
              )
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-violet underline underline-offset-2">
                {children}
              </a>
            )
          },
        }}
      >
        {linkCitations(text)}
      </ReactMarkdown>
    </div>
  )
})
