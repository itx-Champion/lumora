import "server-only"
import { lookup } from "node:dns/promises"
import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"
import { checkUrlShape, isPrivateAddress } from "./url-safety"

const MAX_BYTES = 3 * 1024 * 1024
const MAX_REDIRECTS = 3
const TIMEOUT_MS = 10_000

export class ImportError extends Error {}

async function assertPublicHost(url: URL) {
  const shape = checkUrlShape(url.toString())
  if (!shape.ok) throw new ImportError(shape.reason)
  const addresses = await lookup(url.hostname, { all: true }).catch(() => {
    throw new ImportError("We couldn't find that website.")
  })
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new ImportError("Internal addresses can't be imported.")
  }
}

/** Reads a response body up to a byte limit, so a huge page can't exhaust memory. */
async function readLimited(res: Response) {
  const reader = res.body?.getReader()
  if (!reader) return ""
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new ImportError("This page is too large to import (over 3 MB).")
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

/**
 * Fetches a public web page with SSRF protection: every hop of a redirect chain
 * is resolved and checked against private address ranges before it is requested.
 */
async function safeFetch(input: URL) {
  let url = input
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url)
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "User-Agent": "LumoraBot/1.0 (+knowledge import)", Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" },
    }).catch((e: unknown) => {
      throw new ImportError(e instanceof Error && e.name === "TimeoutError" ? "The website took too long to respond." : "We couldn't reach that website.")
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url)
      continue
    }
    if (!res.ok) throw new ImportError(`The website responded with an error (${res.status}).`)
    return { res, finalUrl: url }
  }
  throw new ImportError("Too many redirects.")
}

/** Converts the readable part of an HTML page into Markdown-like text that keeps its headings. */
function htmlToText(html: string) {
  const { document } = parseHTML(html)
  const article = new Readability(document as unknown as Document, { charThreshold: 200 }).parse()
  const title = (article?.title || document.querySelector("title")?.textContent || "").trim()
  const { document: body } = parseHTML(`<div id="root">${article?.content ?? document.body?.innerHTML ?? ""}</div>`)

  const lines: string[] = []
  body.querySelectorAll("h1, h2, h3, h4, p, li, blockquote, pre, td").forEach((el) => {
    const text = (el.textContent ?? "").replace(/\s+/g, " ").trim()
    if (!text) return
    const tag = el.tagName.toLowerCase()
    if (/^h[1-4]$/.test(tag)) lines.push(`\n## ${text}`)
    else if (tag === "li") lines.push(`- ${text}`)
    else lines.push(text)
  })
  return { title, content: lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim() }
}

export async function importPage(input: string) {
  const shape = checkUrlShape(input)
  if (!shape.ok) throw new ImportError(shape.reason)

  const { res, finalUrl } = await safeFetch(shape.url)
  const type = res.headers.get("content-type") ?? ""
  if (!/text\/(html|plain|markdown)|application\/xhtml/.test(type)) {
    throw new ImportError("Only web pages and plain-text files can be imported.")
  }

  const raw = await readLimited(res)
  const { title, content } = type.includes("html")
    ? htmlToText(raw)
    : { title: finalUrl.pathname.split("/").pop() || finalUrl.hostname, content: raw.trim() }

  if (content.length < 200) {
    throw new ImportError("We couldn't find enough readable text on that page.")
  }
  return {
    url: finalUrl.toString(),
    title: title || finalUrl.hostname,
    content: content.slice(0, 200_000),
  }
}
