import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, FileText, Quote, Ticket } from "lucide-react"
import { githubEnabled } from "@/auth"
import { Logo, LogoMark } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { LoginForm } from "./login-form"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Home
            </Link>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <LoginForm githubEnabled={githubEnabled} />
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--brand-violet)_35%,transparent),transparent_60%),radial-gradient(ellipse_at_bottom_right,color-mix(in_oklch,var(--brand-cyan)_30%,transparent),transparent_60%)]" />
        <div className="absolute inset-0 bg-grid opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

        <div className="relative flex h-full flex-col justify-center gap-6 p-16">
          <div className="glass max-w-md animate-float rounded-3xl border p-5 shadow-2xl">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-sm text-background">
              Who approves refunds over $500?
            </div>
            <div className="mt-4 flex gap-3">
              <LogoMark className="size-6 shrink-0" />
              <p className="text-sm leading-relaxed">
                Refunds above <strong>$500</strong> need approval from the Billing team lead, and
                must be logged as a Billing ticket with priority P2 or higher{" "}
                <sup className="inline-flex size-4 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet">
                  1
                </sup>
              </p>
            </div>
            <div className="mt-3 ml-9 inline-flex items-center gap-1.5 rounded-lg border bg-background/60 px-2 py-1 text-xs text-muted-foreground">
              <FileText className="size-3" />
              billing-policy.pdf · Who approves refunds
            </div>
          </div>

          <div
            className="glass ml-16 flex max-w-xs animate-float items-center gap-3 rounded-2xl border p-3 shadow-xl"
            style={{ animationDelay: "1.5s" }}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
              <Ticket className="size-4" />
            </span>
            <div className="text-sm">
              <p className="font-medium">Ticket LUM-8K2Q created</p>
              <p className="text-xs text-muted-foreground">Billing · P2</p>
            </div>
          </div>

          <figure className="mt-10 max-w-md">
            <Quote className="size-5 text-violet" />
            <blockquote className="mt-3 text-xl leading-snug font-medium tracking-tight">
              Ask anything about your company — get an answer you can verify, and the follow-up done.
            </blockquote>
          </figure>
        </div>
      </aside>
    </div>
  )
}
