import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Reveal } from "./reveal"

type SectionHeadingProps = {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: "center" | "left"
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-2xl items-center text-center" : "max-w-xl",
        className
      )}
    >
      <span className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
        <span className="size-1.5 rounded-full bg-[linear-gradient(var(--brand-violet),var(--brand-cyan))]" />
        {eyebrow}
      </span>
      <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
        {title}
      </h2>
      {description && (
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">{description}</p>
      )}
    </Reveal>
  )
}

/** Serif italic gradient accent used inside headings. */
export function Accent({ children }: { children: ReactNode }) {
  return (
    <span className="text-gradient pr-[0.06em] font-serif font-normal tracking-[-0.01em] italic">
      {children}
    </span>
  )
}
