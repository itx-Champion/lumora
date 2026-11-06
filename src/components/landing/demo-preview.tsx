"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useInView } from "motion/react"
import { ArrowRight, ArrowUp, Check, FileText, Loader2, Search, Ticket } from "lucide-react"
import { Accent, SectionHeading } from "@/components/shared/section-heading"
import { GlowButton } from "@/components/shared/glow-button"
import { LogoMark } from "@/components/shared/logo"
import { Reveal } from "@/components/shared/reveal"

const question = "A customer on an annual plan wants a refund after 3 weeks. Are they eligible?"
const answer =
  "Yes — annual plans are fully refundable within 30 days of purchase [1]. Three weeks is inside that window, so they qualify for a full refund to the original payment method, processed within 5–7 business days [2]."
const followUp = "Great, open a ticket for billing to process it."

const sources = [
  { n: 1, title: "Billing & refund policy", meta: "billing-policy.pdf · p.4" },
  { n: 2, title: "Support playbook", meta: "support-playbook.md · Refunds" },
]

type Phase =
  | "idle"
  | "typing-q"
  | "searching"
  | "answering"
  | "sources"
  | "typing-f"
  | "tool"
  | "done"

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function renderWithCitations(text: string) {
  return text.split(/(\[\d\])/g).map((part, i) => {
    const match = part.match(/^\[(\d)\]$/)
    if (!match) return <span key={i}>{part}</span>
    return (
      <sup
        key={i}
        className="mx-0.5 inline-flex size-4 -translate-y-0.5 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet"
      >
        {match[1]}
      </sup>
    )
  })
}

export function DemoPreview() {
  const frame = useRef<HTMLDivElement>(null)
  const inView = useInView(frame, { margin: "-20% 0px" })
  const [phase, setPhase] = useState<Phase>("idle")
  const [qChars, setQChars] = useState(0)
  const [aChars, setAChars] = useState(0)
  const [fChars, setFChars] = useState(0)

  useEffect(() => {
    if (!inView) return
    let cancelled = false

    const type = async (text: string, set: (n: number) => void, speed: number) => {
      for (let i = 1; i <= text.length && !cancelled; i++) {
        set(i)
        await wait(speed)
      }
    }

    // Plays the scripted conversation on a loop while the demo is on screen.
    const run = async () => {
      while (!cancelled) {
        setQChars(0)
        setAChars(0)
        setFChars(0)
        setPhase("typing-q")
        await wait(500)
        await type(question, setQChars, 28)
        if (cancelled) return
        setPhase("searching")
        await wait(1400)
        if (cancelled) return
        setPhase("answering")
        await type(answer, setAChars, 14)
        if (cancelled) return
        setPhase("sources")
        await wait(1400)
        if (cancelled) return
        setPhase("typing-f")
        await type(followUp, setFChars, 30)
        if (cancelled) return
        setPhase("tool")
        await wait(1600)
        if (cancelled) return
        setPhase("done")
        await wait(5000)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [inView])

  const at = (p: Phase) => {
    const order: Phase[] = ["idle", "typing-q", "searching", "answering", "sources", "typing-f", "tool", "done"]
    return order.indexOf(phase) >= order.indexOf(p)
  }

  return (
    <section id="demo" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Live preview"
          title={
            <>
              Watch it <Accent>think</Accent>, cite and act
            </>
          }
          description="A real workflow from a support team: answer a policy question with sources, then hand the follow-up to the agent."
        />

        <Reveal className="relative mt-16">
          <div className="pointer-events-none absolute -inset-x-10 -inset-y-16 -z-10 bg-[radial-gradient(ellipse_at_center,var(--brand-glow),transparent_65%)] blur-2xl" />
          <div
            ref={frame}
            className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-card/70 shadow-[0_40px_120px_-40px_rgb(0_0_0/0.5)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <span className="size-3 rounded-full bg-[#ff5f57]" />
              <span className="size-3 rounded-full bg-[#febc2e]" />
              <span className="size-3 rounded-full bg-[#28c840]" />
              <span className="ml-3 rounded-md bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
                Lumora · Workspace chat
              </span>
            </div>

            <div className="flex min-h-[460px] flex-col gap-5 p-5 sm:p-8">
              {at("typing-q") && (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm text-background">
                  {question.slice(0, qChars)}
                  {phase === "typing-q" && <Caret />}
                </div>
              )}

              <AnimatePresence>
                {phase === "searching" && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Search className="size-4 animate-pulse text-violet" />
                    Searching 3 sources across 1,284 passages…
                  </motion.div>
                )}
              </AnimatePresence>

              {at("answering") && (
                <div className="flex max-w-[92%] gap-3">
                  <LogoMark className="mt-0.5 size-7 shrink-0" />
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed">
                      {renderWithCitations(answer.slice(0, aChars))}
                      {phase === "answering" && <Caret />}
                    </p>
                    {at("sources") && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap gap-2"
                      >
                        {sources.map((s) => (
                          <span
                            key={s.n}
                            className="inline-flex items-center gap-2 rounded-xl border bg-background/70 px-2.5 py-1.5 text-xs"
                          >
                            <span className="flex size-4 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet">
                              {s.n}
                            </span>
                            <FileText className="size-3.5 text-muted-foreground" />
                            <span className="font-medium">{s.title}</span>
                            <span className="hidden text-muted-foreground sm:inline">{s.meta}</span>
                          </span>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              )}

              {at("typing-f") && (
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-3 text-sm text-background">
                  {followUp.slice(0, fChars)}
                  {phase === "typing-f" && <Caret />}
                </div>
              )}

              {at("tool") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex max-w-md gap-3"
                >
                  <LogoMark className="mt-0.5 size-7 shrink-0" />
                  <div className="flex-1 rounded-2xl border bg-background/70 p-4">
                    <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      {phase === "tool" ? (
                        <Loader2 className="size-3.5 animate-spin text-violet" />
                      ) : (
                        <Check className="size-3.5 text-emerald-500" />
                      )}
                      createTicket
                    </div>
                    <div className="mt-3 flex items-start gap-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
                        <Ticket className="size-4" />
                      </span>
                      <div className="text-sm">
                        <p className="font-medium">Process annual-plan refund</p>
                        <p className="text-muted-foreground">Billing · Priority P2 · LUM-1042</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="mt-auto flex items-center gap-2 rounded-2xl border bg-background/60 p-2 pl-4 text-sm text-muted-foreground">
                Ask anything about your workspace…
                <span className="ml-auto flex size-8 items-center justify-center rounded-xl bg-foreground text-background">
                  <ArrowUp className="size-4" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-10 flex justify-center">
            <GlowButton href="/login" size="lg">
              Try the live demo
              <ArrowRight className="size-4 transition-transform group-hover/glow:translate-x-0.5" />
            </GlowButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Caret() {
  return <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-current" />
}
