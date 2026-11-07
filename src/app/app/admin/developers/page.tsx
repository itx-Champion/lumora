import type { Metadata } from "next"
import { headers } from "next/headers"
import { Cable, Terminal } from "lucide-react"
import { ApiKeys, CopyButton } from "@/components/crm/api-keys"
import { crmPage } from "@/components/crm/guards"
import { PageHeader, Panel, Pill } from "@/components/crm/ui"
import { MCP_TOOLS } from "@/lib/crm/mcp-tools"
import { listApiKeys } from "@/lib/crm/queries"

export const metadata: Metadata = { title: "API & MCP" }

function Code({ children, copy }: { children: string; copy?: boolean }) {
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-xl border bg-background/80 p-4 font-mono text-xs leading-relaxed" data-lenis-prevent>
        {children}
      </pre>
      {copy !== false && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <CopyButton text={children} />
        </div>
      )}
    </div>
  )
}

export default async function DevelopersPage() {
  const page = await crmPage("api-keys:manage")
  if (!page.ok) return page.fallback
  const keys = await listApiKeys(page.ctx)
  const h = await headers()
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"}`
  const mcpUrl = `${origin}/api/mcp`

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="API & MCP"
        description="Connect Lumora to other tools. AI clients such as Claude, ChatGPT and Cursor can use the CRM through the Model Context Protocol, with the same permissions, automations and audit trail as the app."
      />

      <Panel title="API keys">
        <ApiKeys keys={keys} />
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Cable className="size-4 text-violet" /> MCP server</span>} action={<Pill className="bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">Streamable HTTP</Pill>}>
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background/60 p-3">
            <code className="min-w-0 flex-1 truncate font-mono text-sm">{mcpUrl}</code>
            <CopyButton text={mcpUrl} label="Copy URL" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Claude Code</p>
              <Code>{`claude mcp add --transport http lumora-crm \\
  ${mcpUrl} \\
  --header "Authorization: Bearer lum_live_…"`}</Code>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Claude Desktop / Cursor (mcp.json)</p>
              <Code>{`{
  "mcpServers": {
    "lumora-crm": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${mcpUrl}",
               "--header", "Authorization: Bearer \${LUMORA_KEY}"],
      "env": { "LUMORA_KEY": "lum_live_…" }
    }
  }
}`}</Code>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Tools exposed</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {MCP_TOOLS.map((t) => (
                <li key={t.name} className="rounded-xl border bg-background/50 p-3">
                  <p className="flex items-center gap-2 font-mono text-xs font-semibold">
                    {t.name}
                    <Pill className={t.scope === "crm:write" ? "bg-amber-500/12 text-amber-600 dark:text-amber-300" : "bg-foreground/8 text-muted-foreground"}>{t.scope}</Pill>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Try it in Claude: <em>“Which deals are stalled in Lumora? Open an urgent ticket for Acme Robotics about failed webhooks and assign it per our rules.”</em>
          </p>
        </div>
      </Panel>

      <Panel title={<span className="flex items-center gap-2"><Terminal className="size-4 text-cyan" /> REST API</span>} action={<span className="font-mono text-xs text-muted-foreground">v1 · JSON · Bearer auth</span>}>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["GET", "/api/v1/contacts?q=acme&limit=20", "crm:read", "Search contacts"],
                  ["POST", "/api/v1/contacts", "crm:write", "Create a contact (runs automations, dedupes by email)"],
                  ["GET", "/api/v1/tickets?status=open", "crm:read", "List tickets"],
                  ["POST", "/api/v1/tickets", "crm:write", "Create a ticket (AI triage, SLA, routing)"],
                  ["GET", "/api/v1/pipeline", "crm:read", "Pipeline summary and forecast"],
                ].map(([method, path, scope, label]) => (
                  <tr key={path + method} className="border-b last:border-0">
                    <td className="py-2.5 pl-4">
                      <Pill className={method === "GET" ? "bg-sky-500/12 text-sky-600 dark:text-sky-300" : "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"}>{method}</Pill>
                    </td>
                    <td className="py-2.5 font-mono text-xs">{path}</td>
                    <td className="py-2.5 text-xs text-muted-foreground">{label}</td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[11px] text-muted-foreground">{scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code>{`curl -X POST ${origin}/api/v1/tickets \\
  -H "Authorization: Bearer lum_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"Webhook deliveries failing","body":"Our order sync is down since 9am","contactEmail":"ops@acme.example"}'`}</Code>
          <p className="text-xs text-muted-foreground">Requests are rate limited per key. Errors follow RFC 9457 problem details. Every write is attributed to the key in the audit log.</p>
        </div>
      </Panel>
    </div>
  )
}
