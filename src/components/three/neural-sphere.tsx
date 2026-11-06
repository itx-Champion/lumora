"use client"

import { useEffect, useMemo, type RefObject } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import type { Theme } from "@/lib/theme"
import { SphereRig } from "./sphere-rig"

/** Converts any CSS color (including oklch) to an rgb() string three.js can parse. */
function readCssColor(variable: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx || !value) return "#0b0a12"
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `rgb(${r}, ${g}, ${b})`
}

type SceneProps = {
  theme: Theme
  reducedMotion: boolean
  pointerInside: RefObject<boolean>
}

function Scene({ theme, reducedMotion, pointerInside }: SceneProps) {
  const gl = useThree((s) => s.gl)
  const viewport = useThree((s) => s.viewport)

  const rig = useMemo(() => {
    const small = window.innerWidth < 768 || (navigator.hardwareConcurrency ?? 8) <= 4
    return new SphereRig({
      sphereCount: small ? 6000 : 16000,
      ringCount: small ? 700 : 1800,
      pixelRatio: gl.getPixelRatio(),
    })
  }, [gl])

  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => rig.setTheme(theme), [rig, theme])
  useEffect(() => rig.setReducedMotion(reducedMotion), [rig, reducedMotion])

  useFrame((state, delta) =>
    rig.update({
      delta,
      pointer: state.pointer,
      camera: state.camera,
      pointerInside: pointerInside.current,
      viewportWidth: viewport.width,
      scrollProgress: Math.min(1, window.scrollY / window.innerHeight),
    })
  )

  return <primitive object={rig.root} />
}

export type NeuralSphereProps = SceneProps & {
  active: boolean
  eventSource: RefObject<HTMLElement | null>
  onReady?: () => void
}

export function NeuralSphere({
  theme,
  reducedMotion,
  active,
  eventSource,
  pointerInside,
  onReady,
}: NeuralSphereProps) {
  // Re-read after the theme class changes so the canvas matches the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const background = useMemo(() => readCssColor("--background"), [theme])

  return (
    <Canvas
      eventSource={eventSource as RefObject<HTMLElement>}
      eventPrefix="client"
      dpr={[1, 1.75]}
      flat
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0, 6], fov: 45 }}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
    >
      <color attach="background" args={[background]} />
      <Scene theme={theme} reducedMotion={reducedMotion} pointerInside={pointerInside} />
      {theme === "dark" && (
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            intensity={1.05}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.55}
            radius={0.72}
          />
        </EffectComposer>
      )}
    </Canvas>
  )
}
