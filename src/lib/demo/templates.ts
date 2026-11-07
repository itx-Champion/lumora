import { hrDocs } from "./hr-docs"
import { legalDocs } from "./legal-docs"
import { sampleDocs, type SampleDoc } from "./sample-docs"

export type TemplateId = "support" | "hr" | "legal" | "blank"

export type WorkspaceTemplate = {
  id: TemplateId
  name: string
  company: string
  tagline: string
  docs: SampleDoc[]
  /** Shown as starter prompts in an empty chat. */
  suggested: string[]
  /** Questions the seeded analytics history is built from. */
  history: string[]
  /** Questions the docs can't answer — they surface as knowledge gaps. */
  gaps: string[]
}

export const templates: Record<TemplateId, WorkspaceTemplate> = {
  support: {
    id: "support",
    name: "Customer Support",
    company: "Kitelane",
    tagline: "Billing, product and security answers for a SaaS support team",
    docs: sampleDocs,
    suggested: [
      "Can a customer get a refund on an annual plan after 3 weeks?",
      "Who approves refunds over $500?",
      "Where is customer data stored?",
      "What were the top support ticket categories in Q3?",
      "Open a ticket for billing to refund an annual plan",
      "Schedule a meeting with the support team about Q4 priorities",
    ],
    history: [
      "How long do refunds take?",
      "Can we refund an annual plan after 2 months?",
      "What's the API rate limit on Pro?",
      "Where is EU customer data stored?",
      "Who approves refunds over $500?",
      "How do I reset 2FA for a member?",
      "What was ARR at the end of Q3?",
      "Do we have a mobile app?",
      "What happens after a failed payment?",
      "Is customer data used to train AI?",
      "What's our uptime SLA?",
    ],
    gaps: ["Do we support SAML for Starter plans?", "What's the office address in Berlin?"],
  },
  hr: {
    id: "hr",
    name: "HR & People Ops",
    company: "Ferncloud",
    tagline: "Leave, benefits, conduct and remote-work policies for employees",
    docs: hrDocs,
    suggested: [
      "How many days of annual leave do I get?",
      "How much notice do I need for a 5-day vacation?",
      "What does the wellbeing allowance cover?",
      "Can I work from another country for a month?",
      "Draft an email to my manager requesting 5 days of leave next month",
      "Open a ticket for People to report a conflict of interest",
    ],
    history: [
      "How many leave days carry over?",
      "Do I need a doctor's note for sick leave?",
      "What is the parental leave for non-birthing parents?",
      "What is the hotel limit for business travel?",
      "Can I accept a gift from a vendor?",
      "When does health insurance start?",
      "How much is the home office budget?",
      "What is the learning budget?",
      "How do I report harassment anonymously?",
    ],
    gaps: ["When is the next salary review?", "What is the dress code for client meetings?"],
  },
  legal: {
    id: "legal",
    name: "Legal & Compliance",
    company: "Arcwell",
    tagline: "Contract terms, data protection and review playbooks for legal teams",
    docs: legalDocs,
    suggested: [
      "When does the MSA auto-renew and how do we cancel?",
      "How quickly must we notify customers of a data breach?",
      "Can sales offer a 3x liability cap?",
      "Who can sign a $150,000 contract?",
      "Open a ticket for Legal to review a contract with uncapped indemnity",
      "Draft an email to a customer explaining our sub-processor notice period",
    ],
    history: [
      "What is the limitation of liability in the MSA?",
      "What service credit applies below 99% uptime?",
      "How long does an NDA last?",
      "What is the turnaround for contracts on customer paper?",
      "Which law governs the MSA?",
      "Can customers audit our data processing?",
      "What payment terms can sales agree to?",
      "When does Legal need to review a contract?",
    ],
    gaps: ["Do we have a template for a reseller agreement?", "What is our position on AI indemnities?"],
  },
  blank: {
    id: "blank",
    name: "Blank workspace",
    company: "Your company",
    tagline: "Start empty and upload your own documents or websites",
    docs: [],
    suggested: [
      "Summarize the documents in this workspace",
      "What are the key policies I should know about?",
      "Open a ticket for Support to follow up on a customer issue",
    ],
    history: [],
    gaps: [],
  },
}

export const templateList = Object.values(templates)
