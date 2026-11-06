import type { Chunk, KnowledgeDocument } from "./types"

const TARGET_CHARS = 700
const OVERLAP_CHARS = 120

/**
 * Splits a document into passages that respect paragraph boundaries.
 * Each chunk remembers the heading it sits under so citations can point to a section.
 */
export function chunkDocument(doc: KnowledgeDocument): Chunk[] {
  const blocks = doc.content
    .replace(/\r\n/g, "\n")
    .replace(/\n(?=#{1,6}\s)/g, "\n\n") // every heading begins its own block
    .split(/\n{2,}/)
  const chunks: Chunk[] = []
  let section: string | undefined
  let buffer = ""

  const flush = () => {
    const text = buffer.trim()
    if (text.length > 20) {
      chunks.push({
        id: `${doc.id}:${chunks.length}`,
        docId: doc.id,
        docTitle: doc.title,
        fileName: doc.fileName,
        section,
        text,
        index: chunks.length,
      })
    }
    // Carry a tail of the previous passage forward so answers spanning a boundary still match.
    buffer = text.length > OVERLAP_CHARS ? text.slice(-OVERLAP_CHARS).replace(/^\S*\s/, "") : ""
  }

  for (const raw of blocks) {
    let block = raw.trim()
    if (!block) continue

    // A heading starts a new section (and a new passage), even when the
    // paragraph follows on the very next line.
    const heading = block.match(/^#{1,6}\s+(.+)$/m)
    if (heading && block.startsWith(heading[0])) {
      if (buffer.trim()) flush()
      buffer = ""
      section = heading[1].trim()
      block = block.slice(heading[0].length).trim()
      if (!block) continue
    }

    if (buffer.length + block.length > TARGET_CHARS && buffer.trim()) flush()

    // Very long paragraphs (e.g. PDF text without blank lines) are split on sentences.
    if (block.length > TARGET_CHARS * 1.5) {
      for (const sentence of block.split(/(?<=[.!?])\s+/)) {
        if (buffer.length + sentence.length > TARGET_CHARS && buffer.trim()) flush()
        buffer += (buffer ? " " : "") + sentence
      }
    } else {
      buffer += (buffer ? "\n\n" : "") + block
    }
  }
  if (buffer.trim()) flush()

  return chunks
}
