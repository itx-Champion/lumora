import type { Metadata } from "next"
import { Download } from "lucide-react"
import { DealsBoard } from "@/components/crm/deals-board"
import { NewDealDialog } from "@/components/crm/dialogs"
import { crmPage } from "@/components/crm/guards"
import { PageHeader } from "@/components/crm/ui"
import { eq } from "drizzle-orm"
import * as s from "@/db/schema"
import { getPipeline, listMembers } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "Deals" }

export default async function DealsPage() {
  const page = await crmPage()
  if (!page.ok) return page.fallback
  const { ctx } = page
  const [deals, members, companies, contacts] = await Promise.all([
    getPipeline(ctx),
    listMembers(ctx),
    ctx.db.select({ id: s.companies.id, name: s.companies.name }).from(s.companies).where(eq(s.companies.orgId, ctx.org.id)).orderBy(s.companies.name),
    ctx.db.select({ id: s.contacts.id, name: s.contacts.name, companyId: s.contacts.companyId }).from(s.contacts).where(eq(s.contacts.orgId, ctx.org.id)).orderBy(s.contacts.name),
  ])

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Pipeline"
        description="Drag deals between stages. Win probability, forecasts, the contact's lifecycle and your automations update automatically."
        actions={
          <>
            <a href="/api/crm/export?type=deals" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-background/60 px-3.5 text-sm font-medium transition-colors hover:bg-foreground/5">
              <Download className="size-4" /> Export
            </a>
            <NewDealDialog members={members.filter((m) => m.status === "active" && m.role !== "viewer")} companies={companies} contacts={contacts} />
          </>
        }
      />
      <DealsBoard deals={deals} members={members} />
    </div>
  )
}
