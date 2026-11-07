"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { Check, Copy, CornerDownRight, FileText, RotateCcw, Search, ThumbsDown, ThumbsUp, Volume2, VolumeX, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LumoraUIMessage } from "@/lib/ai/types"
import type { Source } from "@/lib/rag/types"
import { LogoMark } from "@/components/shared/logo"
import { Markdown } from "./markdown"
import { ToolCard, isToolPart } from "./tool-card"

type MessageProps = {
  message: LumoraUIMessage
  streaming: boolean
  isLast: boolean
  onCite: (source: Source) => void
  onRegenerate: () => void
  rating?: "up" | "down"
  onRate?: (rating: "up" | "down" | undefined) => void
  speaking?: boolean
  onSpeak?: () => void
  followUps?: string[]
  onAsk?: (question: string) => void
}

const modeLabel = { gemini: "Gemini", groq: "Groq", demo: "Demo mode" } as const

export function Message({
  message,
  streaming,
  isLast,
  onCite,
  onRegenerate,
  rating,
  onRate,
  speaking,
  onSpeak,
  followUps = [],
  onAsk,
}: MessageProps) {
  const [copied, setCopied] = useState(false)

  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-background"
      >
        {text}
      </motion.div>
    )
  }

  const sources = message.parts.find((p) => p.type === "data-sources")?.data ?? []
  const meta = message.parts.find((p) => p.type === "data-meta")?.data
  const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n")
  const hasContent = message.parts.some((p) => (p.type === "text" && p.text) || isToolPart(p))
  const cited = new Set([...text.matchAll(/\[(\d{1,2})/g)].map((m) => Number(m[1])))
  const citedSources = sources.filter((s) => cited.has(s.n))

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <LogoMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        {!hasContent && streaming && (
          <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <Search className="size-4 animate-pulse text-violet" />
            {sources.length
              ? `Reading ${sources.length} relevant passage${sources.length === 1 ? "" : "s"}…`
              : "Thinking…"}
          </div>
        )}

        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text) {
            return <Markdown key={i} text={part.text} sources={sources} onCite={onCite} />
          }
          if (isToolPart(part)) return <ToolCard key={part.toolCallId} part={part} />
          return null
        })}

        {!streaming && hasContent && (
          <div className="mt-3 space-y-3">
            {citedSources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {citedSources.map((s) => (
                  <button
                    key={s.chunkId}
                    onClick={() => onCite(s)}
                    className="inline-flex max-w-full items-center gap-2 rounded-xl border bg-background/60 px-2.5 py-1.5 text-xs transition-colors hover:border-violet/40"
                  >
                    <span className="flex size-4 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet">
                      {s.n}
                    </span>
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{s.title}</span>
                    {s.section && <span className="hidden truncate text-muted-foreground sm:inline">{s.section}</span>}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {meta && (
                <span
                  className="mr-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                  title={meta.model}
                >
                  <Zap className="size-3" />
                  {modeLabel[meta.mode]}
                  {meta.mode !== "demo" && <span className="hidden sm:inline">· {meta.model}</span>}
                </span>
              )}
              {onSpeak && (
                <button
                  onClick={onSpeak}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 hover:text-foreground",
                    speaking && "text-violet"
                  )}
                  aria-label={speaking ? "Stop reading" : "Read answer aloud"}
                >
                  {speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                </button>
              )}
              {onRate && (
                <>
                  <button
                    onClick={() => onRate(rating === "up" ? undefined : "up")}
                    aria-label="Helpful"
                    aria-pressed={rating === "up"}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 hover:text-foreground",
                      rating === "up" && "text-emerald-500"
                    )}
                  >
                    <ThumbsUp className={cn("size-3.5", rating === "up" && "fill-current")} />
                  </button>
                  <button
                    onClick={() => onRate(rating === "down" ? undefined : "down")}
                    aria-label="Not helpful"
                    aria-pressed={rating === "down"}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 hover:text-foreground",
                      rating === "down" && "text-amber-500"
                    )}
                  >
                    <ThumbsDown className={cn("size-3.5", rating === "down" && "fill-current")} />
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(text)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
                className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 hover:text-foreground"
                aria-label="Copy answer"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
              {isLast && (
                <button
                  onClick={onRegenerate}
                  className="flex size-7 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 hover:text-foreground"
                  aria-label="Regenerate answer"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>

            {isLast && followUps.length > 0 && onAsk && (
              <div className="flex flex-col items-start gap-1.5 pt-1">
                {followUps.map((q) => (
                  <button
                    key={q}
                    onClick={() => onAsk(q)}
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:border-violet/40 hover:text-foreground"
                  >
                    <CornerDownRight className="size-3.5 shrink-0 text-violet" />
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
