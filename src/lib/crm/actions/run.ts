import "server-only"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { PermissionError } from "../permissions"

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string }

export class UserError extends Error {}

/**
 * Wraps a server action: validates, runs, refreshes the app's server-rendered data,
 * and turns known failures into messages the UI can show in a toast.
 */
export async function run<T>(fn: () => Promise<T>, opts: { revalidate?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    if (opts.revalidate !== false) revalidatePath("/app", "layout")
    return { ok: true, data }
  } catch (error) {
    if (error instanceof PermissionError || error instanceof UserError) return { ok: false, error: error.message }
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Please check the form." }
    console.error("[action]", error)
    return { ok: false, error: "Something went wrong. Please try again." }
  }
}
