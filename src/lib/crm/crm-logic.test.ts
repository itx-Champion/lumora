import { describe, expect, it } from "vitest"
import { automationMatches, conditionMatches, describeAutomation, pickRoundRobin } from "./automation-engine"
import { can, canImpersonate, memberChangeError, permissionsFor } from "./permissions"
import { accountHealth, leadScore, slaDueAt, slaState, triageTicket } from "./scoring"

describe("permissions", () => {
  it("grants admin powers only to owners and admins", () => {
    expect(can("owner", "members:manage")).toBe(true)
    expect(can("admin", "members:manage")).toBe(true)
    expect(can("manager", "members:manage")).toBe(false)
    expect(can("viewer", "crm:write")).toBe(false)
    expect(permissionsFor("viewer")).toEqual(["crm:read"])
  })

  it("keeps billing owner-only", () => {
    expect(can("owner", "billing:manage")).toBe(true)
    expect(can("admin", "billing:manage")).toBe(false)
  })

  const owner = { id: "o", role: "owner" as const }
  const admin = { id: "a", role: "admin" as const }

  it("stops admins from changing other admins or owners", () => {
    expect(memberChangeError(admin, { id: "a2", role: "admin" }, { role: "agent" }, 1)).toMatch(/can't change/)
    expect(memberChangeError(admin, { id: "o", role: "owner" }, { status: "suspended" }, 2)).toMatch(/can't change/)
    expect(memberChangeError(admin, { id: "m", role: "manager" }, { role: "agent" }, 1)).toBeNull()
  })

  it("never lets anyone grant a role above their own", () => {
    expect(memberChangeError(admin, { id: "m", role: "agent" }, { role: "owner" }, 1)).toMatch(/above your own/)
    expect(memberChangeError(owner, { id: "m", role: "agent" }, { role: "owner" }, 1)).toBeNull()
  })

  it("protects the last owner and blocks self-suspension", () => {
    expect(memberChangeError(owner, owner, { role: "admin" }, 1)).toMatch(/at least one owner/)
    expect(memberChangeError(owner, owner, { role: "admin" }, 2)).toBeNull()
    expect(memberChangeError(owner, owner, { status: "suspended" }, 2)).toMatch(/yourself/)
  })

  it("only lets people view the app as active members below them", () => {
    expect(canImpersonate(owner, { id: "a", role: "admin", status: "active" })).toBe(true)
    expect(canImpersonate(admin, { id: "a2", role: "admin", status: "active" })).toBe(false)
    expect(canImpersonate(admin, { id: "g", role: "agent", status: "suspended" })).toBe(false)
    expect(canImpersonate({ id: "m", role: "manager" }, { id: "g", role: "agent", status: "active" })).toBe(false)
  })
})

describe("automation engine", () => {
  const ticket = { priority: "urgent", subject: "Webhooks failing after cancel", team: "Support", value: 12000 }

  it("matches conditions case-insensitively", () => {
    expect(conditionMatches({ field: "priority", op: "eq", value: "Urgent" }, ticket)).toBe(true)
    expect(conditionMatches({ field: "subject", op: "contains", value: "CANCEL" }, ticket)).toBe(true)
    expect(conditionMatches({ field: "team", op: "neq", value: "Sales" }, ticket)).toBe(true)
    expect(conditionMatches({ field: "value", op: "gte", value: "10000" }, ticket)).toBe(true)
    expect(conditionMatches({ field: "value", op: "lte", value: "9999" }, ticket)).toBe(false)
  })

  it("requires every condition (AND) and treats no conditions as always", () => {
    expect(automationMatches([], ticket)).toBe(true)
    expect(
      automationMatches(
        [
          { field: "priority", op: "eq", value: "urgent" },
          { field: "team", op: "eq", value: "Sales" },
        ],
        ticket
      )
    ).toBe(false)
  })

  it("round-robins to the least-loaded teammate", () => {
    expect(pickRoundRobin([{ id: "b", openLoad: 3 }, { id: "c", openLoad: 1 }, { id: "a", openLoad: 1 }])).toBe("a")
    expect(pickRoundRobin([])).toBeNull()
  })

  it("describes rules in plain English", () => {
    const text = describeAutomation("ticket.created", [{ field: "priority", op: "eq", value: "urgent" }], [{ type: "assign", memberId: "m1" }], () => "Priya")
    expect(text).toBe("When ticket is created and priority is “urgent”: assign to Priya.")
  })
})

describe("scoring", () => {
  it("explains every point of a lead score", () => {
    const { score, reasons } = leadScore({
      title: "VP of Customer Experience",
      source: "referral",
      lifecycle: "qualified",
      companySize: "1000+",
      activities30d: 3,
      meetings30d: 1,
      openDealValue: 64_000,
      daysSinceActivity: 2,
    })
    expect(score).toBe(84)
    expect(reasons[0]).toBe("+20 Decision-maker title")
    expect(reasons).toContain("+12 Came from a referral")
  })

  it("penalises silence and churn, and clamps to 0–100", () => {
    const cold = leadScore({ title: "Intern", source: "import", lifecycle: "churned", activities30d: 0, meetings30d: 0, openDealValue: 0, daysSinceActivity: 90 })
    expect(cold.score).toBe(0)
    expect(cold.reasons).toContain("−20 Churned customer")
  })

  it("computes SLA state from priority targets", () => {
    const created = new Date("2026-11-07T08:00:00Z")
    const due = slaDueAt(created, "urgent")
    expect(due.toISOString()).toBe("2026-11-07T10:00:00.000Z")
    const t = { createdAt: created, dueAt: due, firstResponseAt: null, status: "open" }
    expect(slaState(t, Date.parse("2026-11-07T08:30:00Z"))).toBe("on_track")
    expect(slaState(t, Date.parse("2026-11-07T09:45:00Z"))).toBe("at_risk")
    expect(slaState(t, Date.parse("2026-11-07T11:00:00Z"))).toBe("breached")
    expect(slaState({ ...t, firstResponseAt: new Date("2026-11-07T09:00:00Z") }, Date.now())).toBe("met")
  })

  it("scores account health from support load and momentum", () => {
    expect(accountHealth({ openTickets: 0, urgentOpenTickets: 0, avgCsat: 4.8, wonDeals90d: 1, daysSinceActivity: 3 })).toBe(100)
    expect(accountHealth({ openTickets: 3, urgentOpenTickets: 2, avgCsat: 2.5, wonDeals90d: 0, daysSinceActivity: 45 })).toBe(27)
  })

  it("triages tickets by intent", () => {
    expect(triageTicket("Webhook deliveries failing, our sync is down")).toMatchObject({ priority: "urgent", team: "Engineering" })
    expect(triageTicket("Charged twice on my card").tags).toContain("billing")
    expect(triageTicket("Question: how do I export data?").priority).toBe("low")
    expect(triageTicket("Feature request: Slack alerts whenever an urgent ticket arrives").priority).toBe("low")
  })
})
