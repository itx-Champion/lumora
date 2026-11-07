// Fictional company content that seeds every new demo workspace.

export type SampleDoc = {
  title: string
  fileName: string
  type: "pdf" | "md" | "txt"
  content: string
}

export const sampleDocs: SampleDoc[] = [
  {
    title: "Billing & refund policy",
    fileName: "billing-policy.pdf",
    type: "pdf",
    content: `# Billing & Refund Policy

## Plans and billing cycles
Kitelane offers monthly and annual subscriptions. Monthly plans are billed on the same calendar day each month. Annual plans are billed upfront for twelve months and include a 20% discount compared to paying monthly.

## Refunds for annual plans
Annual plans are fully refundable within 30 days of the original purchase date. Refunds are issued to the original payment method and are processed within 5–7 business days. After 30 days, annual plans are not refundable for Starter and Pro customers. Enterprise customers receive a prorated refund for unused full months after 30 days, as described in their Master Services Agreement.

## Refunds for monthly plans
Monthly plans are not refundable, but customers can cancel at any time. Cancellation takes effect at the end of the current billing period, and the workspace remains fully usable until then.

## Failed payments
If a payment fails, Kitelane retries the charge automatically after 3, 5 and 7 days. Workspace owners receive an email after each failed attempt. If all retries fail, the workspace is moved to read-only mode for 14 days before being suspended.

## Invoices and taxes
Invoices are emailed to the billing contact and are available under Settings → Billing. VAT and sales tax are calculated based on the billing address. Customers can add a tax ID to their invoices at any time; changes apply to future invoices only.

## Who approves refunds
Support agents can approve refunds up to $500 directly. Refunds above $500 must be approved by the Billing team lead. All refunds must be logged as a Billing ticket with priority P2 or higher.`,
  },
  {
    title: "Employee handbook",
    fileName: "employee-handbook.pdf",
    type: "pdf",
    content: `# Kitelane Employee Handbook

## Working hours and remote work
Kitelane is a remote-first company. Core collaboration hours are 10:00 to 15:00 in your local time zone. Outside core hours, teammates are free to organize their own schedule. Team members may work from any country where Kitelane has a legal entity for up to 60 days per year without prior approval.

## Paid time off
Full-time employees receive 25 days of paid vacation per year, plus local public holidays. Vacation days accrue monthly. Up to 5 unused days can be carried over to the next year and must be used by March 31. Requests for more than 5 consecutive days should be submitted at least two weeks in advance through the HR portal.

## Sick leave
Employees receive 10 days of paid sick leave per year. A doctor's note is only required for absences longer than 3 consecutive working days. Sick leave does not carry over.

## Parental leave
Primary caregivers receive 20 weeks of fully paid parental leave. Secondary caregivers receive 8 weeks of fully paid leave. Parental leave can be taken within 12 months of the birth or adoption.

## Learning budget
Every employee has an annual learning budget of $1,500 for courses, books, conferences and certifications. Purchases under $200 do not need approval; larger expenses must be approved by your manager.

## Equipment
New hires receive a laptop of their choice (macOS or Windows) and a $600 home-office stipend. Equipment is refreshed every three years.

## Onboarding
During the first week, every new hire is paired with an onboarding buddy. By the end of the first 30 days, new hires should have shipped one small improvement and completed security training.`,
  },
  {
    title: "Security & data protection",
    fileName: "security-policy.md",
    type: "md",
    content: `# Security & Data Protection

## Data encryption
All customer data is encrypted in transit using TLS 1.2 or higher and encrypted at rest using AES-256. Encryption keys are rotated every 90 days and managed in a dedicated key management service.

## Data residency
Customer data is stored in the European Union by default. Enterprise customers can choose US or EU data residency during onboarding. Data residency cannot be changed after the workspace is created without a migration request.

## Access control
Kitelane follows the principle of least privilege. Employees only receive access to production systems required for their role, reviewed quarterly. Production access requires hardware security keys and is logged for audit purposes.

## Incident response
Security incidents are triaged within 1 hour. Customers affected by a confirmed data breach are notified within 72 hours, in line with GDPR requirements. A post-incident report is shared with affected Enterprise customers within 10 business days.

## Data retention and deletion
When a workspace is deleted, all customer data is permanently removed from production systems within 30 days and from encrypted backups within 90 days. Customers can export their data at any time from Settings → Export.

## AI and customer data
Customer content is never used to train AI models. AI features only process the documents and messages within the customer's own workspace, and model providers are contractually prohibited from retaining customer data.

## Compliance
Kitelane is SOC 2 Type II audited annually and GDPR compliant. The latest SOC 2 report is available to customers under NDA by contacting security@kitelane.example.`,
  },
  {
    title: "Product FAQ",
    fileName: "product-faq.md",
    type: "md",
    content: `# Kitelane Product FAQ

## What is Kitelane?
Kitelane is a project planning platform for distributed teams. It combines roadmaps, sprint boards and async status updates in one workspace.

## How many members can a workspace have?
The Starter plan supports up to 5 members. Pro supports up to 200 members. Enterprise has no member limit.

## Which integrations are available?
Kitelane integrates with Git hosting providers, calendar apps, chat tools and single sign-on providers. Integrations are configured under Settings → Integrations by a workspace admin. Webhooks and a REST API are available on Pro and Enterprise plans.

## Does Kitelane have an API rate limit?
Yes. The REST API allows 600 requests per minute per workspace on Pro and 3,000 requests per minute on Enterprise. Requests over the limit receive HTTP 429 with a Retry-After header.

## Can I change my plan later?
Yes. Upgrades take effect immediately and are prorated. Downgrades take effect at the end of the current billing cycle.

## Is there a mobile app?
Yes. Kitelane has native iOS and Android apps with offline support for boards and updates.

## How do I reset two-factor authentication?
Workspace admins can reset two-factor authentication for a member under Settings → Members. If the only admin is locked out, contact support with proof of account ownership; identity verification takes up to 2 business days.

## What is the uptime commitment?
Kitelane targets 99.9% monthly uptime. Enterprise customers have a contractual SLA with service credits if uptime falls below 99.9%.`,
  },
  {
    title: "Q3 business review",
    fileName: "q3-business-review.pdf",
    type: "pdf",
    content: `# Q3 Business Review

## Summary
Q3 revenue grew 18% quarter over quarter to $4.2M in annual recurring revenue (ARR). Net revenue retention reached 116%, driven by Pro-to-Enterprise upgrades. Gross margin improved to 81%.

## Customers
Kitelane ended the quarter with 1,940 paying workspaces, up from 1,710 in Q2. Enterprise accounts grew from 38 to 52. Logo churn decreased to 2.1% monthly, the lowest rate to date.

## Support
Support handled 6,800 tickets in Q3. Median first response time dropped from 4.1 hours to 2.6 hours. The top three ticket categories were billing questions (27%), integrations (21%) and two-factor authentication resets (14%). Customer satisfaction (CSAT) was 92%.

## Product
The team shipped offline mode for mobile, the new roadmap timeline and audit logs for Enterprise. Usage of async status updates grew 34%.

## Priorities for Q4
1. Reduce billing-related tickets by 30% through clearer invoices and self-serve refunds.
2. Launch the AI assistant for internal knowledge to cut support response times further.
3. Expand EU and US data residency options to the Pro plan.
4. Hire 6 engineers and 2 support specialists.

## Risks
Main risks for Q4 are slower enterprise procurement cycles at year end and increased competition in the mid-market segment.`,
  },
]

