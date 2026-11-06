// Ashima Arts 3D simplex noise (MIT) — https://github.com/ashima/webgl-noise
const simplexNoise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

/** Eased, per-particle staggered progress of the intro morph (scatter -> sphere). */
const introProgress = /* glsl */ `
float introProgress(float intro, float seed) {
  float t = clamp(intro * 1.6 - seed * 0.6, 0.0, 1.0);
  return 1.0 - pow(1.0 - t, 3.0);
}
`

export const sphereVertex = /* glsl */ `
uniform float uTime;
uniform float uIntro;
uniform float uRadius;
uniform vec3 uMouse;
uniform float uMouseStrength;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

attribute vec3 aScatter;
attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;

${simplexNoise}
${introProgress}

void main() {
  vec3 dir = normalize(position);

  // Two octaves of flowing noise make the surface "breathe".
  float n1 = snoise(dir * 1.35 + vec3(0.0, uTime * 0.16, uTime * 0.08));
  float n2 = snoise(dir * 3.4 - vec3(uTime * 0.22));
  vec3 p = dir * (uRadius + n1 * 0.2 + n2 * 0.05);

  // Particles near the cursor swell outward.
  float influence = smoothstep(0.95, 0.0, distance(p, uMouse)) * uMouseStrength;
  p += dir * influence * 0.42;

  float t = introProgress(uIntro, aSeed);
  p = mix(aScatter, p, t);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float size = uSize * (0.55 + aSeed * 0.9) * (1.0 + influence * 1.4);
  gl_PointSize = size * uPixelRatio / -mvPosition.z;

  float mixer = smoothstep(-1.0, 1.0, n1 * 1.2 + dir.y * 0.7);
  vec3 color = mix(uColorA, uColorB, mixer);
  vColor = mix(color, uColorC, influence * 0.85);

  // Fade the far side of the sphere for depth.
  vec3 viewNormal = normalize(normalMatrix * dir);
  float facing = dot(viewNormal, normalize(-mvPosition.xyz));
  vAlpha = mix(0.18, 1.0, smoothstep(-0.7, 0.85, facing)) * t;
}
`

export const ringVertex = /* glsl */ `
uniform float uTime;
uniform float uIntro;
uniform float uPixelRatio;
uniform float uSize;
uniform vec3 uColorA;
uniform vec3 uColorB;

attribute vec3 aScatter;
attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;

${introProgress}

void main() {
  // Each particle orbits at its own speed around the Y axis.
  float angle = uTime * (0.05 + aSeed * 0.12);
  float c = cos(angle);
  float s = sin(angle);
  vec3 p = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);

  float t = introProgress(uIntro, aSeed);
  p = mix(aScatter, p, t);

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uSize * (0.4 + aSeed) * uPixelRatio / -mvPosition.z;

  vColor = mix(uColorA, uColorB, aSeed);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 40.0);
  vAlpha = twinkle * t;
}
`

export const pointFragment = /* glsl */ `
uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float alpha = pow(smoothstep(0.5, 0.0, d), 1.6);
  gl_FragColor = vec4(vColor, alpha * vAlpha * uOpacity);
  #include <colorspace_fragment>
}
`

export const auraVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const auraFragment = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uOpacity;
uniform float uTime;

varying vec2 vUv;

void main() {
  vec2 c = vUv - 0.5;
  float d = length(c);
  float glow = pow(smoothstep(0.5, 0.0, d), 2.2);
  // Slow drift between brand colors, purely radial so there are no seams.
  float drift = 0.5 + 0.5 * sin(uTime * 0.25 + d * 6.0);
  vec3 color = mix(uColorB, uColorA, smoothstep(0.0, 0.45, d) * 0.7 + drift * 0.3);
  gl_FragColor = vec4(color, glow * uOpacity);
  #include <colorspace_fragment>
}
`
