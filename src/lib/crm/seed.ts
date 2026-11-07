import type {
  activities,
  auditLogs,
  automations,
  companies,
  contacts,
  DealStage,
  deals,
  Lifecycle,
  members,
  notifications,
  tasks,
  ticketMessages,
  TicketPriority,
  tickets,
  TicketStatus,
} from "@/db/schema"
import { stageProbability } from "./constants"
import { newId } from "./ids"
import { accountHealth, DEFAULT_SETTINGS, leadScore, slaDueAt, triageTicket } from "./scoring"

/*
 * Deterministic demo data for a sandbox organization ("Kitelane", a B2B SaaS company —
 * the same company the Customer Support knowledge-base template describes).
 * Dates are relative to `now`, so the CRM always looks current.
 */

const DAY = 86_400_000
const HOUR = 3_600_000

type Insert<T extends { $inferInsert: unknown }> = T["$inferInsert"]

export type SeedData = {
  members: Insert<typeof members>[]
  companies: Insert<typeof companies>[]
  contacts: Insert<typeof contacts>[]
  deals: Insert<typeof deals>[]
  tickets: Insert<typeof tickets>[]
  ticketMessages: Insert<typeof ticketMessages>[]
  tasks: Insert<typeof tasks>[]
  activities: Insert<typeof activities>[]
  notifications: Insert<typeof notifications>[]
  automations: Insert<typeof automations>[]
  auditLogs: Insert<typeof auditLogs>[]
}

/** Small seeded PRNG (mulberry32) so every sandbox gets the same believable dataset. */
function createRandom(seed: number) {
  let a = seed
  const next = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    chance: (p: number) => next() < p,
  }
}

const TEAMMATES = [
  { key: "sara", name: "Sara Ahmed", role: "admin", title: "Head of Operations", team: "Operations", hue: 200 },
  { key: "daniel", name: "Daniel Kim", role: "manager", title: "Sales Manager", team: "Sales", hue: 150 },
  { key: "priya", name: "Priya Raman", role: "manager", title: "Support Lead", team: "Support", hue: 330 },
  { key: "omar", name: "Omar Farooq", role: "agent", title: "Support Specialist", team: "Support", hue: 30 },
  { key: "lena", name: "Lena Fischer", role: "agent", title: "Support Specialist", team: "Support", hue: 262 },
  { key: "marcus", name: "Marcus Johnson", role: "agent", title: "Account Executive", team: "Sales", hue: 95 },
  { key: "yuki", name: "Yuki Tanaka", role: "agent", title: "Customer Success Manager", team: "Success", hue: 180 },
  { key: "aisha", name: "Aisha Malik", role: "viewer", title: "Finance Analyst", team: "Operations", hue: 12 },
  { key: "tom", name: "Tom Becker", role: "agent", title: "Support Specialist", team: "Support", hue: 220, status: "invited" },
  { key: "chen", name: "Chen Wei", role: "agent", title: "Solutions Engineer", team: "Engineering", hue: 120, status: "suspended" },
] as const

type MateKey = (typeof TEAMMATES)[number]["key"] | "owner"

const COMPANIES = [
  ["Acme Robotics", "Manufacturing", "201-1000", "United States"],
  ["Bluebird Health", "Healthcare", "1000+", "United States"],
  ["Cobalt Logistics", "Logistics", "201-1000", "Germany"],
  ["Driftwood Studios", "Media", "11-50", "Canada"],
  ["Evergreen Foods", "Retail", "1000+", "United Kingdom"],
  ["Foxglove Finance", "Financial services", "51-200", "United Kingdom"],
  ["Granite Systems", "Software", "201-1000", "United States"],
  ["Harbor Analytics", "Software", "51-200", "Netherlands"],
  ["Ironclad Security", "Cybersecurity", "51-200", "Israel"],
  ["Juniper Retail", "Retail", "201-1000", "Australia"],
  ["Keystone Legal", "Legal", "11-50", "United States"],
  ["Lighthouse Media", "Media", "51-200", "Ireland"],
  ["Monarch Travel", "Travel", "201-1000", "Spain"],
  ["Nimbus Cloud", "Software", "1000+", "United States"],
  ["Orchard Learning", "Education", "51-200", "India"],
  ["Pinnacle Energy", "Energy", "1000+", "United Arab Emirates"],
  ["Quartz Labs", "Biotech", "11-50", "Switzerland"],
  ["Redwood Manufacturing", "Manufacturing", "1000+", "Mexico"],
  ["Summit Fitness", "Consumer", "51-200", "United States"],
  ["Tidal Marine", "Logistics", "201-1000", "Norway"],
  ["Umbra Games", "Gaming", "51-200", "Poland"],
  ["Vertex Biotech", "Biotech", "201-1000", "United States"],
  ["Willow Insurance", "Insurance", "1000+", "Canada"],
  ["Xenon Mobility", "Automotive", "201-1000", "Germany"],
  ["Yarrow Hospitality", "Hospitality", "51-200", "Portugal"],
  ["Zephyr Aerospace", "Aerospace", "1000+", "France"],
  ["Atlas Architecture", "Construction", "11-50", "Pakistan"],
  ["Beacon Nonprofit", "Nonprofit", "11-50", "Kenya"],
  ["Cedar Realty", "Real estate", "51-200", "United States"],
  ["Delta Telecom", "Telecommunications", "1000+", "Brazil"],
] as const

const FIRST = ["Maya", "Liam", "Sofia", "Noah", "Zara", "Ethan", "Hana", "Lucas", "Amara", "Leo", "Nadia", "Oliver", "Iris", "Mateo", "Fatima", "Jonas", "Elena", "Ravi", "Chloe", "Samuel", "Ingrid", "Diego", "Mei", "Arjun", "Clara", "Kofi", "Ava", "Hugo", "Leila", "Felix"]
const LAST = ["Chen", "Patel", "Novak", "Okafor", "Silva", "Larsen", "Haddad", "Moreau", "Kowalski", "Nakamura", "Rossi", "Andersson", "Mensah", "Costa", "Weber", "Iqbal", "Duarte", "Lindqvist", "Byrne", "Kaplan", "Sato", "Fernandes", "Hughes", "Yilmaz", "Ortega", "Brennan", "Kim", "Nwosu", "Abbasi", "Varga"]
const TITLES = ["CTO", "VP of Customer Experience", "Head of Support", "Operations Manager", "Director of IT", "Support Team Lead", "Product Manager", "CFO", "Founder & CEO", "IT Administrator", "Customer Success Lead", "Procurement Specialist", "Engineering Manager", "Head of People", "COO"]

const TICKET_TEMPLATES: { subject: string; body: string; reply: string }[] = [
  { subject: "Refund for our annual plan renewal", body: "Our annual plan auto-renewed three weeks ago but we'd moved to a different tool. Can we get a refund?", reply: "Thanks for reaching out. Annual plans can be refunded pro rata within 30 days of renewal, so you're eligible. I've started the refund; it lands in 5–7 business days." },
  { subject: "Charged twice this month", body: "We see two identical charges on our card for this month's invoice. Please fix this.", reply: "Sorry about that. The second charge was a retry that shouldn't have gone through. I've refunded it and added a note so it doesn't happen again." },
  { subject: "Can't log in after enabling 2FA", body: "Our admin enabled two-factor authentication and now she's locked out. We need access urgently.", reply: "I've verified the account owner and reset 2FA for her. She can sign in now and set up her authenticator app again." },
  { subject: "SAML SSO setup with Okta", body: "We'd like to set up SAML single sign-on with our Okta tenant. What do you need from us?", reply: "Happy to help. SSO is available on Business and Enterprise. Send us your Okta metadata URL and we'll enable it on our side within one business day." },
  { subject: "API returning 429 rate-limit errors", body: "Our integration keeps getting 429 responses from the API since this morning.", reply: "Your workspace is on Pro, which allows 600 requests per minute. Your sync job was bursting above that. I've shared a backoff example, and Business raises the limit to 3,000." },
  { subject: "Webhook deliveries failing since yesterday", body: "None of our webhooks have been delivered since yesterday afternoon. Our order sync is down.", reply: "We found a certificate change on your endpoint that our delivery workers rejected. Deliveries have been replayed and are flowing again." },
  { subject: "How do I export all conversations to CSV?", body: "Is there a way to export every conversation from last quarter as a CSV file?", reply: "Yes. Go to Settings → Data → Export, choose the date range and CSV. You'll get an email with the download link." },
  { subject: "Where is our EU customer data stored?", body: "Our DPO is asking where EU customer data is hosted and whether it leaves the EU.", reply: "EU workspaces are hosted in Frankfurt (eu-central-1) and data doesn't leave the EU. I've attached our sub-processor list." },
  { subject: "Need a signed DPA for our legal team", body: "Our legal team needs a countersigned Data Processing Agreement before we can expand the rollout.", reply: "I've sent our standard DPA for e-signature. Once you sign it, we countersign within two business days." },
  { subject: "Quote for upgrading to Enterprise (80 seats)", body: "We're looking at Enterprise for 80 seats. Can you send a quote and the SSO and audit-log details?", reply: "Great to hear. I've looped in your account executive, who'll send a quote today, including SSO, audit logs and priority support." },
  { subject: "Dashboard is very slow to load", body: "The analytics dashboard takes 20+ seconds to load for our team since last week.", reply: "We traced it to a slow query on very large date ranges and shipped a fix this morning. Load times should be back under two seconds." },
  { subject: "Invoice needs our VAT number", body: "Could you reissue last month's invoice with our VAT number on it?", reply: "Done. I've added your VAT number to the billing profile and reissued the invoice; future invoices will include it too." },
  { subject: "Cancel our subscription at the end of the term", body: "We've decided not to renew. Please cancel our subscription at the end of the current term.", reply: "I've scheduled the cancellation for the end of your term. Before then, would a short call help? I'd love to understand what we could have done better." },
  { subject: "Feature request: Slack alerts for new tickets", body: "It would be great to get a Slack message whenever a new urgent ticket comes in.", reply: "Thanks, that's a great idea. I've added your vote to the request; our product team reviews these every sprint." },
  { subject: "Assistant gave a wrong answer about refunds", body: "The AI assistant told a customer refunds take 30 days, which isn't our policy.", reply: "Thanks for flagging it. The assistant was citing an outdated document. We've removed it from the knowledge base and the answer now cites the current policy." },
  { subject: "Add 15 more seats to our workspace", body: "We're onboarding a new team next month and need 15 more seats.", reply: "I've added 15 seats, prorated on your next invoice. Your new teammates can be invited from Settings → Members." },
  { subject: "Password reset email never arrives", body: "Several of our users request a password reset but the email never shows up.", reply: "Your mail server was rejecting our sender. Allow-list mail.kitelane.example and the reset emails will arrive." },
  { subject: "GDPR data deletion request", body: "A former customer of ours has requested deletion of all their data under GDPR.", reply: "We've processed the deletion and will send a confirmation certificate within 72 hours, as the DPA requires." },
]

const STATUS_PLAN: TicketStatus[] = [
  ...Array<TicketStatus>(14).fill("open"),
  ...Array<TicketStatus>(8).fill("pending"),
  ...Array<TicketStatus>(20).fill("resolved"),
  ...Array<TicketStatus>(6).fill("closed"),
]

const DEAL_PLAN: DealStage[] = [
  ...Array<DealStage>(7).fill("new"),
  ...Array<DealStage>(8).fill("qualified"),
  ...Array<DealStage>(7).fill("proposal"),
  ...Array<DealStage>(5).fill("negotiation"),
  ...Array<DealStage>(9).fill("won"),
  ...Array<DealStage>(4).fill("lost"),
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "")

export function buildSeed({
  orgId,
  owner,
  now = Date.now(),
}: {
  orgId: string
  owner: { id: string; name: string }
  now?: number
}): SeedData {
  const r = createRandom(20261107)
  const at = (msAgo: number) => new Date(now - msAgo)
  const data: SeedData = {
    members: [],
    companies: [],
    contacts: [],
    deals: [],
    tickets: [],
    ticketMessages: [],
    tasks: [],
    activities: [],
    notifications: [],
    automations: [],
    auditLogs: [],
  }

  // Team ------------------------------------------------------------------
  const ids: Record<MateKey, string> = { owner: owner.id } as Record<MateKey, string>
  const names: Record<string, string> = { [owner.id]: owner.name }
  for (const m of TEAMMATES) {
    const id = newId("mem")
    ids[m.key] = id
    names[id] = m.name
    const status = "status" in m ? m.status : "active"
    data.members.push({
      id,
      orgId,
      name: m.name,
      email: `${m.key}@kitelane.example`,
      role: m.role,
      status,
      title: m.title,
      team: m.team,
      avatarHue: m.hue,
      timezone: r.pick(["Europe/London", "America/New_York", "Asia/Karachi", "Europe/Berlin", "Asia/Tokyo"]),
      signature: `${m.name}\n${m.title}, Kitelane`,
      invitedById: status === "invited" ? ids.sara : owner.id,
      createdAt: at(r.int(40, 400) * DAY),
      lastActiveAt: status === "active" ? at(r.int(5, 60 * 24) * 60_000) : null,
    })
  }
  const support = [ids.priya, ids.omar, ids.lena]
  const sales = [ids.daniel, ids.marcus]

  // Companies & contacts --------------------------------------------------
  const companyRows = COMPANIES.map(([name, industry, size, country], i) => {
    const id = newId("co")
    const lifecycle: Lifecycle = i < 15 ? "customer" : i < 21 ? "qualified" : i < 28 ? "lead" : "churned"
    return { id, name, industry, size, country, lifecycle, domain: `${slug(name)}.example` }
  })

  const contactRows: { id: string; companyId: string; lifecycle: Lifecycle; name: string; title: string; source: string; ownerId: string; createdAt: Date }[] = []
  let personIndex = 0
  for (const c of companyRows) {
    const ownerId = c.lifecycle === "customer" ? r.pick([ids.yuki, ids.yuki, owner.id]) : r.pick([...sales, owner.id])
    data.companies.push({
      id: c.id,
      orgId,
      name: c.name,
      domain: c.domain,
      industry: c.industry,
      size: c.size,
      country: c.country,
      ownerId,
      createdAt: at(r.int(30, 420) * DAY),
    })
    const count = r.int(2, 4)
    for (let k = 0; k < count; k++) {
      const first = FIRST[(personIndex * 7) % FIRST.length]
      // Shift the surname each time first names wrap around, so every full name is unique.
      const last = LAST[(personIndex * 11 + Math.floor(personIndex / FIRST.length) * 7 + 3) % LAST.length]
      personIndex++
      const name = `${first} ${last}`
      const title = k === 0 ? r.pick(["CTO", "Founder & CEO", "VP of Customer Experience", "COO", "Head of Support"]) : r.pick(TITLES)
      contactRows.push({
        id: newId("con"),
        companyId: c.id,
        lifecycle: c.lifecycle,
        name,
        title,
        source: r.pick(["website", "website", "referral", "event", "outbound", "chat", "import"]),
        ownerId,
        createdAt: at(r.int(10, 400) * DAY),
      })
    }
  }
  const contactsByCompany = new Map<string, typeof contactRows>()
  for (const c of contactRows) contactsByCompany.set(c.companyId, [...(contactsByCompany.get(c.companyId) ?? []), c])
  const companyOf = (contactId: string) => contactRows.find((c) => c.id === contactId)!.companyId

  // Deals -----------------------------------------------------------------
  const dealNames = ["Business annual", "Enterprise rollout", "Expansion: +25 seats", "Renewal 2027", "Pilot to Enterprise", "Support add-on", "Multi-region upgrade", "AI assistant add-on"]
  const positions: Record<string, number> = {}
  const openValueByContact = new Map<string, number>()
  DEAL_PLAN.forEach((stage, i) => {
    const company = companyRows[(i * 7) % companyRows.length]
    const contact = contactsByCompany.get(company.id)![0]
    const value = r.pick([4_800, 7_200, 12_000, 18_500, 24_000, 36_000, 48_000, 64_000, 85_000, 120_000, 140_000])
    const closed = stage === "won" || stage === "lost"
    const stageAge = stage === "won" ? r.int(1, 45) : closed ? r.int(5, 80) : r.chance(0.3) ? r.int(16, 40) : r.int(1, 12)
    positions[stage] = (positions[stage] ?? 0) + 1
    const id = newId("deal")
    data.deals.push({
      id,
      orgId,
      title: `${company.name} — ${dealNames[i % dealNames.length]}`,
      companyId: company.id,
      contactId: contact.id,
      ownerId: company.lifecycle === "customer" ? r.pick([ids.yuki, ids.marcus, owner.id]) : r.pick([...sales, owner.id]),
      stage,
      value,
      probability: stageProbability(stage),
      position: positions[stage] * 1000,
      nextStep: closed ? null : r.pick(["Send proposal", "Security review call", "Pricing sign-off from CFO", "Technical deep-dive", "Share case study", "Legal redlines"]),
      lostReason: stage === "lost" ? r.pick(["Went with a competitor", "No budget this year", "Project paused"]) : null,
      expectedCloseAt: closed ? at(stageAge * DAY) : new Date(now + r.int(5, 75) * DAY),
      stageChangedAt: at(stageAge * DAY + r.int(1, 20) * HOUR),
      createdAt: at((stageAge + r.int(10, 60)) * DAY),
      updatedAt: at(stageAge * DAY),
    })
    if (!closed) openValueByContact.set(contact.id, (openValueByContact.get(contact.id) ?? 0) + value)
    data.activities.push({
      id: newId("act"),
      orgId,
      type: "stage_change",
      subjectType: "deal",
      subjectId: id,
      contactId: contact.id,
      companyId: company.id,
      actorId: r.pick([...sales, ids.yuki]),
      title: `Moved to ${stage[0].toUpperCase()}${stage.slice(1)}`,
      meta: { to: stage },
      occurredAt: at(stageAge * DAY + r.int(1, 20) * HOUR),
    })
  })

  // Tickets ---------------------------------------------------------------
  const ticketList = STATUS_PLAN.map((status, i) => {
    const template = TICKET_TEMPLATES[(i * 5) % TICKET_TEMPLATES.length]
    const contact = contactRows[(i * 13 + 4) % contactRows.length]
    const triage = triageTicket(`${template.subject} ${template.body}`)
    const recent = status === "open" || status === "pending"
    // Open work is recent; closed tickets spread over the last few weeks so trends have shape.
    const createdAt = recent ? at(r.int(1, 40) * HOUR) : at(r.int(1, 24) * DAY + r.int(0, 20) * HOUR)
    return { status, template, contact, triage, createdAt }
  }).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  ticketList.forEach(({ status, template, contact, triage, createdAt }, i) => {
    const id = newId("tkt")
    const priority: TicketPriority = triage.priority
    const dueAt = slaDueAt(createdAt, priority)
    const responded = status !== "open" || r.chance(0.45)
    const slaHours = DEFAULT_SETTINGS.slaHours[priority]
    const firstResponseAt = responded
      ? new Date(createdAt.getTime() + (r.chance(0.85) ? r.next() * 0.8 : 1 + r.next() * 0.6) * slaHours * HOUR)
      : null
    const resolved = status === "resolved" || status === "closed"
    const resolvedAt = resolved ? new Date(createdAt.getTime() + r.int(2, 60) * HOUR) : null
    const assigneeId = status === "open" && r.chance(0.3) ? null : r.pick(support)
    const lastTouch = resolvedAt ?? firstResponseAt ?? createdAt
    data.tickets.push({
      id,
      orgId,
      number: 1001 + i,
      subject: template.subject,
      contactId: contact.id,
      assigneeId,
      status,
      priority,
      channel: r.pick(["email", "email", "chat", "web", "agent"]),
      team: triage.team,
      tags: triage.tags,
      csat: resolved && r.chance(0.8) ? r.pick([5, 5, 5, 4, 4, 4, 3, 2]) : null,
      dueAt,
      firstResponseAt,
      resolvedAt,
      createdAt,
      updatedAt: lastTouch,
    })
    data.ticketMessages.push({
      id: newId("msg"),
      orgId,
      ticketId: id,
      authorType: "contact",
      authorId: contact.id,
      authorName: contact.name,
      body: template.body,
      createdAt,
    })
    if (r.chance(0.35)) {
      data.ticketMessages.push({
        id: newId("msg"),
        orgId,
        ticketId: id,
        authorType: "ai",
        authorName: "Lumora",
        internal: true,
        body: `Triage: ${priority} priority, routed to ${triage.team}${triage.tags.length ? `, tagged ${triage.tags.join(", ")}` : ""}. Suggested article: "${template.subject.split(" ").slice(0, 3).join(" ")}…" in the knowledge base.`,
        createdAt: new Date(createdAt.getTime() + 20_000),
      })
    }
    if (firstResponseAt) {
      data.ticketMessages.push({
        id: newId("msg"),
        orgId,
        ticketId: id,
        authorType: "member",
        authorId: assigneeId ?? ids.priya,
        authorName: names[assigneeId ?? ids.priya],
        body: template.reply,
        createdAt: firstResponseAt,
      })
    }
    if (status === "pending") {
      data.ticketMessages.push({
        id: newId("msg"),
        orgId,
        ticketId: id,
        authorType: "member",
        authorId: assigneeId ?? ids.priya,
        authorName: names[assigneeId ?? ids.priya],
        internal: true,
        body: "Waiting on the customer to confirm before closing.",
        createdAt: new Date((firstResponseAt ?? createdAt).getTime() + 30 * 60_000),
      })
    }
    data.activities.push({
      id: newId("act"),
      orgId,
      type: "ticket",
      subjectType: "ticket",
      subjectId: id,
      contactId: contact.id,
      companyId: contact.companyId,
      actorId: null,
      title: `Opened ticket #${1001 + i}: ${template.subject}`,
      meta: { priority, status },
      occurredAt: createdAt,
    })
  })

  // Timeline activity (emails, calls, meetings, notes) ---------------------
  const activityKinds = [
    { type: "email", titles: ["Sent onboarding checklist", "Shared pricing for Business plan", "Followed up on proposal", "Sent QBR summary", "Replied about SSO timeline"] },
    { type: "call", titles: ["Discovery call", "Check-in call", "Pricing discussion", "Renewal call", "Escalation call"] },
    { type: "meeting", titles: ["Product demo", "Quarterly business review", "Security review", "Kickoff meeting", "Executive sponsor sync"] },
    { type: "note", titles: ["Champion is moving teams in Q1", "Budget approved for next year", "Evaluating two competitors", "Asked for a reference customer", "Wants SLA credits in contract"] },
  ] as const
  for (let i = 0; i < 170; i++) {
    const contact = contactRows[(i * 17 + 2) % contactRows.length]
    if (contact.lifecycle === "churned" && r.chance(0.7)) continue
    const kind = r.pick(activityKinds)
    const daysAgo = Math.floor(Math.pow(r.next(), 1.6) * 60)
    data.activities.push({
      id: newId("act"),
      orgId,
      type: kind.type,
      subjectType: "contact",
      subjectId: contact.id,
      contactId: contact.id,
      companyId: contact.companyId,
      actorId: r.pick([contact.ownerId, contact.ownerId, ...support, ids.yuki]),
      title: r.pick(kind.titles),
      body:
        kind.type === "note"
          ? r.pick(["Keep an eye on this before renewal.", "Loop in Yuki for the success plan.", "Follow up after their board meeting."])
          : kind.type === "call"
            ? `${r.int(12, 48)} minute call. Next step agreed.`
            : null,
      meta: kind.type === "meeting" ? { durationMinutes: r.pick([30, 45, 60]) } : {},
      occurredAt: at(daysAgo * DAY + r.int(1, 20) * HOUR),
    })
  }

  // Lead scores & health from the generated activity ----------------------
  const companySize = new Map(companyRows.map((c) => [c.id, c.size]))
  for (const c of contactRows) {
    const acts = data.activities.filter((a) => a.contactId === c.id)
    const last = acts.reduce<number | null>((m, a) => Math.max(m ?? 0, (a.occurredAt as Date).getTime()), null)
    const within30 = acts.filter((a) => now - (a.occurredAt as Date).getTime() < 30 * DAY)
    const { score, reasons } = leadScore({
      title: c.title,
      source: c.source,
      lifecycle: c.lifecycle,
      companySize: companySize.get(c.companyId),
      activities30d: within30.length,
      meetings30d: within30.filter((a) => a.type === "meeting").length,
      openDealValue: openValueByContact.get(c.id) ?? 0,
      daysSinceActivity: last ? Math.floor((now - last) / DAY) : null,
    })
    const [first, ...rest] = c.name.toLowerCase().split(" ")
    const domain = companyRows.find((co) => co.id === c.companyId)!.domain
    data.contacts.push({
      id: c.id,
      orgId,
      companyId: c.companyId,
      name: c.name,
      email: `${first}.${rest.join("")}@${domain}`,
      phone: `+1 555 ${String(r.int(100, 999))} ${String(r.int(1000, 9999))}`,
      title: c.title,
      lifecycle: c.lifecycle,
      source: c.source,
      ownerId: c.ownerId,
      tags: [
        ...(score >= 75 ? ["hot"] : []),
        ...(c.lifecycle === "customer" && r.chance(0.3) ? ["champion"] : []),
        ...(r.chance(0.15) ? ["beta"] : []),
      ],
      score,
      scoreReasons: reasons,
      lastActivityAt: last ? new Date(last) : null,
      createdAt: c.createdAt,
    })
  }

  for (const co of data.companies) {
    const companyTickets = data.tickets.filter((t) => t.contactId && companyOf(t.contactId) === co.id)
    const open = companyTickets.filter((t) => t.status === "open" || t.status === "pending")
    const rated = companyTickets.filter((t) => t.csat)
    const acts = data.activities.filter((a) => a.companyId === co.id)
    const last = acts.reduce<number | null>((m, a) => Math.max(m ?? 0, (a.occurredAt as Date).getTime()), null)
    co.health = accountHealth({
      openTickets: open.length,
      urgentOpenTickets: open.filter((t) => t.priority === "urgent" || t.priority === "high").length,
      avgCsat: rated.length ? rated.reduce((s, t) => s + (t.csat ?? 0), 0) / rated.length : null,
      wonDeals90d: data.deals.filter((d) => d.companyId === co.id && d.stage === "won").length,
      daysSinceActivity: last ? Math.floor((now - last) / DAY) : null,
    })
    if (companyRows.find((c) => c.id === co.id)!.lifecycle === "churned") co.health = Math.min(co.health ?? 30, 30)
  }

  // Tasks -----------------------------------------------------------------
  const taskTitles = [
    (n: string) => `Follow up with ${n} about the proposal`,
    (n: string) => `Send renewal quote to ${n}`,
    (n: string) => `Prepare QBR deck for ${n}`,
    (n: string) => `Check in with ${n} after the 2FA fix`,
    (n: string) => `Review churn risk for ${n}`,
    (n: string) => `Book a security review with ${n}`,
    (n: string) => `Share the SSO setup guide with ${n}`,
  ]
  for (let i = 0; i < 32; i++) {
    const contact = data.contacts[(i * 7 + 1) % data.contacts.length]
    const assignee = i < 8 ? owner.id : r.pick([...sales, ...support, ids.yuki])
    const offset = r.int(-4, 9)
    const done = offset < -1 && r.chance(0.5)
    data.tasks.push({
      id: newId("task"),
      orgId,
      title: taskTitles[i % taskTitles.length](contact.name.split(" ")[0]),
      priority: r.pick(["low", "normal", "normal", "high"]),
      dueAt: new Date(new Date(now + offset * DAY).setHours(r.pick([10, 12, 15, 17]), 0, 0, 0)),
      assigneeId: assignee,
      done,
      completedAt: done ? at(r.int(1, 3) * DAY) : null,
      relatedType: "contact",
      relatedId: contact.id,
      source: r.pick(["manual", "manual", "automation", "agent"]),
      createdById: r.pick([owner.id, ids.daniel, ids.priya]),
      createdAt: at(r.int(5, 15) * DAY),
    })
  }

  // Automations -----------------------------------------------------------
  data.automations.push(
    {
      id: newId("auto"),
      orgId,
      name: "Urgent tickets go to the Support lead",
      trigger: "ticket.created",
      conditions: [{ field: "priority", op: "eq", value: "urgent" }],
      actions: [
        { type: "assign", memberId: ids.priya },
        { type: "notify", memberId: owner.id, message: "An urgent ticket just arrived" },
      ],
      runCount: 23,
      lastRunAt: at(5 * HOUR),
      createdById: ids.sara,
      createdAt: at(80 * DAY),
    },
    {
      id: newId("auto"),
      orgId,
      name: "Round-robin new Support tickets",
      trigger: "ticket.created",
      conditions: [{ field: "team", op: "eq", value: "Support" }],
      actions: [{ type: "round_robin", team: "Support" }],
      runCount: 186,
      lastRunAt: at(2 * HOUR),
      createdById: ids.priya,
      createdAt: at(120 * DAY),
    },
    {
      id: newId("auto"),
      orgId,
      name: "Won deal kicks off onboarding",
      trigger: "deal.stage_changed",
      conditions: [{ field: "stage", op: "eq", value: "won" }],
      actions: [
        { type: "create_task", title: "Kick off onboarding", dueInDays: 2 },
        { type: "notify", memberId: ids.yuki, message: "A deal was won — time to plan onboarding" },
      ],
      runCount: 9,
      lastRunAt: at(3 * DAY),
      createdById: ids.daniel,
      createdAt: at(95 * DAY),
    },
    {
      id: newId("auto"),
      orgId,
      name: "Referral leads go to the Sales manager",
      trigger: "contact.created",
      conditions: [{ field: "source", op: "eq", value: "referral" }],
      actions: [
        { type: "assign", memberId: ids.daniel },
        { type: "add_tag", tag: "referral" },
      ],
      runCount: 14,
      lastRunAt: at(6 * DAY),
      createdById: ids.daniel,
      createdAt: at(60 * DAY),
    },
    {
      id: newId("auto"),
      orgId,
      name: "Cancellation requests get a save call",
      trigger: "ticket.created",
      conditions: [{ field: "subject", op: "contains", value: "cancel" }],
      actions: [
        { type: "add_tag", tag: "churn-risk" },
        { type: "create_task", title: "Schedule a save call", dueInDays: 1 },
      ],
      enabled: false,
      runCount: 4,
      lastRunAt: at(21 * DAY),
      createdById: ids.yuki,
      createdAt: at(40 * DAY),
    }
  )

  // Notifications for the signed-in owner ---------------------------------
  const urgentOpen = data.tickets.find((t) => t.status === "open" && t.priority === "urgent")
  const hot = [...data.contacts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  const negotiation = data.deals.find((d) => d.stage === "negotiation")
  const notes: [string, string, string | null, number, boolean][] = [
    ["sla", `SLA at risk on #${urgentOpen?.number ?? 1040}`, `/app/crm/inbox?t=${urgentOpen?.id ?? ""}`, 25 * 60_000, false],
    ["assignment", "Priya assigned you 2 tasks", "/app/crm/tasks", 2 * HOUR, false],
    ["lead", `New hot lead: ${hot.name} (score ${hot.score})`, `/app/crm/contacts/${hot.id}`, 5 * HOUR, false],
    ["deal", `${negotiation?.title ?? "A deal"} moved to Negotiation`, "/app/crm/deals", 9 * HOUR, true],
    ["automation", "“Urgent tickets go to the Support lead” ran 3 times today", "/app/admin/automations", 20 * HOUR, true],
    ["member", "Tom Becker hasn't accepted his invite yet", "/app/admin/team", 2 * DAY, true],
  ]
  for (const [kind, title, href, ago, read] of notes) {
    data.notifications.push({
      id: newId("ntf"),
      orgId,
      memberId: owner.id,
      kind,
      title,
      href,
      readAt: read ? at(ago - 60_000) : null,
      createdAt: at(ago),
    })
  }

  // Audit history ---------------------------------------------------------
  const audit: [MateKey, string, string, string, number][] = [
    ["sara", "member.invited", "member", "Invited Tom Becker as Agent", 2 * DAY],
    ["sara", "member.suspended", "member", "Suspended Chen Wei", 4 * DAY],
    ["owner", "member.role_changed", "member", "Changed Daniel Kim's role from Agent to Manager", 6 * DAY],
    ["priya", "automation.updated", "automation", "Updated “Round-robin new Support tickets”", 7 * DAY],
    ["daniel", "contact.imported", "contact", "Imported 42 contacts from CSV", 8 * DAY],
    ["sara", "org.settings_updated", "organization", "Changed urgent SLA from 4h to 2h", 9 * DAY],
    ["owner", "api_key.created", "api_key", "Created API key “Zapier sync” (crm:read)", 10 * DAY],
    ["owner", "api_key.revoked", "api_key", "Revoked API key “Old Zapier sync”", 10 * DAY + HOUR],
    ["daniel", "deal.deleted", "deal", "Deleted duplicate deal “Juniper Retail — Pilot”", 11 * DAY],
    ["yuki", "automation.disabled", "automation", "Paused “Cancellation requests get a save call”", 12 * DAY],
    ["sara", "member.role_changed", "member", "Changed Aisha Malik's role from Agent to Viewer", 13 * DAY],
  ]
  for (const [actor, action, targetType, summary, ago] of audit) {
    const actorId = ids[actor]
    data.auditLogs.push({
      id: newId("aud"),
      orgId,
      actorId,
      actorName: names[actorId],
      action,
      targetType,
      summary,
      createdAt: at(ago),
    })
  }

  return data
}
