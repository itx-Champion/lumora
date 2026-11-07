import type { Chunk, Source } from "./types"

const STOP_WORDS = new Set(
  "a an and are as at be but by can do does for from has have how i if in into is it its me my of on or our so than that the their them then there these they this to us was we what when where which who why will with you your".split(
    " "
  )
)

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // "auto-renew" → "auto renew"
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t))
    .map(stem)
}

/**
 * Query expansion for abbreviations and common phrasings that documents spell
 * differently. Applied to questions only, so the index stays untouched.
 */
const EXPANSIONS: Record<string, string> = {
  msa: "master services agreement",
  dpa: "data processing addendum",
  nda: "non-disclosure agreement confidential",
  sla: "service level uptime",
  "2fa": "two-factor authentication",
  mfa: "two-factor authentication",
  pto: "paid time off annual leave vacation",
  vacation: "annual leave",
  holiday: "leave",
  wfh: "remote work",
  cancel: "terminate termination non-renewal notice",
  cancellation: "terminate termination non-renewal notice",
  renew: "renewal renews",
  breach: "incident",
  salary: "compensation pay",
  sick: "sick leave",
}

export function expandQuery(query: string) {
  const extra = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .map((w) => EXPANSIONS[w] ?? EXPANSIONS[w.replace(/s$/, "")])
    .filter(Boolean)
  return extra.length ? `${query} ${extra.join(" ")}` : query
}

/** Tiny suffix stripper: enough to match "refunds" with "refund" and "billed" with "bill". */
function stem(word: string) {
  if (word.length <= 4) return word
  for (const suffix of ["ations", "ation", "ings", "ing", "edly", "ies", "ed", "es", "ly", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return suffix === "ies" ? word.slice(0, -3) + "y" : word.slice(0, -suffix.length)
    }
  }
  return word
}

type IndexedChunk = { chunk: Chunk; terms: Map<string, number>; length: number }

/**
 * Okapi BM25 ranking over document passages — the same scoring family used by
 * Lucene and Elasticsearch. Runs entirely in memory, so retrieval costs nothing.
 */
export class Bm25Index {
  private readonly docs: IndexedChunk[]
  private readonly docFreq = new Map<string, number>()
  private readonly avgLength: number
  private readonly k1: number
  private readonly b: number

  constructor(chunks: Chunk[], k1 = 1.4, b = 0.72) {
    this.k1 = k1
    this.b = b
    this.docs = chunks.map((chunk) => {
      // Title and section words count toward a passage's relevance.
      const tokens = tokenize(`${chunk.docTitle} ${chunk.section ?? ""} ${chunk.text}`)
      const terms = new Map<string, number>()
      for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1)
      for (const t of terms.keys()) this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1)
      return { chunk, terms, length: tokens.length }
    })
    this.avgLength = this.docs.reduce((sum, d) => sum + d.length, 0) / Math.max(1, this.docs.length)
  }

  get size() {
    return this.docs.length
  }

  /**
   * @param minScore absolute floor; weak single-word overlaps fall below it, so
   *   off-topic questions return nothing instead of misleading context.
   * @param relativeCut drop passages scoring under this fraction of the best match.
   */
  search(query: string, limit = 6, minScore = 3.2, relativeCut = 0.25): Source[] {
    const originalTerms = new Set(tokenize(query))
    const queryTerms = [...new Set(tokenize(expandQuery(query)))]
    if (!queryTerms.length) return []
    const n = this.docs.length

    // "Minimum should match": a passage must cover a third of the question's own
    // terms (expansions count once), so one shared word like "office" isn't enough.
    const covers = (terms: Map<string, number>) => {
      let matched = 0
      let expansionHit = false
      for (const t of queryTerms) {
        if (!terms.has(t)) continue
        if (originalTerms.has(t)) matched++
        else expansionHit = true
      }
      const effective = matched + (expansionHit ? 1 : 0)
      const size = Math.max(1, originalTerms.size)
      return effective / size >= 0.34 && (size < 3 || effective >= 2)
    }

    const scored = this.docs
      .map(({ chunk, terms, length }) => {
        let score = 0
        for (const term of queryTerms) {
          const tf = terms.get(term)
          if (!tf) continue
          const df = this.docFreq.get(term) ?? 0
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5))
          // Expansion terms help recall but count half, so the user's own words lead the ranking.
          const weight = originalTerms.has(term) ? 1 : 0.5
          score += (weight * idf * (tf * (this.k1 + 1))) / (tf + this.k1 * (1 - this.b + (this.b * length) / this.avgLength))
        }
        return { chunk, score: covers(terms) ? score : 0 }
      })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
    const best = scored[0]?.score ?? 0
    const relevant = scored.filter((r) => r.score >= best * relativeCut)

    // Keep at most two passages per document so answers draw on varied sources.
    const perDoc = new Map<string, number>()
    const picked: typeof scored = []
    for (const r of relevant) {
      const count = perDoc.get(r.chunk.docId) ?? 0
      if (count >= 2) continue
      perDoc.set(r.chunk.docId, count + 1)
      picked.push(r)
      if (picked.length === limit) break
    }

    return picked.map(({ chunk, score }, i) => ({
      n: i + 1,
      chunkId: chunk.id,
      docId: chunk.docId,
      title: chunk.docTitle,
      fileName: chunk.fileName,
      section: chunk.section,
      text: chunk.text,
      score: Number(score.toFixed(3)),
    }))
  }
}
