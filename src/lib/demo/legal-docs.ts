import type { SampleDoc } from "./sample-docs"

// Fictional company "Arcwell" — seeds the Legal & Compliance template.
export const legalDocs: SampleDoc[] = [
  {
    title: "Master services agreement",
    fileName: "master-services-agreement.pdf",
    type: "pdf",
    content: `# Master Services Agreement

## Term and renewal
This Agreement starts on the Effective Date and continues for an initial term of 12 months. It renews automatically for successive 12-month terms unless either party gives written notice of non-renewal at least 60 days before the end of the current term.

## Fees and payment
Fees are invoiced annually in advance. Invoices are due within 30 days of the invoice date. Late payments accrue interest of 1% per month. Arcwell may suspend the services if an undisputed invoice is more than 45 days overdue, after giving 10 days' written notice.

## Termination
Either party may terminate this Agreement for material breach if the breach is not cured within 30 days of written notice. On termination, the customer may export its data for 30 days, after which Arcwell deletes it.

## Limitation of liability
Each party's total liability under this Agreement is limited to the fees paid in the 12 months before the claim. Neither party is liable for indirect, consequential or lost-profit damages. These limits do not apply to breaches of confidentiality or the customer's payment obligations.

## Service levels
Arcwell commits to 99.9% monthly uptime. If uptime falls below 99.9%, the customer receives a service credit of 10% of the monthly fee; below 99.0%, the credit is 25%.

## Governing law
This Agreement is governed by the laws of the State of Delaware, and disputes are resolved in its courts.`,
  },
  {
    title: "Data processing addendum",
    fileName: "data-processing-addendum.pdf",
    type: "pdf",
    content: `# Data Processing Addendum

## Roles
The customer is the controller of personal data processed through the services, and Arcwell acts as processor. Arcwell processes personal data only on the customer's documented instructions.

## Sub-processors
Arcwell maintains a public list of sub-processors. Customers are notified at least 30 days before a new sub-processor is added and may object on reasonable data-protection grounds.

## Security measures
Arcwell encrypts personal data in transit and at rest, enforces role-based access control and performs annual third-party penetration tests.

## Breach notification
Arcwell notifies the customer of a personal data breach without undue delay and in any case within 48 hours of becoming aware of it.

## International transfers
Transfers of personal data outside the European Economic Area rely on the Standard Contractual Clauses.

## Audits
Customers may audit Arcwell's compliance once per year with 30 days' notice, or rely on Arcwell's latest SOC 2 Type II report.`,
  },
  {
    title: "Mutual NDA template",
    fileName: "mutual-nda-template.md",
    type: "md",
    content: `# Mutual Non-Disclosure Agreement (Template)

## Confidential information
Confidential information means any non-public business, technical or financial information disclosed by one party to the other, whether in writing, orally or visually, that is marked as confidential or would reasonably be understood to be confidential.

## Obligations
The receiving party must use confidential information only to evaluate or carry out the business relationship and must protect it with at least the same care it uses for its own confidential information, and no less than reasonable care.

## Exclusions
Obligations do not apply to information that is publicly available, already known to the receiving party, independently developed, or lawfully received from a third party without restriction.

## Duration
This NDA lasts for 2 years from the effective date. Confidentiality obligations survive for 3 years after it ends; trade secrets are protected for as long as they remain trade secrets.

## Approval
NDAs on this template can be signed by any director. Changes to the duration, governing law or exclusions require approval from the Legal team.`,
  },
  {
    title: "Contract review playbook",
    fileName: "contract-review-playbook.md",
    type: "md",
    content: `# Contract Review Playbook

## When Legal must review
Legal must review any contract with a total value above $50,000, any change to the standard limitation of liability, any uncapped indemnity, and any agreement that involves transferring personal data outside the EEA.

## Turnaround times
Standard NDAs are reviewed within 1 working day. Customer contracts on Arcwell paper are reviewed within 3 working days. Contracts on customer paper are reviewed within 5 working days.

## Fallback positions
If a customer asks for a higher liability cap, sales may offer up to 2x the annual fees without Legal approval. Anything above 2x requires approval from the General Counsel.

## Payment terms
Standard payment terms are 30 days. Sales may agree to 45 days for Enterprise customers. Terms longer than 45 days require Finance approval.

## Signature authority
Contracts up to $100,000 may be signed by a VP. Contracts above $100,000 must be signed by the CEO or CFO.`,
  },
]
