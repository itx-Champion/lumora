import type { Metadata } from "next"
import { Download, Users } from "lucide-react"
import { UrlSearch, UrlSelect, UrlTabs } from "@/components/crm/client"
import { ContactsTable } from "@/components/crm/contacts-table"
import { CsvImport } from "@/components/crm/csv-import"
import { NewContactDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { Pagination } from "@/components/crm/pagination"
import { EmptyState, PageHeader } from "@/components/crm/ui"
import { LIFECYCLES } from "@/lib/crm/constants"
import { CONTACT_PAGE_SIZE, listContacts, listMembers } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Contacts" }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function ContactsPage({ searchParams }: PageProps<"/app/crm/contacts">) {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const sp = await searchParams
  const filters = { q: one(sp.q), lifecycle: one(sp.lifecycle), owner: one(sp.owner), sort: one(sp.sort), tag: one(sp.tag) }
  const [data, members] = await Promise.all([listContacts(ctx, { ...filters, page: Number(one(sp.page) ?? 1) || 1 }), listMembers(ctx)])
  const total = data.lifecycleCounts.reduce((n, l) => n + l.n, 0)
  const active = members.filter((m) => m.status === "active" && m.role !== "viewer")

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Contacts"
        description="Every person you sell to or support, ranked by an explainable AI lead score."
        actions={
          <>
            <a href="/api/crm/export?type=contacts" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background/60 px-3.5 text-sm font-medium transition-colors hover:bg-foreground/5">
              <Download className="size-4" /> Export
            </a>
            <CsvImport />
            <NewContactDialog members={active} />
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <UrlTabs
          param="lifecycle"
          tabs={[{ value: "", label: "All", count: total }, ...LIFECYCLES.map((l) => ({ value: l.id, label: l.label, count: data.lifecycleCounts.find((c) => c.lifecycle === l.id)?.n ?? 0 }))]}
        />
        <UrlSearch placeholder="Search name, email or company" className="min-w-60 flex-1" />
        <UrlSelect
          param="owner"
          label="Owner"
          options={[{ value: "", label: "Any owner" }, { value: "me", label: "My contacts" }, { value: "none", label: "Unassigned" }, ...active.map((m) => ({ value: m.id, label: m.name }))]}
        />
        <UrlSelect
          param="sort"
          label="Sort"
          options={[
            { value: "", label: "Highest score" },
            { value: "activity", label: "Recent activity" },
            { value: "recent", label: "Newest" },
            { value: "name", label: "Name A–Z" },
          ]}
        />
      </div>

      {data.rows.length === 0 ? (
        <EmptyState icon={Users} title="No contacts match" description="Try a different search or filter, or add a contact." />
      ) : (
        <ContactsTable rows={data.rows} members={members} />
      )}
      <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={CONTACT_PAGE_SIZE} params={filters} basePath="/app/crm/contacts" />
    </div>
  )
}
