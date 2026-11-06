import { Boxes, Hexagon, Layers, Orbit, Triangle, Waves, Wind, Zap } from "lucide-react"

// Fictional companies — Lumora is a portfolio concept, so no real brands are implied.
const companies = [
  { name: "Kitelane", icon: Wind },
  { name: "Polarbyte", icon: Hexagon },
  { name: "Ferncloud", icon: Layers },
  { name: "Moonshift", icon: Orbit },
  { name: "Arcwell", icon: Triangle },
  { name: "Tidewater", icon: Waves },
  { name: "Voltline", icon: Zap },
  { name: "Cubist", icon: Boxes },
]

export function LogoCloud() {
  return (
    <section aria-label="Teams using Lumora" className="relative py-14">
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Built for fast-moving support, sales and ops teams
      </p>
      <div className="relative mx-auto max-w-6xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
        <div className="flex w-max animate-marquee gap-14 pr-14 hover:[animation-play-state:paused]">
          {[...companies, ...companies].map(({ name, icon: Icon }, i) => (
            <div
              key={i}
              aria-hidden={i >= companies.length}
              className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground/45 transition-colors hover:text-foreground"
            >
              <Icon className="size-5" />
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
