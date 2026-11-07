/** Tools the Lumora MCP server exposes. Shared by the route handler and the developer docs page. */
export const MCP_TOOLS = [
  { name: "search_crm", scope: "crm:read", description: "Search contacts, companies, deals and tickets by name, email, domain or ticket number." },
  { name: "get_contact", scope: "crm:read", description: "Full profile of a contact by id or email: lead score with reasons, deals, tickets and recent activity." },
  { name: "pipeline_summary", scope: "crm:read", description: "Open pipeline by stage, weighted forecast, win rate and the largest open deals." },
  { name: "list_open_tickets", scope: "crm:read", description: "Open and pending tickets, most urgent first, with SLA due times and assignees." },
  { name: "create_ticket", scope: "crm:write", description: "Open a support ticket. Lumora triages priority and team, sets the SLA and runs automations." },
  { name: "create_contact", scope: "crm:write", description: "Add a contact (deduplicated by email). Scores the lead and runs contact automations." },
  { name: "move_deal", scope: "crm:write", description: "Move a deal, found by name or id, to another pipeline stage." },
  { name: "create_task", scope: "crm:write", description: "Create a follow-up task, optionally assigned to a teammate by name." },
] as const

export type McpToolName = (typeof MCP_TOOLS)[number]["name"]
