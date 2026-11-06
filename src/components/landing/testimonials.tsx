import { Quote } from "lucide-react"
import { cn } from "@/lib/utils"
import { Accent, SectionHeading } from "@/components/shared/section-heading"

// Illustrative personas for this product concept.
const testimonials = [
  {
    quote: "Our support team stopped digging through five tools. Lumora answers with the exact policy page and opens the ticket for us.",
    name: "Maya Chen",
    role: "Head of Support, Kitelane",
  },
  {
    quote: "Citations were the unlock. Legal signed off in a week because every answer is traceable to a source.",
    name: "Daniel Okafor",
    role: "COO, Polarbyte",
  },
  {
    quote: "New hires ask Lumora instead of pinging seniors. Onboarding got noticeably faster in the first month.",
    name: "Sara Lindqvist",
    role: "People Ops Lead, Ferncloud",
  },
  {
    quote: "The analytics show exactly which docs are missing. We fixed our biggest knowledge gaps in two sprints.",
    name: "Omar Haddad",
    role: "Product Ops, Moonshift",
  },
  {
    quote: "Switching models is one dropdown. When one provider rate-limits us, the fallback just keeps working.",
    name: "Priya Raman",
    role: "Engineering Manager, Arcwell",
  },
  {
    quote: "It feels like a teammate who has read every document we ever wrote — and actually remembers it.",
    name: "Lucas Moreau",
    role: "Founder, Tidewater",
  },
]

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
}

function Card({ quote, name, role }: (typeof testimonials)[number]) {
  return (
    <figure className="w-[340px] shrink-0 rounded-3xl border bg-card/60 p-6 backdrop-blur-sm sm:w-[380px]">
      <Quote className="size-5 text-violet" />
      <blockquote className="mt-4 leading-relaxed text-pretty">{quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-sm font-semibold text-white">
          {initials(name)}
        </span>
        <div className="text-sm">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground">{role}</p>
        </div>
      </figcaption>
    </figure>
  )
}

function Row({ items, reverse }: { items: typeof testimonials; reverse?: boolean }) {
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div
        className={cn(
          "flex w-max gap-4 pr-4 hover:[animation-play-state:paused]",
          reverse ? "animate-marquee-reverse" : "animate-marquee"
        )}
      >
        {[...items, ...items].map((t, i) => (
          <div key={i} aria-hidden={i >= items.length}>
            <Card {...t} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Loved by teams"
          title={
            <>
              The teammate who has <Accent>read everything</Accent>
            </>
          }
        />
      </div>
      <div className="mt-16 space-y-4">
        <Row items={testimonials.slice(0, 3)} />
        <Row items={testimonials.slice(3)} reverse />
      </div>
    </section>
  )
}
