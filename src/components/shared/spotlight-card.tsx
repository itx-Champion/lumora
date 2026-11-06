"use client"

import { useRef, type ComponentProps } from "react"
import { cn } from "@/lib/utils"

/**
 * Card with a soft brand-colored light that follows the cursor.
 * Position is written to CSS variables directly, so no React re-renders on move.
 */
export function SpotlightCard({ className, children, ...props }: ComponentProps<"div">) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        el.style.setProperty("--x", `${e.clientX - rect.left}px`)
        el.style.setProperty("--y", `${e.clientY - rect.top}px`)
      }}
      className={cn(
        "group/spot relative overflow-hidden rounded-3xl border bg-card/60 backdrop-blur-sm transition-colors duration-500 hover:border-foreground/15",
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100 [background:radial-gradient(420px_circle_at_var(--x,50%)_var(--y,50%),var(--brand-glow),transparent_65%)]" />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
