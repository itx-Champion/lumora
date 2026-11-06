export type DocumentType = "pdf" | "md" | "txt" | "csv" | "json"

export type KnowledgeDocument = {
  id: string
  title: string
  fileName: string
  type: DocumentType
  content: string
  size: number
  createdAt: number
  sample?: boolean
}

export type Chunk = {
  id: string
  docId: string
  docTitle: string
  fileName: string
  /** Nearest markdown heading above the passage, used as a human-readable location. */
  section?: string
  text: string
  index: number
}

/** A retrieved passage as sent to the model and shown as a citation. */
export type Source = {
  n: number
  chunkId: string
  docId: string
  title: string
  fileName: string
  section?: string
  text: string
  score: number
}
