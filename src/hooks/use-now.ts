"use client"

import { useSyncExternalStore } from "react"

let now = typeof window === "undefined" ? 0 : Date.now()
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 60_000)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Current time that updates once a minute — a render-safe replacement for Date.now(). */
export function useNow() {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => 0
  )
}
