import { BarChart3, Inbox, Library, MessageSquare, Settings } from "lucide-react"

export const appNav = [
  { href: "/app", label: "Overview", icon: BarChart3, description: "Usage and knowledge gaps" },
  { href: "/app/chat", label: "Assistant", icon: MessageSquare, description: "Ask your workspace" },
  { href: "/app/knowledge", label: "Knowledge", icon: Library, description: "Documents and sources" },
  { href: "/app/actions", label: "Actions", icon: Inbox, description: "Tickets, emails, meetings" },
  { href: "/app/settings", label: "Settings", icon: Settings, description: "Models and workspace" },
] as const

export function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href)
}
