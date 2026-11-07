"use client"

import { useCallback, useSyncExternalStore } from "react"

export type ModelPreference = "auto" | "gemini" | "groq"

const KEY = "lumora-model"
const listeners = new Set<() => void>()

function read(): ModelPreference {
  try {
    const v = localStorage.getItem(KEY)
    return v === "gemini" || v === "groq" ? v : "auto"
  } catch {
    return "auto"
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** Which provider the assistant should try first. Persisted per browser. */
export function useModelPreference() {
  const preference = useSyncExternalStore(subscribe, read, () => "auto" as const)
  const setPreference = useCallback((next: ModelPreference) => {
    try {
      localStorage.setItem(KEY, next)
    } catch {}
    listeners.forEach((l) => l())
  }, [])
  return { preference, setPreference }
}
