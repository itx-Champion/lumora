"use client"

import { useNow } from "@/hooks/use-now"

/** Greets by the visitor's local time (the server's clock may be in another timezone). */
export function Greeting({ name }: { name: string }) {
  const now = useNow()
  const hour = now ? new Date(now).getHours() : 9
  const text = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  return (
    <span suppressHydrationWarning>
      {now ? text : "Welcome back"}, {name}.
    </span>
  )
}
