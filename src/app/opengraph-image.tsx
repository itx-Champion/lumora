import { ImageResponse } from "next/og"

export const alt = "Lumora — Your company's knowledge, answered by AI"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  const dots = Array.from({ length: 140 }, (_, i) => {
    const golden = Math.PI * (3 - Math.sqrt(5))
    const y = 1 - (i / 139) * 2
    const r = Math.sqrt(1 - y * y)
    const x = Math.cos(golden * i) * r
    return { left: 900 + x * 190, top: 315 + y * 190, size: 4 + (1 + Math.sin(golden * i)) * 2 }
  })

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(circle at 75% 50%, #2a1b4d 0%, #0b0a12 55%)",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {dots.map((d, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: d.left,
              top: d.top,
              width: d.size,
              height: d.size,
              borderRadius: 999,
              background: i % 3 === 0 ? "#22d3ee" : "#a78bfa",
              opacity: 0.85,
            }}
          />
        ))}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, width: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 600 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                background: "linear-gradient(135deg, #8b5cf6, #22d3ee)",
              }}
            />
            Lumora
          </div>
          <div style={{ marginTop: 40, fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            Your company&apos;s knowledge, answered by AI.
          </div>
          <div style={{ marginTop: 28, fontSize: 28, color: "#b6b3c7" }}>
            Cited answers · Agent actions · RAG over your docs
          </div>
        </div>
      </div>
    ),
    size
  )
}
