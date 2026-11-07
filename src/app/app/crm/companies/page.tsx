import Link from "next/link"
import type { Metadata } from "next"
import { Building2 } from "lucide-react"
import { UrlSearch, UrlSelect } from "@/components/crm/client"
import { NewCompanyDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { EmptyState, HealthBar, PageHeader } from "@/components/crm/ui"
import { compactMoney } from "@/lib/crm/constants"
import { listCompanies } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Companies" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function CompaniesPage({ searchParams }: PageProps<"/app/crm/companies">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const sp = await searchParams
  const rows = await listCompanies(page.ctx, { q: one(sp.q), sort: one(sp.sort) })
  const atRisk = rows.filter((r) => r.health < 45).length

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Companies"
        description={`${rows.length} accounts · ${atRisk} at risk. Health blends open support load, CSAT, recent wins and engagement.`}
        actions={<NewCompanyDialog />}
      />
      <div className="flex flex-wrap gap-3">
        <UrlSearch placeholder="Search name, domain or industry" className="min-w-60 flex-1" />
        <UrlSelect
          param="sort"
          label="Sort"
          options={[
            { value: "", label: "Most revenue" },
            { value: "pipeline", label: "Biggest pipeline" },
            { value: "health", label: "Lowest health" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Building2} title="No companies match" description="Try another search, or add a company." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card/60 shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-3 pl-4 font-medium">Company</th>
                <th className="py-3 font-medium">Industry</th>
                <th className="py-3 font-medium">Size</th>
                <th className="py-3 text-right font-medium">People</th>
                <th className="py-3 text-right font-medium">Open pipeline</th>
                <th className="py-3 text-right font-medium">Won</th>
                <th className="py-3 text-right font-medium">Open tickets</th>
                <th className="py-3 pr-4 pl-6 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="relative border-b transition-colors last:border-0 hover:bg-foreground/[0.03]">
                  <td className="py-3 pl-4">
                    <Link href={`/app/crm/companies/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-foreground/[0.06] text-xs font-semibold">{c.name.slice(0, 2).toUpperCase()}</span>
                      <span>
                        <span className="block font-medium">{c.name}</span>
                        <span className="block text-xs text-muted-foreground">{c.domain}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 text-muted-foreground">{c.industry ?? "—"}</td>
                  <td className="py-3 text-muted-foreground">{c.size ?? "—"}</td>
                  <td className="py-3 text-right tabular-nums">{c.contacts}</td>
                  <td className="py-3 text-right tabular-nums">{c.openDeals ? compactMoney.format(c.openDeals) : "—"}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{c.wonValue ? compactMoney.format(c.wonValue) : "—"}</td>
                  <td className="py-3 text-right tabular-nums">{c.openTickets || "—"}</td>
                  <td className="py-3 pr-4 pl-6">
                    <HealthBar value={c.health} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
