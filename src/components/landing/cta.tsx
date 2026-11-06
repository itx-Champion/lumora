import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { GlowButton } from "@/components/shared/glow-button"
import { Reveal } from "@/components/shared/reveal"
import { Accent } from "@/components/shared/section-heading"

export function Cta() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[2.5rem] border px-6 py-20 text-center sm:px-16">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--brand-violet)_30%,transparent),transparent_60%),radial-gradient(ellipse_at_bottom,color-mix(in_oklch,var(--brand-cyan)_22%,transparent),transparent_60%)]" />
            <div className="absolute inset-0 -z-10 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <h2 className="mx-auto max-w-3xl text-[clamp(2.25rem,5vw,3.75rem)] leading-[1.02] font-semibold tracking-[-0.04em] text-balance">
              Give your team answers they can <Accent>trust</Accent>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Spin up a workspace in minutes. No credit card, no setup call.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <GlowButton href="/signup" size="lg">
                Start for free
                <ArrowRight className="size-4 transition-transform group-hover/glow:translate-x-0.5" />
              </GlowButton>
              <Link
                href="/login"
                className="inline-flex h-12 items-center rounded-full border bg-background/50 px-6 font-medium backdrop-blur transition-colors hover:bg-foreground/5"
              >
                Open live demo
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
