import Link from "next/link"
import { Logo } from "@/components/shared/logo"
import { site } from "@/lib/site"

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Live demo", href: "/login" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "FAQ", href: "/#faq" },
      { label: "Source code", href: site.repo },
      { label: "Architecture", href: `${site.repo}#architecture` },
    ],
  },
  {
    title: "Author",
    links: [
      { label: site.author.name, href: site.author.github },
      { label: "GitHub", href: site.author.github },
    ],
  },
]

export function Footer() {
  return (
    <footer className="relative border-t">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {site.tagline}. A product concept designed and engineered end-to-end by {site.author.name}.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-medium">{col.title}</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="transition-colors hover:text-foreground"
                    {...(l.href.startsWith("http") && { target: "_blank", rel: "noreferrer" })}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 {site.name}. Portfolio project — company names and testimonials are illustrative.</p>
          <p>Built with Next.js, Three.js and the Vercel AI SDK.</p>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none overflow-hidden text-center text-[22vw] leading-[0.75] font-semibold tracking-[-0.06em] text-foreground/[0.04] select-none"
      >
        Lumora
      </div>
    </footer>
  )
}
