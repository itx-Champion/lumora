"use client"

import { useRef } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import { Cable, MessageSquareText, Sparkles } from "lucide-react"
import { Accent, SectionHeading } from "@/components/shared/section-heading"

gsap.registerPlugin(ScrollTrigger, useGSAP)

const steps = [
  {
    icon: Cable,
    title: "Connect your sources",
    body: "Upload PDFs and docs or point Lumora at your help center. Files are parsed, cleaned and split into meaningful passages.",
    detail: ["handbook.pdf", "pricing.md", "security-policy.docx"],
  },
  {
    icon: Sparkles,
    title: "Lumora builds a knowledge index",
    body: "Each passage is indexed for retrieval and tagged with its source, so every answer can be traced back to where it came from.",
    detail: ["1,284 passages", "ranked retrieval", "source metadata"],
  },
  {
    icon: MessageSquareText,
    title: "Ask, verify, act",
    body: "Your team asks in plain language. The agent answers with citations and can open tickets, draft emails or book meetings for you.",
    detail: ["cited answers", "tool calls", "human-in-the-loop"],
  },
]

export function HowItWorks() {
  const root = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // The progress rail fills as the steps scroll past.
        gsap.fromTo(
          ".hiw-rail-fill",
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: ".hiw-steps",
              start: "top 60%",
              end: "bottom 60%",
              scrub: 0.6,
            },
          }
        )

        gsap.utils.toArray<HTMLElement>(".hiw-step").forEach((step) => {
          gsap.fromTo(
            step,
            { opacity: 0.25, x: 24 },
            {
              opacity: 1,
              x: 0,
              ease: "power2.out",
              scrollTrigger: {
                trigger: step,
                start: "top 75%",
                end: "top 45%",
                scrub: 0.6,
              },
            }
          )
          ScrollTrigger.create({
            trigger: step,
            start: "top 60%",
            end: "bottom 60%",
            toggleClass: { targets: step, className: "is-active" },
          })
        })
      })
    },
    { scope: root }
  )

  return (
    <section id="how-it-works" ref={root} className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="How it works"
            title={
              <>
                From scattered docs to <Accent>answers</Accent> in three steps
              </>
            }
            description="No training runs, no data science team. Connect what you already have and Lumora does the rest."
          />
        </div>

        <ol className="hiw-steps relative space-y-6 pl-10">
          <span className="absolute top-2 bottom-2 left-[11px] w-0.5 rounded-full bg-border" />
          <span className="hiw-rail-fill absolute top-2 bottom-2 left-[11px] w-0.5 origin-top rounded-full bg-[linear-gradient(var(--brand-violet),var(--brand-cyan))]" />

          {steps.map(({ icon: Icon, title, body, detail }, i) => (
            <li key={title} className="hiw-step group relative">
              <span className="absolute top-7 -left-10 flex size-6 items-center justify-center rounded-full border-2 border-border bg-background text-[11px] font-semibold text-muted-foreground transition-all duration-500 group-[.is-active]:border-transparent group-[.is-active]:bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] group-[.is-active]:text-white group-[.is-active]:shadow-[0_0_24px_var(--brand-glow)]">
                {i + 1}
              </span>
              <div className="rounded-3xl border bg-card/60 p-7 backdrop-blur-sm transition-colors duration-500 group-[.is-active]:border-violet/30">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-violet/10 text-violet">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {detail.map((d) => (
                    <span
                      key={d}
                      className="rounded-full border bg-background/60 px-3 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
