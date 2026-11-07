import type { SampleDoc } from "./sample-docs"

// Fictional company "Ferncloud" — seeds the HR & People Ops template.
export const hrDocs: SampleDoc[] = [
  {
    title: "Leave & time-off policy",
    fileName: "leave-policy.pdf",
    type: "pdf",
    content: `# Leave & Time-off Policy

## Annual leave
Full-time employees at Ferncloud receive 24 days of paid annual leave per calendar year, accrued at 2 days per month. Part-time employees receive leave pro rata to their contracted hours. Up to 6 unused days may be carried over and must be used before April 30 of the following year.

## Requesting leave
Leave requests are submitted in the HR portal. Requests of 1–3 days need 3 working days' notice; requests of 4 days or more need 3 weeks' notice. Managers must approve or decline within 2 working days.

## Sick leave
Employees receive 12 days of paid sick leave per year. A medical certificate is required for absences longer than 2 consecutive working days. Unused sick leave does not carry over.

## Bereavement leave
Employees receive up to 5 paid days for the loss of an immediate family member and 2 paid days for an extended family member.

## Public holidays
Ferncloud observes the public holidays of the country in which the employee is employed. Employees who work on a public holiday receive a replacement day off within 60 days.`,
  },
  {
    title: "Benefits overview",
    fileName: "benefits-overview.md",
    type: "md",
    content: `# Benefits Overview

## Health insurance
Ferncloud covers 100% of the health insurance premium for employees and 75% for dependants. Coverage starts on the first day of employment. Dental and vision are included in the standard plan.

## Retirement
Ferncloud matches retirement contributions up to 5% of base salary. Matching contributions vest immediately.

## Wellbeing allowance
Each employee receives a wellbeing allowance of $75 per month, which can be used for gym memberships, therapy, meditation apps or fitness classes. Unused allowance does not roll over.

## Home office
New employees receive a one-time $800 home-office budget and a $40 monthly internet stipend.

## Parental leave
Birthing parents receive 22 weeks of fully paid leave. Non-birthing parents receive 10 weeks of fully paid leave, which can be split into two blocks within the first year.

## Learning
Employees have an annual learning budget of $1,200 and 3 paid learning days per year for courses, conferences or certifications.`,
  },
  {
    title: "Code of conduct",
    fileName: "code-of-conduct.pdf",
    type: "pdf",
    content: `# Code of Conduct

## Respectful workplace
Ferncloud does not tolerate harassment, discrimination or bullying of any kind, whether in person, in writing or online. This applies to employees, contractors and anyone representing Ferncloud.

## Reporting concerns
Concerns can be raised with a manager, the People team or anonymously through the Speak Up hotline. Reports are acknowledged within 2 working days and investigated confidentially. Retaliation against anyone who raises a concern in good faith is a disciplinary offence.

## Conflicts of interest
Employees must disclose any outside business interest, side project or relationship that could influence their work decisions. Disclosures are made to the People team and reviewed within 10 working days.

## Gifts and hospitality
Employees may accept gifts worth up to $50. Gifts above $50 must be declared to the People team. Cash or cash-equivalent gifts must always be declined.

## Use of company equipment
Company laptops and accounts are for business use. Reasonable personal use is allowed as long as it does not interfere with work or breach security policies.`,
  },
  {
    title: "Remote work & travel policy",
    fileName: "remote-work-policy.md",
    type: "md",
    content: `# Remote Work & Travel Policy

## Working remotely
Ferncloud is remote-first. Employees can work from anywhere in their country of employment. Working from another country requires approval from the People team and is limited to 30 days per year for tax and legal reasons.

## Core hours
Teams agree on at least 3 hours of overlapping core hours per day for meetings and collaboration. Outside core hours, employees manage their own schedules.

## Team offsites
Each team meets in person twice a year. Ferncloud covers travel, accommodation and meals for offsites.

## Business travel
Flights under 6 hours are booked in economy; flights of 6 hours or more may be booked in premium economy. Hotel costs are reimbursed up to $180 per night, or $250 in high-cost cities. Expenses must be submitted within 30 days with receipts.

## Equipment and security
Remote employees must use a company-managed laptop, keep the operating system up to date and connect through the company VPN when accessing internal systems from public networks.`,
  },
]
