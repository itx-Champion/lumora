import { useId } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className={cn("size-7", className)}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="4" x2="28" y2="28">
          <stop offset="0" style={{ stopColor: "var(--brand-violet)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-cyan)" }} />
        </linearGradient>
        <radialGradient id={`${id}-core`} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="white" stopOpacity="0.95" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="16" cy="16" r="9" fill={`url(#${id}-g)`} />
      <circle cx="16" cy="16" r="9" fill={`url(#${id}-core)`} opacity="0.55" />
      <ellipse
        cx="16"
        cy="16"
        rx="14.5"
        ry="5.5"
        transform="rotate(-28 16 16)"
        stroke={`url(#${id}-g)`}
        strokeWidth="1.6"
        opacity="0.9"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Lumora home"
      className={cn("group flex items-center gap-2", className)}
    >
      <LogoMark className="transition-transform duration-500 group-hover:rotate-[20deg]" />
      <span className="text-lg font-semibold tracking-tight">Lumora</span>
    </Link>
  )
}
