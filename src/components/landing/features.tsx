import {
  BarChart3,
  Check,
  Database,
  FileText,
  Globe,
  KeyRound,
  Lock,
  Mail,
  MessagesSquare,
  ShieldCheck,
  Ticket,
  Users,
  Workflow,
} from "lucide-react"
import { SpotlightCard } from "@/components/shared/spotlight-card"
import { Accent, SectionHeading } from "@/components/shared/section-heading"
import { Reveal } from "@/components/shared/reveal"
import { cn } from "@/lib/utils"

function CardCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-6 pt-0 sm:p-7 sm:pt-0">
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  )
}

function Visual({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("relative p-6 sm:p-7", className)}>{children}</div>
}

function CitationsVisual() {
  return (
    <Visual className="min-h-56">
      <div className="rounded-2xl border bg-background/70 p-4 text-sm shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Lumora</p>
        <p className="mt-2 leading-relaxed">
          Annual plans can be refunded within{" "}
          <span className="font-medium">30 days</span>
          <Cite n={1} /> and are prorated after that for Enterprise accounts
          <Cite n={2} />.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["Billing policy.pdf · p.4", "Enterprise MSA · §7.2"].map((s, i) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-muted/60 px-2 py-1 text-xs text-muted-foreground transition-colors group-hover/spot:border-violet/40"
            >
              <span className="flex size-4 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet">
                {i + 1}
              </span>
              {s}
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -right-6 bottom-4 hidden rotate-6 rounded-xl border bg-background/80 p-3 shadow-lg backdrop-blur transition-transform duration-500 group-hover/spot:rotate-3 sm:block">
        <FileText className="size-5 text-cyan" />
        <div className="mt-2 h-1.5 w-16 rounded bg-foreground/10" />
        <div className="mt-1 h-1.5 w-10 rounded bg-violet/40" />
        <div className="mt-1 h-1.5 w-14 rounded bg-foreground/10" />
      </div>
    </Visual>
  )
}

function Cite({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 inline-flex size-4 -translate-y-0.5 items-center justify-center rounded bg-violet/15 text-[10px] font-semibold text-violet">
      {n}
    </sup>
  )
}

function ActionsVisual() {
  const steps = [
    { icon: MessagesSquare, label: "Understood request", done: true },
    { icon: Ticket, label: "createTicket · P2 · Support", done: true },
    { icon: Mail, label: "draftEmail → customer", done: true },
  ]
  return (
    <Visual>
      <ol className="relative space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[15px] before:w-px before:bg-border">
        {steps.map(({ icon: Icon, label }, i) => (
          <li
            key={label}
            className="relative flex items-center gap-3 rounded-xl border bg-background/70 p-2 pr-3 text-sm transition-transform duration-500 group-hover/spot:translate-x-1"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white">
              <Icon className="size-3.5" />
            </span>
            <span className="truncate font-mono text-xs">{label}</span>
            <Check className="ml-auto size-4 shrink-0 text-emerald-500" />
          </li>
        ))}
      </ol>
    </Visual>
  )
}

function SourcesVisual() {
  const sources = [
    { icon: FileText, label: "Docs" },
    { icon: Globe, label: "Websites" },
    { icon: Database, label: "Databases" },
    { icon: Mail, label: "Email" },
    { icon: Users, label: "CRM" },
    { icon: Workflow, label: "Tickets" },
  ]
  return (
    <Visual className="flex min-h-44 items-center justify-center">
      <div className="grid grid-cols-3 gap-3">
        {sources.map(({ icon: Icon, label }, i) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl border bg-background/70 px-4 py-3 text-xs text-muted-foreground transition-all duration-500 group-hover/spot:-translate-y-1 group-hover/spot:text-foreground"
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <Icon className="size-5" />
            {label}
          </div>
        ))}
      </div>
    </Visual>
  )
}

function SecurityVisual() {
  return (
    <Visual className="flex min-h-44 items-center justify-center">
      <div className="relative flex size-28 items-center justify-center">
        <div className="absolute inset-0 animate-[spin_14s_linear_infinite] rounded-full border border-dashed border-violet/40" />
        <div className="absolute inset-3 animate-[spin_10s_linear_infinite_reverse] rounded-full border border-dashed border-cyan/40" />
        <div className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white shadow-[0_0_40px_-6px_var(--brand-glow)]">
          <ShieldCheck className="size-7" />
        </div>
        <Lock className="absolute -top-1 right-1 size-4 text-muted-foreground" />
        <KeyRound className="absolute bottom-0 -left-1 size-4 text-muted-foreground" />
      </div>
    </Visual>
  )
}

function AnalyticsVisual() {
  const bars = [38, 52, 44, 67, 58, 79, 72, 88, 81, 94]
  return (
    <Visual>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Questions resolved</p>
          <p className="text-2xl font-semibold tracking-tight">
            94% <span className="text-sm font-medium text-emerald-500">+12%</span>
          </p>
        </div>
        <BarChart3 className="size-5 text-muted-foreground" />
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5">
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 origin-bottom rounded-t-md bg-[linear-gradient(to_top,var(--brand-violet),var(--brand-cyan))] opacity-70 transition-transform duration-700 group-hover/spot:scale-y-110"
            style={{ height: `${h}%`, transitionDelay: `${i * 30}ms` }}
          />
        ))}
      </div>
    </Visual>
  )
}

function ModelsVisual() {
  const models = ["Gemini", "Llama 3", "Claude", "GPT", "Mistral"]
  return (
    <Visual className="flex min-h-44 flex-wrap content-center items-center justify-center gap-2">
      {models.map((m, i) => (
        <span
          key={m}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            i === 0
              ? "border-violet/40 bg-violet/10 text-foreground"
              : "bg-background/70 text-muted-foreground group-hover/spot:text-foreground"
          )}
        >
          {m}
        </span>
      ))}
    </Visual>
  )
}

const features = [
  {
    className: "md:col-span-4",
    visual: <CitationsVisual />,
    title: "Answers with receipts",
    body: "Every answer links back to the exact page, paragraph and document it came from — so your team can trust it and verify it in one click.",
  },
  {
    className: "md:col-span-2",
    visual: <ActionsVisual />,
    title: "Agents that take action",
    body: "Lumora doesn't stop at answers. It opens tickets, drafts replies and schedules follow-ups through tool calls.",
  },
  {
    className: "md:col-span-2",
    visual: <SourcesVisual />,
    title: "Connect every source",
    body: "PDFs, docs, wikis, help centers and databases — indexed and kept in sync.",
  },
  {
    className: "md:col-span-2",
    visual: <SecurityVisual />,
    title: "Private by design",
    body: "Workspace isolation, role-based access and rate limiting. Your data never trains a model.",
  },
  {
    className: "md:col-span-2",
    visual: <ModelsVisual />,
    title: "Bring any model",
    body: "Swap between providers with one setting. Automatic fallback keeps answers flowing.",
  },
  {
    className: "md:col-span-6",
    wide: true,
    visual: <AnalyticsVisual />,
    title: "Know what your team needs",
    body: "See what people ask, which answers land and where your docs have gaps — then fix them before the next ticket arrives.",
  },
]

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Features"
          title={
            <>
              One assistant that <Accent>knows</Accent> and <Accent>does</Accent>
            </>
          }
          description="Lumora combines retrieval-augmented answers with agentic actions, so questions turn into finished work."
        />

        <div className="mt-16 grid gap-4 md:grid-cols-6">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.className}>
              <SpotlightCard className="h-full">
                <div className={cn("flex h-full flex-col", "wide" in f && "md:grid md:grid-cols-2 md:items-center")}>
                  {f.visual}
                  <CardCopy title={f.title} body={f.body} />
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
