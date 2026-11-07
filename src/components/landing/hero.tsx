"use client"

import { useRef } from "react"
import { motion, type Variants } from "motion/react"
import { ArrowRight, FileText, Play, Sparkles, Ticket, Zap } from "lucide-react"
import { HeroScene } from "@/components/three/hero-scene"
import { GlowButton } from "@/components/shared/glow-button"

const ease = [0.22, 1, 0.36, 1] as const

const word: Variants = {
  hidden: { opacity: 0, y: "0.4em", filter: "blur(10px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.9, ease, delay: 0.35 + i * 0.07 },
  }),
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease, delay },
})

const headline: { text: string; accent?: boolean }[][] = [
  [{ text: "Your" }, { text: "company's" }, { text: "knowledge," }],
  [{ text: "answered", accent: true }, { text: "by" }, { text: "AI." }],
]

const highlights = ["Answers with citations", "Acts in your tools", "Live in minutes"]

const floatingCards = [
  {
    icon: FileText,
    title: "3 sources cited",
    detail: "Handbook · Q3 report · Wiki",
    className: "right-[24%] top-[19%]",
    delay: 1.6,
  },
  {
    icon: Zap,
    title: "Answered in 0.8s",
    detail: "Across 12,400 documents",
    className: "right-[6%] top-[58%]",
    delay: 1.85,
  },
  {
    icon: Ticket,
    title: "Ticket created",
    detail: "Assigned to Support · P2",
    className: "right-[28%] bottom-[13%]",
    delay: 2.1,
  },
]

export function Hero() {
  const section = useRef<HTMLElement>(null)
  let wordIndex = 0

  return (
    <section
      ref={section}
      className="relative isolate flex min-h-svh items-center overflow-hidden"
    >
      <HeroScene eventSource={section} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-28 pb-20">
        <div className="max-w-2xl">
          <motion.a
            href="#features"
            {...fadeUp(0.15)}
            className="group mb-8 inline-flex items-center gap-2 rounded-full border bg-background/40 py-1 pr-3 pl-1 text-xs backdrop-blur-md transition-colors hover:border-foreground/20"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-[linear-gradient(110deg,var(--brand-violet),var(--brand-cyan))] px-2 py-0.5 font-medium text-white">
              <Sparkles className="size-3" />
              New
            </span>
            <span className="text-shimmer font-medium">New: AI-native CRM, help desk and MCP server</span>
            <ArrowRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </motion.a>

          <h1 className="text-[clamp(2.75rem,7vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
            {headline.map((line, li) => (
              <span key={li} className="block">
                {line.map((w) => {
                  const i = wordIndex++
                  return (
                    <span key={w.text} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
                      <motion.span
                        custom={i}
                        variants={word}
                        initial="hidden"
                        animate="show"
                        className={
                          w.accent
                            ? "text-gradient inline-block pr-[0.08em] font-serif font-normal italic tracking-[-0.02em]"
                            : "inline-block"
                        }
                      >
                        {w.text}
                      </motion.span>
                      &nbsp;
                    </span>
                  )
                })}
              </span>
            ))}
          </h1>

          <motion.p
            {...fadeUp(0.95)}
            className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Lumora answers every question from your docs with sources you can trust, runs your
            support inbox and sales pipeline, and gets the follow-up work done for your whole team.
          </motion.p>

          <motion.div {...fadeUp(1.1)} className="mt-10 flex flex-wrap items-center gap-3">
            <GlowButton href="/signup" size="lg">
              Start for free
              <ArrowRight className="size-4 transition-transform group-hover/glow:translate-x-0.5" />
            </GlowButton>
            <a
              href="#demo"
              className="group inline-flex h-12 items-center gap-3 rounded-full border bg-background/40 pr-5 pl-2 text-base backdrop-blur-md transition-colors hover:border-foreground/25"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-foreground/[0.07] transition-transform group-hover:scale-110">
                <Play className="size-3.5 fill-current" />
              </span>
              See it in action
            </a>
          </motion.div>

          <motion.ul
            {...fadeUp(1.25)}
            className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
          >
            {highlights.map((h) => (
              <li key={h} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[linear-gradient(var(--brand-violet),var(--brand-cyan))]" />
                {h}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>

      {/* Floating proof points around the sphere (desktop only). */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block">
        {floatingCards.map(({ icon: Icon, title, detail, className, delay }) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, scale: 0.9, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay }}
            className={`absolute ${className}`}
          >
            <div
              className="glass flex animate-float items-center gap-3 rounded-2xl border px-3.5 py-2.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.4)]"
              style={{ animationDelay: `${delay}s` }}
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
                <Icon className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.a
        href="#features"
        aria-label="Scroll to features"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 1 }}
        className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 md:block"
      >
        <span className="flex h-9 w-5 justify-center rounded-full border border-foreground/25 pt-1.5">
          <motion.span
            animate={{ y: [0, 10, 0], opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="h-1.5 w-1 rounded-full bg-foreground/60"
          />
        </span>
      </motion.a>
    </section>
  )
}
