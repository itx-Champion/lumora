"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUp, BookOpen, Download, Mic, Square, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import type { LumoraUIMessage } from "@/lib/ai/types"
import type { Chunk, Source } from "@/lib/rag/types"
import { extractActions } from "@/lib/workspace/actions"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/components/app/workspace-provider"
import { LogoMark } from "@/components/shared/logo"
import { useSpeechInput, useSpeechOutput } from "@/hooks/use-speech"
import { useModelPreference } from "@/hooks/use-model-preference"
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

/** Suggests questions about neighbouring sections of the documents an answer cited. */
function suggestFollowUps(message: LumoraUIMessage, chunks: Chunk[], asked: Set<string>) {
  const sources = message.parts.find((p) => p.type === "data-sources")?.data ?? []
  const cited = new Set([...textOf(message).matchAll(/\[(\d{1,2})/g)].map((m) => Number(m[1])))
  const citedSources = sources.filter((s) => cited.has(s.n))
  if (!citedSources.length) return []

  const usedSections = new Set(citedSources.map((s) => `${s.docId}:${s.section}`))
  const suggestions: string[] = []
  for (const source of citedSources) {
    for (const chunk of chunks) {
      if (chunk.docId !== source.docId || !chunk.section || chunk.section === chunk.docTitle) continue
      const key = `${chunk.docId}:${chunk.section}`
      if (usedSections.has(key)) continue
      usedSections.add(key)
      const topic = /^[A-Z]{2,}/.test(chunk.section) ? chunk.section : chunk.section.charAt(0).toLowerCase() + chunk.section.slice(1)
      const question = chunk.section.endsWith("?") ? chunk.section : `What does the ${chunk.docTitle.toLowerCase()} say about ${topic}?`
      if (!asked.has(question.toLowerCase())) suggestions.push(question)
      if (suggestions.length === 3) return suggestions
    }
  }
  return suggestions
}

function toMarkdown(title: string, messages: LumoraUIMessage[]) {
  const lines = [`# ${title}`, "", `_Exported from Lumora on ${new Date().toLocaleString()}_`, ""]
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`**You:** ${textOf(m)}`, "")
      continue
    }
    lines.push(`**Lumora:** ${textOf(m)}`, "")
    for (const part of m.parts) {
      if (isToolPart(part) && part.state === "output-available") {
        const output = part.output as Record<string, unknown>
        const ref = output.id ?? output.deal ?? output.title ?? "done"
        lines.push(`> Action \`${part.type.replace("tool-", "")}\` → ${String(ref)}`, "")
      }
    }
    const sources = m.parts.find((p) => p.type === "data-sources")?.data ?? []
    if (sources.length) {
      lines.push("Sources:")
      for (const s of sources) lines.push(`- [${s.n}] ${s.title}${s.section ? ` — ${s.section}` : ""}`)
      lines.push("")
    }
  }
  return lines.join("\n")
}

export function Chat({ conversationId, initialMessages, initialQuestion }: ChatProps) {
  const router = useRouter()
  const { store, index, chunks, user, workspace, activeWorkspace, template } = useWorkspace()
  const { preference } = useModelPreference()
  const [input, setInput] = useState("")
  const [citation, setCitation] = useState<Source | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pending = useRef<{ text: string; sources: Source[]; startedAt: number } | null>(null)
  const autoSent = useRef(false)
  const voiceTurn = useRef(false)
  const voice = useSpeechOutput()

  const transport = useMemo(() => new DefaultChatTransport<LumoraUIMessage>({ api: "/api/chat" }), [])

  const { messages, setMessages, sendMessage, status, stop, regenerate, error, clearError } = useChat<LumoraUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    onFinish: ({ messages, message, isError, isAbort }) => {
      store.saveConversation(conversationId, messages)
      store.recordActions(extractActions(messages, conversationId))
      // Give a new chat its own URL only once the answer is saved. Changing the URL while
      // a request is in flight re-renders the route and can drop the pending answer.
      if (!new URLSearchParams(window.location.search).get("c")) {
        router.replace(`/app/chat?c=${conversationId}`, { scroll: false })
      }

      // Questions asked by voice are answered by voice.
      if (voiceTurn.current && !isError && !isAbort) voice.speak(message.id, textOf(message))
      voiceTurn.current = false

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
  const requestBody = (sources: Source[]) => ({
    sources,
    model: preference,
    workspace: { name: activeWorkspace.name, company: template.company },
  })

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
    voice.stop()
    const sources = retrieve(question)
    pending.current = { text: question, sources, startedAt: Date.now() }
    setInput("")
    clearError()
    void sendMessage({ text: question }, { body: requestBody(sources) })
  }

  function retry() {
    const question = textOf([...messages].reverse().find((m) => m.role === "user"))
    const sources = retrieve(question)
    pending.current = { text: question, sources, startedAt: Date.now() }
    clearError()
    void regenerate({ body: requestBody(sources) })
  }

  const mic = useSpeechInput((text) => {
    voiceTurn.current = true
    send(text)
  })

  // Auto-send a question passed in the URL (from the command palette or suggestions).
  // Deferred and cancellable, so a mount/unmount/remount cycle (Strict Mode, route
  // re-renders) sends exactly once from the instance that stays mounted.
  useEffect(() => {
    if (!initialQuestion || autoSent.current || !workspace) return
    const timer = setTimeout(() => {
      autoSent.current = true
      send(initialQuestion)
    }, 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, workspace])

  // Keep the newest tokens in view unless the user has scrolled up to read.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom || status === "submitted") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages, status])

  const ratings = useMemo(() => new Map(workspace?.logs.filter((l) => l.rating).map((l) => [l.id, l.rating])), [workspace?.logs])
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  const followUps = useMemo(() => {
    if (!lastAssistant || busy) return []
    const asked = new Set(messages.filter((m) => m.role === "user").map((m) => textOf(m).toLowerCase()))
    return suggestFollowUps(lastAssistant, chunks, asked)
  }, [lastAssistant, busy, messages, chunks])

  const title = textOf(messages.find((m) => m.role === "user")).slice(0, 80) || "Conversation"

  return (
    <div className="flex h-full flex-col">
      {messages.length > 0 && (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 sm:px-6">
          <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{title}</p>
          <button
            onClick={() => {
              const blob = new Blob([toMarkdown(title, messages)], { type: "text/markdown" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `lumora-chat-${conversationId.slice(0, 8)}.md`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <Download className="size-3.5" /> Export
          </button>
          <button
            onClick={() => {
              stop()
              voice.stop()
              store.deleteConversation(conversationId)
              setMessages([])
              toast("Conversation deleted")
              router.replace("/app/chat?new=1")
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto" data-lenis-prevent>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState
              name={user.name.split(" ")[0]}
              workspaceName={activeWorkspace.name}
              documents={workspace?.documents.length ?? 0}
              passages={index.size}
              suggestions={template.suggested}
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
                rating={ratings.get(m.id)}
                onRate={m.role === "assistant" ? (r) => store.rateAnswer(m.id, r) : undefined}
                speaking={voice.speakingId === m.id}
                onSpeak={
                  voice.supported && m.role === "assistant"
                    ? () => (voice.speakingId === m.id ? voice.stop() : voice.speak(m.id, textOf(m)))
                    : undefined
                }
                followUps={m === lastAssistant ? followUps : undefined}
                onAsk={send}
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
          className={cn(
            "mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-card/80 p-2 shadow-[0_8px_40px_-16px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-colors focus-within:border-violet/40",
            mic.listening && "border-violet/60"
          )}
        >
          <textarea
            value={mic.listening ? mic.transcript : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send(input)
              }
            }}
            readOnly={mic.listening}
            rows={1}
            placeholder={mic.listening ? "Listening… speak your question" : "Ask about your docs, or ask Lumora to take an action…"}
            aria-label="Message"
            className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-muted-foreground"
          />
          {mic.supported && !busy && (
            <button
              type="button"
              onClick={() => (mic.listening ? mic.stop() : mic.start())}
              aria-label={mic.listening ? "Stop listening" : "Ask by voice"}
              className={cn(
                "relative flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                mic.listening ? "border-violet bg-violet text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mic.listening && <span className="absolute inset-0 animate-ping rounded-xl bg-violet/40" />}
              <Mic className="relative size-4" />
            </button>
          )}
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
  workspaceName,
  documents,
  passages,
  suggestions,
  onAsk,
}: {
  name: string
  workspaceName: string
  documents: number
  passages: number
  suggestions: string[]
  onAsk: (q: string) => void
}) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <div className="flex flex-col items-center pt-[6vh] text-center">
      <LogoMark className="size-14" />
      <h2 className="mt-6 text-3xl font-semibold tracking-tight">
        {greeting}, {name}
      </h2>
      <p className="mt-2 text-muted-foreground">Ask anything about {workspaceName}.</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
        <BookOpen className="size-4" />
        {documents} documents · {passages} indexed passages
      </p>
      <div className="mt-10 grid w-full gap-2 sm:grid-cols-2">
        {suggestions.map((q) => (
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
