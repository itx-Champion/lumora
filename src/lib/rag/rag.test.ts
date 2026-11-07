import { describe, expect, it } from "vitest"
import { templateList } from "@/lib/demo/templates"
import { createTemplateDocuments } from "@/lib/workspace/seed"
import { Bm25Index, tokenize } from "./bm25"
import { chunkDocument } from "./chunk"
import type { KnowledgeDocument } from "./types"

const doc = (content: string, title = "Policy"): KnowledgeDocument => ({
  id: "d1",
  title,
  fileName: "policy.md",
  type: "md",
  content,
  size: content.length,
  createdAt: 0,
})

const supportIndex = new Bm25Index(createTemplateDocuments("support").flatMap(chunkDocument))

describe("chunkDocument", () => {
  it("starts a new passage at every heading and records the section", () => {
    const chunks = chunkDocument(
      doc("# Policy\n\n## Refunds\nRefunds are processed within 5 business days.\n## Invoices\nInvoices are emailed monthly to the billing contact.")
    )
    expect(chunks.map((c) => c.section)).toEqual(["Refunds", "Invoices"])
    expect(chunks[0].text).toContain("5 business days")
    expect(chunks[0].text).not.toContain("Invoices")
  })

  it("splits long paragraphs on sentence boundaries", () => {
    const sentence = "This sentence describes one part of a long policy in detail. "
    const chunks = chunkDocument(doc(`## Long\n${sentence.repeat(40)}`))
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) expect(c.text.length).toBeLessThan(1000)
  })

  it("ignores empty documents", () => {
    expect(chunkDocument(doc("   \n\n  "))).toEqual([])
  })
})

describe("tokenize", () => {
  it("lowercases, drops stop words and stems plurals", () => {
    expect(tokenize("The Refunds are processed")).toEqual(["refund", "process"])
  })
})

describe("Bm25Index", () => {
  it("ranks the passage that answers the question first", () => {
    const [top] = supportIndex.search("Can a customer get a refund on an annual plan after 3 weeks?")
    expect(top.title).toBe("Billing & refund policy")
    expect(top.section).toBe("Refunds for annual plans")
  })

  it("numbers results from 1 for citation", () => {
    const results = supportIndex.search("Where is customer data stored?")
    expect(results.map((r) => r.n)).toEqual(results.map((_, i) => i + 1))
  })

  it("returns nothing for off-topic questions instead of weak matches", () => {
    expect(supportIndex.search("what is the weather today")).toEqual([])
    expect(supportIndex.search("office address in Berlin")).toEqual([])
  })

  it("keeps at most two passages per document", () => {
    const results = supportIndex.search("refund annual plan billing payment invoice", 6)
    const perDoc = new Map<string, number>()
    for (const r of results) perDoc.set(r.docId, (perDoc.get(r.docId) ?? 0) + 1)
    for (const count of perDoc.values()) expect(count).toBeLessThanOrEqual(2)
  })
})

describe("workspace templates", () => {
  for (const template of templateList.filter((t) => t.docs.length)) {
    it(`${template.name}: every knowledge question retrieves a source`, () => {
      const index = new Bm25Index(createTemplateDocuments(template.id).flatMap(chunkDocument))
      const questions = template.suggested.filter((q) => !/^(open|draft|schedule)\b/i.test(q))
      for (const q of questions) expect(index.search(q).length, q).toBeGreaterThan(0)
    })
  }
})

describe("query expansion", () => {
  it("matches abbreviations to the spelled-out terms in documents", () => {
    const legal = new Bm25Index(createTemplateDocuments("legal").flatMap(chunkDocument))
    expect(legal.search("When does the MSA auto-renew?")[0]?.title).toBe("Master services agreement")
  })

  it("keeps the user's own words ranked above expansion terms", () => {
    expect(supportIndex.search("How many vacation days do employees get?")[0]?.section).toBe("Paid time off")
  })
})
