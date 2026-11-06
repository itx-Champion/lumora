import { extractText, getDocumentProxy } from "unpdf"
import { auth } from "@/auth"

export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024

/** Extracts text from an uploaded PDF so it can be chunked and indexed in the browser. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "No file was uploaded." }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "PDFs must be smaller than 4 MB." }, { status: 413 })
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "Only PDF files are parsed on the server." }, { status: 415 })
  }

  try {
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const { text, totalPages } = await extractText(pdf, { mergePages: true })
    const cleaned = text
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
    if (!cleaned) {
      return Response.json(
        { error: "This PDF has no selectable text (it may be a scanned image)." },
        { status: 422 }
      )
    }
    return Response.json({ text: cleaned, pages: totalPages })
  } catch (error) {
    console.error("[parse]", error)
    return Response.json({ error: "We couldn't read this PDF." }, { status: 422 })
  }
}
