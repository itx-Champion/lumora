import { z } from "zod"
import { generateWithFallback, type Generated } from "@/lib/ai/generate"
import { money, stageLabel } from "@/lib/crm/constants"
import { getContext } from "@/lib/crm/context"
import { can } from "@/lib/crm/permissions"
import { getContactDetail, getPulse, getTicketThread } from "@/lib/crm/queries"
import { clientKey, rateLimit } from "@/lib/rate-limit"

export const maxDuration = 30

const sourceSchema = z.object({ title: z.string().max(200), section: z.string().max(200).optional(), text: z.string().max(2500) })

const bodySchema = z.discriminatedUnion("task", [
  z.object({ task: z.literal("briefing") }),
  z.object({ task: z.literal("contact-summary"), id: z.string().max(40) }),
  z.object({ task: z.literal("ticket-reply"), id: z.string().max(40), sources: z.array(sourceSchema).max(5).default([]) }),
])

const first = (name: string) => name.split(" ")[0]
const days = (d: Date | null) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : null)

/** AI features inside the CRM: morning briefing, contact brief, and grounded ticket replies. */
export async function POST(req: Request) {
  const ctx = await getContext()
  if (!ctx) return Response.json({ error: "Please sign in again." }, { status: 401 })
  const limit = await rateLimit(`${clientKey(req)}:crm-ai:${ctx.member.id}`)
  if (!limit.success) return Response.json({ error: "Too many AI requests. Try again in a minute." }, { status: 429 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 })
  const body = parsed.data

  if (body.task === "briefing") {
    const pulse = await getPulse(ctx)
    const k = pulse.kpis
    const facts = [
      `Open pipeline ${money.format(k.openValue)} (weighted forecast ${money.format(k.weighted)}), won this month ${money.format(k.wonThisMonth)} across ${k.wonThisMonthCount} deals, win rate ${Math.round(k.winRate * 100)}%.`,
      `${k.openTickets} open tickets, first-response SLA met ${k.slaRate === null ? "n/a" : `${Math.round(k.slaRate * 100)}%`} over 14 days, CSAT ${k.csat?.toFixed(1) ?? "n/a"}/5.`,
      ...pulse.signals.map((sig) => `[${sig.severity}] ${sig.title}: ${sig.detail}`),
      `Hot leads: ${pulse.hotLeads.map((l) => `${l.name} (${l.score})`).join(", ") || "none"}.`,
    ].join("\n")
    const ai = await generateWithFallback({
      instructions:
        "You are Lumora, an AI chief-of-staff inside a CRM. Write a crisp morning briefing for the person you're helping: a one-line headline, then 3–5 bullet points ordered by business impact, each ending with a concrete next action. Use only the facts given; never invent names or numbers. Plain markdown, no preamble.",
      prompt: `Briefing for ${ctx.member.name} (${ctx.member.title ?? ctx.member.role}) at ${ctx.org.name}.\n\nFacts:\n${facts}`,
      maxOutputTokens: 400,
    })
    const fallback: Generated = {
      mode: "demo",
      model: "Rule-based summary",
      text: [
        `**${pulse.signals.filter((x) => x.severity === "critical").length || "No"} critical item${pulse.signals.filter((x) => x.severity === "critical").length === 1 ? "" : "s"} today, ${money.format(k.weighted)} weighted pipeline.**`,
        ...pulse.signals.slice(0, 4).map((sig) => `- **${sig.title}.** ${sig.detail.split(" · ")[0]}. → ${sig.cta}.`),
        pulse.hotLeads[0] ? `- **Best lead to call:** ${pulse.hotLeads[0].name}${pulse.hotLeads[0].company ? ` at ${pulse.hotLeads[0].company}` : ""} (score ${pulse.hotLeads[0].score}).` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }
    return Response.json(ai ?? fallback)
  }

  if (body.task === "contact-summary") {
    const d = await getContactDetail(ctx, body.id)
    if (!d) return Response.json({ error: "Contact not found." }, { status: 404 })
    const c = d.contact
    const openDeals = d.deals.filter((x) => x.stage !== "won" && x.stage !== "lost")
    const openTickets = d.tickets.filter((t) => t.status === "open" || t.status === "pending")
    const facts = [
      `${c.name}, ${c.title ?? "unknown title"} at ${d.company?.name ?? "no company"} (${d.company?.industry ?? ""}, ${d.company?.size ?? "?"} employees). Lifecycle: ${c.lifecycle}. Source: ${c.source}.`,
      `Lead score ${c.score}/100 because: ${c.scoreReasons.join("; ")}.`,
      `Deals: ${d.deals.map((x) => `${x.title} — ${stageLabel(x.stage)} ${money.format(x.value)}${x.nextStep ? `, next: ${x.nextStep}` : ""}`).join(" | ") || "none"}.`,
      `Tickets: ${d.tickets.slice(0, 6).map((t) => `#${t.number} ${t.subject} (${t.status}, ${t.priority})`).join(" | ") || "none"}.`,
      `Recent activity: ${d.timeline.slice(0, 10).map((a) => `${a.occurredAt.toISOString().slice(0, 10)} ${a.type}: ${a.title}${a.body ? ` — ${a.body.slice(0, 120)}` : ""}`).join(" | ") || "none"}.`,
    ].join("\n")
    const ai = await generateWithFallback({
      instructions:
        "You are Lumora, an AI assistant in a CRM. Brief a salesperson or CSM before they contact this person. Output markdown: one sentence on who they are and the relationship, then sections **What's happening**, **Risks**, **Suggested next step** with 1–3 short bullets each. Use only the facts; don't invent anything.",
      prompt: facts,
      maxOutputTokens: 420,
    })
    const fallback: Generated = {
      mode: "demo",
      model: "Rule-based summary",
      text: [
        `${c.name} is ${c.title ?? "a contact"}${d.company ? ` at ${d.company.name}` : ""}, currently a **${c.lifecycle}** with a lead score of **${c.score}**.`,
        `**What's happening**`,
        openDeals.length ? `- ${openDeals.length} open deal${openDeals.length > 1 ? "s" : ""}: ${openDeals.map((x) => `${x.title} (${stageLabel(x.stage)}, ${money.format(x.value)})`).join(", ")}.` : "- No open deals right now.",
        d.timeline[0] ? `- Last touch ${days(d.timeline[0].occurredAt)} days ago: ${d.timeline[0].title}.` : "- No logged activity yet.",
        `**Risks**`,
        openTickets.length ? `- ${openTickets.length} open ticket${openTickets.length > 1 ? "s" : ""}, e.g. #${openTickets[0].number} ${openTickets[0].subject}.` : "- No open support issues.",
        `**Suggested next step**`,
        `- ${openDeals[0]?.nextStep ? `${openDeals[0].nextStep} for ${openDeals[0].title}.` : openTickets.length ? "Check in once the open ticket is resolved." : "Schedule a check-in call."}`,
      ].join("\n"),
    }
    return Response.json(ai ?? fallback)
  }

  // ticket-reply
  if (!can(ctx.member.role, "crm:write")) return Response.json({ error: "Viewers can't draft replies." }, { status: 403 })
  const t = await getTicketThread(ctx, body.id)
  if (!t) return Response.json({ error: "Ticket not found." }, { status: 404 })
  const thread = t.messages
    .filter((m) => !m.internal)
    .map((m) => `${m.authorType === "contact" ? "Customer" : "Agent"} (${m.authorName}): ${m.body}`)
    .join("\n\n")
  const kb = body.sources.map((src, i) => `[${i + 1}] ${src.title}${src.section ? ` — ${src.section}` : ""}\n${src.text}`).join("\n\n")
  const signature = ctx.member.signature ?? `${ctx.member.name}\n${ctx.org.name} Support`
  const ai = await generateWithFallback({
    instructions: `You are a senior support agent at ${ctx.org.name}. Draft the next reply to the customer. Be warm, specific and brief (under 130 words). Ground every policy statement in the knowledge-base excerpts; if they don't cover the question, say you'll confirm and follow up. Don't include citation markers, a subject line or placeholders. End with this exact signature:\n${signature}`,
    prompt: `Ticket #${t.ticket.number}: ${t.ticket.subject}\nCustomer: ${t.contact?.name ?? "Customer"}${t.company ? ` (${t.company.name})` : ""}\n\nConversation so far:\n${thread}\n\nKnowledge base excerpts:\n${kb || "None found."}`,
    maxOutputTokens: 380,
  })
  const best = body.sources[0]?.text
    .replace(/^#+\s.*$/gm, "")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 30)
    .slice(0, 2)
    .join(" ")
  const fallback: Generated = {
    mode: "demo",
    model: "Template + knowledge base",
    text: `Hi ${first(t.contact?.name ?? "there")},\n\nThanks for reaching out about “${t.ticket.subject.toLowerCase()}”. ${best ? best : "I'm looking into this now and will follow up with an update shortly."}\n\nLet me know if there's anything else I can help with.\n\n${signature}`,
  }
  return Response.json({ ...(ai ?? fallback), sources: body.sources.map((x) => x.title) })
}
