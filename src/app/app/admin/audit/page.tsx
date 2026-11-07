import type { Metadata } from "next"
import { Download, Eye, ScrollText } from "lucide-react"
import { RelativeTime, UrlSearch, UrlSelect } from "@/components/crm/client"
import { crmPage } from "@/components/crm/guards"
import { Pagination } from "@/components/crm/pagination"
import { dateTimeFmt, EmptyState, PageHeader, Pill } from "@/components/crm/ui"
import { AUDIT_PAGE_SIZE, listAudit, listMembers } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Audit log" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

const tone: Record<string, string> = {
  member: "bg-violet/12 text-violet",
  api_key: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  org: "bg-red-500/12 text-red-600 dark:text-red-300",
  automation: "bg-cyan/12 text-cyan",
  deal: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
}

function show(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return dateTimeFmt.format(new Date(value))
  return Array.isArray(value) ? value.join(", ") : String(value)
}

export default async function AuditPage({ searchParams }: PageProps<"/app/admin/audit">) {
  const page = await crmPage("audit:read")
  if (!page.ok) return page.fallback
  const { ctx } = page
  const sp = await searchParams
  const filters = { q: one(sp.q), actor: one(sp.actor), type: one(sp.type) }
  const [data, members] = await Promise.all([listAudit(ctx, { ...filters, page: Number(one(sp.page) ?? 1) || 1 }), listMembers(ctx)])

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Audit log"
        description="An append-only record of who changed what and when, including changes made through API keys, automations and “view as” sessions."
        actions={
          <a href="/api/crm/export?type=audit" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background/60 px-3.5 text-sm font-medium transition-colors hover:bg-foreground/5">
            <Download className="size-4" /> Export CSV
          </a>
        }
      />
      <div className="flex flex-wrap gap-3">
        <UrlSearch placeholder="Search summaries or people" className="min-w-60 flex-1" />
        <UrlSelect param="actor" label="Actor" options={[{ value: "", label: "Anyone" }, ...members.map((m) => ({ value: m.id, label: m.name }))]} />
        <UrlSelect
          param="type"
          label="Type"
          options={[
            { value: "", label: "All events" },
            { value: "member", label: "Members & access" },
            { value: "api_key", label: "API keys" },
            { value: "org", label: "Organization" },
            { value: "automation", label: "Automations" },
            { value: "deal", label: "Deals" },
            { value: "contact", label: "Contacts" },
            { value: "ticket", label: "Tickets" },
          ]}
        />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No events match" description="Try a different filter." />
      ) : (
        <ol className="overflow-hidden rounded-2xl border bg-card/60 shadow-sm">
          {data.rows.map((a) => {
            const kind = a.action.split(".")[0]
            const changes = a.changes ? Object.entries(a.changes) : []
            return (
              <li key={a.id} className="border-b px-5 py-3.5 last:border-0">
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <Pill className={tone[kind] ?? "bg-foreground/8 text-muted-foreground"}>{a.action}</Pill>
                  <p className="min-w-0 flex-1 text-sm">{a.summary}</p>
                  <time className="text-xs text-muted-foreground" title={dateTimeFmt.format(a.createdAt)}>
                    <RelativeTime date={a.createdAt} />
                  </time>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>by {a.actorName}</span>
                  {a.impersonatorName && (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                      <Eye className="size-3" /> {a.impersonatorName} was viewing as them
                    </span>
                  )}
                  {a.targetId && <span className="font-mono">{a.targetId}</span>}
                </p>
                {changes.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      {changes.length} field{changes.length > 1 ? "s" : ""} changed
                    </summary>
                    <table className="mt-2 w-full max-w-xl">
                      <tbody>
                        {changes.map(([field, c]) => (
                          <tr key={field}>
                            <td className="py-0.5 pr-3 font-mono text-muted-foreground">{field}</td>
                            <td className="py-0.5 pr-2 text-red-500/80 line-through">{show(c.from)}</td>
                            <td className="py-0.5 text-emerald-600 dark:text-emerald-300">{show(c.to)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={AUDIT_PAGE_SIZE} params={filters} basePath="/app/admin/audit" />
    </div>
  )
}
