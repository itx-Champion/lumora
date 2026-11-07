import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Server-rendered pager that keeps the current filters in the URL. */
export function Pagination({ page, pages, total, pageSize, params, basePath }: { page: number; pages: number; total: number; pageSize: number; params: Record<string, string | undefined>; basePath: string }) {
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])))
    if (p > 1) q.set("page", String(p))
    else q.delete("page")
    return `${basePath}${q.size ? `?${q}` : ""}`
  }
  const from = total ? (page - 1) * pageSize + 1 : 0
  const to = Math.min(total, page * pageSize)
  const btn = "flex h-8 items-center gap-1 rounded-lg border bg-background/60 px-2.5 text-sm transition-colors hover:bg-foreground/5"
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn}>
            <ChevronLeft className="size-4" /> Prev
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>
            <ChevronLeft className="size-4" /> Prev
          </span>
        )}
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} className={btn}>
            Next <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(btn, "pointer-events-none opacity-40")}>
            Next <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  )
}
