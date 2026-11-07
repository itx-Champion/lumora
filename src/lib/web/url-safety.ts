import { isIP } from "node:net"

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, incl. cloud metadata endpoints
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    )
  }
  if (version === 6) {
    const v6 = address.toLowerCase()
    if (v6 === "::" || v6 === "::1") return true
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6)
  }
  return true
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string }

/** Static checks that don't need DNS: scheme, credentials, port and obvious internal hosts. */
export function checkUrlShape(input: string): UrlCheck {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return { ok: false, reason: "That doesn't look like a valid URL." }
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http and https links are supported." }
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Links with embedded credentials aren't allowed." }
  }
  if (url.port && !["80", "443"].includes(url.port)) {
    return { ok: false, reason: "Only standard web ports are allowed." }
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "Internal addresses can't be imported." }
  }
  if (isIP(host) && isPrivateAddress(host)) {
    return { ok: false, reason: "Internal addresses can't be imported." }
  }
  return { ok: true, url }
}
