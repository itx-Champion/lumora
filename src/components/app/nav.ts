import {
  Activity,
  BarChart3,
  Building2,
  CheckSquare,
  Code2,
  Contact,
  Inbox,
  KanbanSquare,
  Library,
  MessageSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import type { Permission } from "@/lib/crm/permissions"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  description: string
  /** Hidden from members without this permission (also enforced on the server). */
  permission?: Permission
  /** Needs the CRM database. */
  crm?: boolean
}

export const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/app", label: "Overview", icon: BarChart3, description: "Assistant usage and knowledge gaps" },
      { href: "/app/chat", label: "Assistant", icon: MessageSquare, description: "Ask your knowledge base and CRM" },
      { href: "/app/knowledge", label: "Knowledge", icon: Library, description: "Documents and sources" },
      { href: "/app/actions", label: "Actions", icon: Activity, description: "Tickets, emails and meetings from chat" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/app/crm", label: "Pulse", icon: Sparkles, description: "AI signals across pipeline and support", crm: true },
      { href: "/app/crm/inbox", label: "Inbox", icon: Inbox, description: "Support tickets with SLAs and AI replies", crm: true },
      { href: "/app/crm/deals", label: "Deals", icon: KanbanSquare, description: "Pipeline board and forecast", crm: true },
      { href: "/app/crm/contacts", label: "Contacts", icon: Contact, description: "People, lead scores and timelines", crm: true },
      { href: "/app/crm/companies", label: "Companies", icon: Building2, description: "Accounts and health scores", crm: true },
      { href: "/app/crm/tasks", label: "Tasks", icon: CheckSquare, description: "Follow-ups for you and your team", crm: true },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/app/admin/team", label: "Team", icon: Users, description: "Members, roles and access", permission: "members:manage", crm: true },
      { href: "/app/admin/automations", label: "Automations", icon: Workflow, description: "No-code rules that route and follow up", permission: "automations:manage", crm: true },
      { href: "/app/admin/audit", label: "Audit log", icon: ScrollText, description: "Every change, who made it and when", permission: "audit:read", crm: true },
      { href: "/app/admin/developers", label: "API & MCP", icon: Code2, description: "API keys, REST and the MCP server", permission: "api-keys:manage", crm: true },
      { href: "/app/admin/organization", label: "Organization", icon: ShieldCheck, description: "SLAs, AI triage, seats and data", permission: "org:manage", crm: true },
      { href: "/app/settings", label: "Settings", icon: Settings, description: "Models, theme and workspace data" },
    ],
  },
]

export const appNav: NavItem[] = navGroups.flatMap((g) => g.items)

const extraTitles: { prefix: string; label: string; description: string }[] = [
  { prefix: "/app/profile", label: "Your profile", description: "Personal details, signature and notifications" },
]

export function isActive(pathname: string, href: string) {
  if (href === "/app" || href === "/app/crm") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function currentNav(pathname: string) {
  const match = [...appNav].sort((a, b) => b.href.length - a.href.length).find((n) => isActive(pathname, n.href) || pathname.startsWith(`${n.href}/`))
  if (match) return match
  const extra = extraTitles.find((e) => pathname.startsWith(e.prefix))
  return extra ? { ...extra, href: extra.prefix } : undefined
}
