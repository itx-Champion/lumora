"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUp, BookOpen, Square, TriangleAlert } from "lucide-react"
import type { LumoraUIMessage } from "@/lib/ai/types"
import type { Source } from "@/lib/rag/types"
import { suggestedQuestions } from "@/lib/demo/sample-docs"
import { extractActions } from "@/lib/workspace/actions"
import { useWorkspace } from "@/components/app/workspace-provider"
import { LogoMark } from "@/components/shared/logo"
import { Message } from "./message"
import { SourceDialog } from "./source-dialog"
import { isToolPart } from "./tool-card"

type ChatProps = {
  conversationId: string
  initialMessages: LumoraUIMessage[]
  initialQuestion?: string
}

function textOf(message: LumoraUIMessage | undefined) {
  return message?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim() ?? ""
}

function errorMessage(error: Error) {
  try {
    return (JSON.parse(error.message) as { error?: string }).error ?? error.message
  } catch {
    return error.message || "Something went wrong."
  }
}

export function Chat({ conversationId, initialMessages, initialQuestion }: ChatProps) {
  const router = useRouter()
  const { store, index, user, workspace } = useWorkspace()
  const [input, setInput] = useState("")
  const [citation, setCitation] = useState<Source | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pending = useRef<{ text: string; sources: Source[]; startedAt: number } | null>(null)
  const autoSent = useRef(false)

  const transport = useMemo(() => new DefaultChatTransport<LumoraUIMessage>({ api: "/api/chat" }), [])

  const { messages, sendMessage, status, stop, regenerate, error, clearError } = useChat<LumoraUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: ({ messages, message, isError, isAbort }) => {
      store.saveConversation(conversationId, messages)
      store.recordActions(extractActions(messages, conversationId))

      const asked = pending.current
      pending.current = null
      if (!asked || isError || isAbort) return
      const meta = message.parts.find((p) => p.type === "data-meta")?.data
      const cited = new Set([...textOf(message).matchAll(/\[(\d{1,2})/g)].map((m) => Number(m[1])))
      const citedDocIds = [...new Set(asked.sources.filter((s) => cited.has(s.n)).map((s) => s.docId))]
      store.logQuestion({
        id: message.id,
        at: Date.now(),
        question: asked.text,
        latencyMs: Date.now() - asked.startedAt,
        answered: citedDocIds.length > 0 || message.parts.some(isToolPart),
        mode: meta?.mode ?? "demo",
        citedDocIds,
      })
    },
  })

  const busy = status === "submitted" || status === "streaming"

  /** Retrieves passages for the question, falling back to the previous turn for follow-ups. */
  function retrieve(question: string): Source[] {
    const primary = index.search(question, 6)
    if (primary.length >= 3) return primary
    const previous = textOf([...messages].reverse().find((m) => m.role === "user"))
    if (!previous) return primary
    const seen = new Set(primary.map((s) => s.chunkId))
    const extra = index.search(previous, 6).filter((s) => !seen.has(s.chunkId))
    return [...primary, ...extra].slice(0, 6).map((s, i) => ({ ...s, n: i + 1 }))
  }

  function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    const sources = retrieve(question)
    pending.current = { text: question, sources, startedAt: Date.now() }
    setInput("")
    clearError()
    void sendMessage({ text: question }, { body: { sources } })
    if (messages.length === 0) router.replace(`/app/chat?c=${conversationId}`, { scroll: false })
  }

  function retry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    const question = textOf(lastUser)
    const sources = retrieve(question)
    pending.current = { text: question, sources, startedAt: Date.now() }
    clearError()
    void regenerate({ body: { sources } })
  }

  // Auto-send a question passed in the URL (from the command palette or suggestions).
  useEffect(() => {
    if (initialQuestion && !autoSent.current && workspace) {
      autoSent.current = true
      send(initialQuestion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, workspace])

  // Keep the newest tokens in view unless the user has scrolled up to read.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom || status === "submitted") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  const firstName = user.name.split(" ")[0]

  return (
    <div className="flex h-full flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState
              name={firstName}
              documents={workspace?.documents.length ?? 0}
              passages={index.size}
              onAsk={send}
            />
          ) : (
            messages.map((m, i) => (
              <Message
                key={m.id}
                message={m}
                isLast={i === messages.length - 1}
                streaming={busy && i === messages.length - 1}
                onCite={setCitation}
                onRegenerate={retry}
              />
            ))
          )}

          {status === "submitted" && messages.at(-1)?.role === "user" && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <LogoMark className="size-7 animate-pulse" />
              Searching your workspace…
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="font-medium">Couldn&apos;t get an answer</p>
                <p className="mt-0.5 text-muted-foreground">{errorMessage(error)}</p>
              </div>
              <button onClick={retry} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-foreground/5">
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-card/80 p-2 shadow-[0_8px_40px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-colors focus-within:border-violet/40"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(input)
              }
            }}
            rows={1}
            placeholder="Ask about your docs, or ask Lumora to take an action…"
            aria-label="Message"
            className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void stop()}
              aria-label="Stop generating"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send message"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white transition-opacity disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
          Answers are grounded in your workspace documents. Always check the cited sources.
        </p>
      </div>

      <SourceDialog source={citation} onClose={() => setCitation(null)} />
    </div>
  )
}

function EmptyState({
  name,
  documents,
  passages,
  onAsk,
}: {
  name: string
  documents: number
  passages: number
  onAsk: (q: string) => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex flex-col items-center pt-[8vh] text-center">
      <LogoMark className="size-14" />
      <h2 className="mt-6 text-3xl font-semibold tracking-tight">
        {greeting}, {name}
      </h2>
      <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
        <BookOpen className="size-4" />
        {documents} documents · {passages} indexed passages ready to search
      </p>
      <div className="mt-10 grid w-full gap-2 sm:grid-cols-2">
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            onClick={() => onAsk(q)}
            className="rounded-2xl border bg-card/60 p-4 text-left text-sm transition-all hover:-translate-y-0.5 hover:border-violet/40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
