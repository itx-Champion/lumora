import { Skeleton } from "@/components/ui/skeleton"

/** Streaming placeholder shown while a CRM or admin page loads its data. */
export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-7 w-80 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  )
}
