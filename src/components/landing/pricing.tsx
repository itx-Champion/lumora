"use client"

import { useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "motion/react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Accent, SectionHeading } from "@/components/shared/section-heading"
import { GlowButton } from "@/components/shared/glow-button"
import { Reveal } from "@/components/shared/reveal"

type Billing = "monthly" | "yearly"

const plans = [
  {
    name: "Starter",
    description: "For individuals exploring an AI knowledge base.",
    price: { monthly: 0, yearly: 0 },
    unit: "forever",
    cta: "Start for free",
    features: ["1 workspace", "50 documents", "200 questions / month", "Cited answers", "Community support"],
  },
  {
    name: "Pro",
    description: "For teams that want answers and automated follow-ups.",
    price: { monthly: 29, yearly: 23 },
    unit: "per seat / month",
    cta: "Start 14-day trial",
    featured: true,
    features: [
      "Unlimited workspaces",
      "5,000 documents",
      "Unlimited questions",
      "Agent actions (tickets, email, meetings)",
      "Analytics dashboard",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    description: "For organizations with security and scale requirements.",
    price: { monthly: null, yearly: null },
    unit: "tailored to your team",
    cta: "Talk to sales",
    features: ["SSO & SCIM", "Custom data retention", "Dedicated model deployments", "Audit logs", "99.9% uptime SLA"],
  },
] as const

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("yearly")

  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              Simple pricing that <Accent>scales</Accent> with you
            </>
          }
          description="Start free. Upgrade when your team is ready for agents."
        />

        <Reveal className="mt-10 flex justify-center">
          <div role="radiogroup" aria-label="Billing period" className="relative flex rounded-full border bg-card/60 p-1 text-sm">
            {(["monthly", "yearly"] as const).map((b) => (
              <button
                key={b}
                role="radio"
                aria-checked={billing === b}
                onClick={() => setBilling(b)}
                className={cn(
                  "relative z-10 rounded-full px-5 py-2 capitalize transition-colors",
                  billing === b ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {billing === b && (
                  <motion.span
                    layoutId="billing-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-foreground"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                {b}
                {b === "yearly" && (
                  <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">
                    −20%
                  </span>
                )}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const featured = "featured" in plan && plan.featured
            const price = plan.price[billing]
            return (
              <Reveal key={plan.name} delay={i * 0.08} className="h-full">
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-3xl border p-8",
                    featured
                      ? "border-transparent bg-card shadow-[0_30px_80px_-30px_var(--brand-glow)] [background:linear-gradient(var(--card),var(--card))_padding-box,linear-gradient(140deg,var(--brand-violet),var(--brand-cyan))_border-box] [border-width:1.5px]"
                      : "bg-card/50"
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-8 rounded-full bg-[linear-gradient(110deg,var(--brand-violet),var(--brand-cyan))] px-3 py-1 text-xs font-medium text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

                  <div className="mt-6 flex h-14 items-end gap-2">
                    {price === null ? (
                      <span className="text-4xl font-semibold tracking-tight">Custom</span>
                    ) : (
                      <span className="flex overflow-hidden text-5xl font-semibold tracking-tight">
                        $
                        <AnimatePresence mode="popLayout" initial={false}>
                          <motion.span
                            key={price}
                            initial={{ y: "100%", opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: "-100%", opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          >
                            {price}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                    )}
                    <span className="pb-1.5 text-sm text-muted-foreground">{plan.unit}</span>
                  </div>

                  <div className="mt-8">
                    {featured ? (
                      <GlowButton href="/signup" size="lg" className="w-full">
                        {plan.cta}
                      </GlowButton>
                    ) : (
                      <Link
                        href={plan.price.monthly === null ? "#faq" : "/signup"}
                        className="flex h-12 w-full items-center justify-center rounded-full border bg-background/60 font-medium transition-colors hover:bg-foreground/5"
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>

                  <ul className="mt-8 space-y-3 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-violet/15 text-violet">
                          <Check className="size-3" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
