import Link from "next/link"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

type GlowButtonProps = ComponentProps<typeof Link> & {
  size?: "sm" | "lg"
}

/** Primary call-to-action: brand gradient fill with a soft outer glow. */
export function GlowButton({
  className,
  size = "sm",
  children,
  ...props
}: GlowButtonProps) {
  return (
    <Link
      className={cn(
        "group/glow relative inline-flex items-center justify-center gap-2 rounded-full font-medium text-white",
        "bg-[linear-gradient(110deg,var(--brand-violet),color-mix(in_oklch,var(--brand-violet),var(--brand-cyan)_55%))]",
        "shadow-[0_0_0_1px_color-mix(in_oklch,white_18%,transparent)_inset,0_8px_30px_-6px_var(--brand-glow)]",
        "transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_color-mix(in_oklch,white_25%,transparent)_inset,0_12px_40px_-4px_var(--brand-glow)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        size === "sm" ? "h-9 px-4 text-sm" : "h-12 px-6 text-base",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
        <span className="absolute inset-y-0 -left-full w-1/2 skew-x-[-20deg] bg-white/25 blur-md transition-[left] duration-700 group-hover/glow:left-[150%]" />
      </span>
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </Link>
  )
}
