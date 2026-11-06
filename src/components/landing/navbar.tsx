"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, useMotionValueEvent, useScroll } from "motion/react"
import { ArrowRight, Menu } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { GlowButton } from "@/components/shared/glow-button"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const links = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

export function Navbar() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24))

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          "flex w-full max-w-6xl items-center justify-between rounded-full border px-3 py-2 transition-all duration-500",
          scrolled
            ? "glass border-border shadow-[0_8px_32px_-12px_rgb(0_0_0/0.35)]"
            : "border-transparent bg-transparent"
        )}
      >
        <Logo className="pl-2" />

        <ul
          className="hidden items-center md:flex"
          onMouseLeave={() => setHovered(null)}
        >
          {links.map((link) => (
            <li key={link.href} className="relative">
              <a
                href={link.href}
                onMouseEnter={() => setHovered(link.href)}
                className="relative z-10 block px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
              {hovered === link.href && (
                <motion.span
                  layoutId="nav-hover"
                  className="absolute inset-0 rounded-full bg-foreground/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </Link>
          <GlowButton href="/signup" className="hidden sm:inline-flex">
            Get started
            <ArrowRight className="size-3.5 transition-transform group-hover/glow:translate-x-0.5" />
          </GlowButton>

          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full md:hidden"
                  aria-label="Open menu"
                />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="glass w-[80%] p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
              <ul className="mt-8 flex flex-col gap-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <SheetClose
                      render={
                        <a
                          href={link.href}
                          className="block rounded-lg px-3 py-3 text-lg transition-colors hover:bg-foreground/5"
                        />
                      }
                    >
                      {link.label}
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3">
                <Link
                  href="/login"
                  className="rounded-full border py-3 text-center text-sm"
                >
                  Sign in
                </Link>
                <GlowButton href="/signup" size="lg">
                  Get started free
                </GlowButton>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </motion.header>
  )
}
