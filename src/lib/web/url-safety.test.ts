import { describe, expect, it } from "vitest"
import { checkUrlShape, isPrivateAddress } from "./url-safety"

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true)
  )

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("allows public %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false)
  )
})

describe("checkUrlShape", () => {
  it("accepts ordinary public https links", () => {
    expect(checkUrlShape("https://example.com/help").ok).toBe(true)
  })

  it.each([
    ["file:///etc/passwd", "Only http and https"],
    ["ftp://example.com", "Only http and https"],
    ["http://localhost/admin", "Internal addresses"],
    ["http://localhost:3000", "standard web ports"],
    ["http://169.254.169.254/latest/meta-data", "Internal addresses"],
    ["http://[::1]/", "Internal addresses"],
    ["https://user:pass@example.com", "credentials"],
    ["https://example.com:8080", "standard web ports"],
    ["not a url", "valid URL"],
  ])("rejects %s", (url, reason) => {
    const result = checkUrlShape(url)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain(reason)
  })
})
