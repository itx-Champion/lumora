"use client"

import { useCallback, useSyncExternalStore } from "react"

import { THEME_STORAGE_KEY } from "./theme-script"

export type Theme = "dark" | "light"

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })
  return () => observer.disconnect()
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(subscribe, readTheme, () => "dark")

  const setTheme = useCallback((next: Theme) => {
    const root = document.documentElement
    // Suppress transitions while colors swap so the change feels instant.
    root.classList.add("theme-switching")
    root.classList.toggle("dark", next === "dark")
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {}
    requestAnimationFrame(() => root.classList.remove("theme-switching"))
  }, [])

  const toggleTheme = useCallback(
    () => setTheme(readTheme() === "dark" ? "light" : "dark"),
    [setTheme]
  )

  return { theme, setTheme, toggleTheme }
}
