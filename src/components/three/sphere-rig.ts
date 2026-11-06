import * as THREE from "three"
import type { Theme } from "@/lib/theme"
import {
  auraFragment,
  auraVertex,
  pointFragment,
  ringVertex,
  sphereVertex,
} from "./shaders"

const RADIUS = 1.55

type Palette = {
  a: string
  b: string
  c: string
  blending: THREE.Blending
  opacity: number
  auraOpacity: number
}

const palettes: Record<Theme, Palette> = {
  dark: {
    a: "#8b5cf6",
    b: "#22d3ee",
    c: "#f5d0fe",
    blending: THREE.AdditiveBlending,
    opacity: 0.9,
    auraOpacity: 0.32,
  },
  light: {
    a: "#6d28d9",
    b: "#0e7490",
    c: "#db2777",
    blending: THREE.NormalBlending,
    opacity: 0.9,
    auraOpacity: 0.16,
  },
}

/** Deterministic PRNG so the sphere looks the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randomOnSphere(rand: () => number, radius: number, out: number[]) {
  const u = rand() * 2 - 1
  const theta = rand() * Math.PI * 2
  const r = Math.sqrt(1 - u * u)
  out.push(Math.cos(theta) * r * radius, u * radius, Math.sin(theta) * r * radius)
}

function toGeometry(positions: number[], scatter: number[], seeds: Float32Array) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("aScatter", new THREE.Float32BufferAttribute(scatter, 3))
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1))
  return geometry
}

function buildSphere(count: number) {
  const rand = mulberry32(7)
  const positions: number[] = []
  const scatter: number[] = []
  const seeds = new Float32Array(count)
  const golden = Math.PI * (3 - Math.sqrt(5))

  for (let i = 0; i < count; i++) {
    // Fibonacci lattice gives an even, organic distribution.
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const theta = golden * i
    const jitter = RADIUS * (1 + (rand() - 0.5) * 0.05)
    positions.push(Math.cos(theta) * r * jitter, y * jitter, Math.sin(theta) * r * jitter)
    randomOnSphere(rand, 3 + rand() * 7, scatter)
    seeds[i] = rand()
  }

  return toGeometry(positions, scatter, seeds)
}

function buildRing(count: number) {
  const rand = mulberry32(42)
  const positions: number[] = []
  const scatter: number[] = []
  const seeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2
    const radius = 2.1 + Math.pow(rand(), 1.8) * 1.3
    const height = (rand() - 0.5) * (rand() - 0.5) * 0.5
    positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
    randomOnSphere(rand, 4 + rand() * 6, scatter)
    seeds[i] = rand()
  }

  return toGeometry(positions, scatter, seeds)
}

export type RigFrame = {
  delta: number
  pointer: THREE.Vector2
  camera: THREE.Camera
  pointerInside: boolean
  viewportWidth: number
  scrollProgress: number
}

/**
 * Owns every three.js object in the hero scene. Kept outside React so the
 * per-frame mutation that WebGL needs doesn't fight React's render model.
 */
export class SphereRig {
  readonly root = new THREE.Group()
  private readonly spin = new THREE.Group()

  private readonly time = { value: 0 }
  private readonly intro = { value: 0 }
  private readonly opacity = { value: 1 }
  private readonly colorA = { value: new THREE.Color() }
  private readonly colorB = { value: new THREE.Color() }

  private readonly sphereMaterial: THREE.ShaderMaterial
  private readonly ringMaterial: THREE.ShaderMaterial
  private readonly auraMaterial: THREE.ShaderMaterial
  private readonly geometries: THREE.BufferGeometry[]

  private readonly raycaster = new THREE.Raycaster()
  private readonly hitSphere = new THREE.Sphere(new THREE.Vector3(), RADIUS)
  private readonly hit = new THREE.Vector3()

  private theme: Theme = "dark"
  private reducedMotion = false

  constructor(options: { sphereCount: number; ringCount: number; pixelRatio: number }) {
    const pixelRatio = { value: options.pixelRatio }
    const pointMaterial = {
      transparent: true,
      depthWrite: false,
      fragmentShader: pointFragment,
    }

    this.sphereMaterial = new THREE.ShaderMaterial({
      ...pointMaterial,
      vertexShader: sphereVertex,
      uniforms: {
        uTime: this.time,
        uIntro: this.intro,
        uRadius: { value: RADIUS },
        uMouse: { value: new THREE.Vector3(0, 0, 10) },
        uMouseStrength: { value: 0 },
        uPixelRatio: pixelRatio,
        uSize: { value: 26 },
        uColorA: this.colorA,
        uColorB: this.colorB,
        uColorC: { value: new THREE.Color() },
        uOpacity: this.opacity,
      },
    })

    this.ringMaterial = new THREE.ShaderMaterial({
      ...pointMaterial,
      vertexShader: ringVertex,
      uniforms: {
        uTime: this.time,
        uIntro: this.intro,
        uPixelRatio: pixelRatio,
        uSize: { value: 22 },
        uColorA: this.colorA,
        uColorB: this.colorB,
        uOpacity: this.opacity,
      },
    })

    this.auraMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: auraVertex,
      fragmentShader: auraFragment,
      uniforms: {
        uTime: this.time,
        uColorA: this.colorA,
        uColorB: this.colorB,
        uOpacity: { value: 0 },
      },
    })

    const sphereGeometry = buildSphere(options.sphereCount)
    const ringGeometry = buildRing(options.ringCount)
    const auraGeometry = new THREE.PlaneGeometry(8, 8)
    this.geometries = [sphereGeometry, ringGeometry, auraGeometry]

    const aura = new THREE.Mesh(auraGeometry, this.auraMaterial)
    aura.position.z = -0.6
    aura.renderOrder = -1

    this.spin.add(new THREE.Points(sphereGeometry, this.sphereMaterial))

    const ring = new THREE.Group()
    ring.rotation.set(0.38, 0, -0.22)
    ring.add(new THREE.Points(ringGeometry, this.ringMaterial))

    this.root.add(aura, this.spin, ring)
    this.setTheme("dark")
  }

  setTheme(theme: Theme) {
    this.theme = theme
    const p = palettes[theme]
    this.colorA.value.set(p.a)
    this.colorB.value.set(p.b)
    this.sphereMaterial.uniforms.uColorC.value.set(p.c)
    this.auraMaterial.uniforms.uOpacity.value = p.auraOpacity
    for (const m of [this.sphereMaterial, this.ringMaterial, this.auraMaterial]) {
      m.blending = p.blending
      m.needsUpdate = true
    }
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced
    if (reduced) this.intro.value = 1
  }

  update({ delta, pointer, camera, pointerInside, viewportWidth, scrollProgress }: RigFrame) {
    const dt = Math.min(delta, 0.05)
    const root = this.root

    this.time.value += this.reducedMotion ? dt * 0.25 : dt
    // Uses the uncapped delta so the intro finishes on time even on slow devices.
    if (this.intro.value < 1) this.intro.value = Math.min(1, this.intro.value + delta / 2.4)

    // Sphere sits to the right on wide screens, centered behind the text on mobile.
    const wide = viewportWidth > 7
    root.position.x = THREE.MathUtils.damp(root.position.x, wide ? viewportWidth * 0.2 : 0, 4, dt)
    root.position.y = (wide ? 0 : 1.15) + scrollProgress * 1.4
    root.scale.setScalar((wide ? 1 : 0.62) * (1 - scrollProgress * 0.2))
    this.opacity.value = palettes[this.theme].opacity * (wide ? 1 : 0.38) * (1 - scrollProgress * 0.75)

    // Spin slowly and lean toward the cursor.
    this.spin.rotation.y += dt * (this.reducedMotion ? 0.02 : 0.07)
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, -pointer.y * 0.25, 3, dt)
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, -pointer.x * 0.12, 3, dt)

    // Project the cursor onto the sphere to drive the swell effect.
    const uniforms = this.sphereMaterial.uniforms
    let strength = 0
    if (pointerInside) {
      this.raycaster.setFromCamera(pointer, camera)
      this.spin.getWorldPosition(this.hitSphere.center)
      this.hitSphere.radius = RADIUS * 1.15 * root.scale.x
      if (this.raycaster.ray.intersectSphere(this.hitSphere, this.hit)) {
        this.spin.worldToLocal(this.hit)
        uniforms.uMouse.value.lerp(this.hit, 1 - Math.exp(-12 * dt))
        strength = 1
      }
    }
    uniforms.uMouseStrength.value = THREE.MathUtils.damp(uniforms.uMouseStrength.value, strength, 5, dt)
  }

  dispose() {
    this.geometries.forEach((g) => g.dispose())
    this.sphereMaterial.dispose()
    this.ringMaterial.dispose()
    this.auraMaterial.dispose()
  }
}
