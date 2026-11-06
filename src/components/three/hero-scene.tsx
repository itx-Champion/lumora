"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"
import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { useTheme } from "@/lib/theme"
import { usePrefersReducedMotion } from "@/hooks/use-media-query"

// three.js only runs in the browser and is heavy, so load it after the page is interactive.
const NeuralSphere = dynamic(
  () => import("./neural-sphere").then((m) => m.NeuralSphere),
  { ssr: false }
)

let webglSupport: boolean | undefined

function supportsWebGL() {
  if (webglSupport === undefined) {
    try {
      const canvas = document.createElement("canvas")
      webglSupport = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
    } catch {
      webglSupport = false
    }
  }
  return webglSupport
}

const noopSubscribe = () => () => {}

/** CSS-only orb shown while three.js loads, and permanently if WebGL is unavailable. */
function FallbackOrb() {
  return (
    <div className="absolute inset-0 flex items-center justify-center md:justify-end md:pr-[12%]">
      <div className="relative size-[min(70vw,460px)]">
        <div className="absolute inset-0 animate-pulse rounded-full bg-[radial-gradient(circle_at_35%_35%,var(--brand-cyan),var(--brand-violet)_45%,transparent_70%)] opacity-40 blur-2xl" />
        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_35%_35%,color-mix(in_oklch,var(--brand-cyan),white_30%),var(--brand-violet)_60%,transparent_75%)] opacity-60 blur-md" />
      </div>
    </div>
  )
}

export function HeroScene({ eventSource }: { eventSource: RefObject<HTMLElement | null> }) {
  const { theme } = useTheme()
  const reducedMotion = usePrefersReducedMotion()
  const container = useRef<HTMLDivElement>(null)
  const pointerInside = useRef(false)
  const webgl = useSyncExternalStore<boolean | null>(noopSubscribe, supportsWebGL, () => null)
  const [visible, setVisible] = useState(true)
  const [ready, setReady] = useState(false)

  // Pause rendering when the hero is scrolled out of view.
  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = eventSource.current
    if (!el) return
    const enter = () => (pointerInside.current = true)
    const leave = () => (pointerInside.current = false)
    el.addEventListener("pointerenter", enter)
    el.addEventListener("pointerleave", leave)
    return () => {
      el.removeEventListener("pointerenter", enter)
      el.removeEventListener("pointerleave", leave)
    }
  }, [eventSource])

  return (
    <div
      ref={container}
      aria-hidden
      // Fade the canvas out at the bottom so it melts into the next section.
      className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
    >
      {(!ready || webgl === false) && <FallbackOrb />}
      {webgl && (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            ready ? "opacity-100" : "opacity-0"
          )}
        >
          <NeuralSphere
            theme={theme}
            reducedMotion={reducedMotion}
            active={visible}
            eventSource={eventSource}
            pointerInside={pointerInside}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  )
}
