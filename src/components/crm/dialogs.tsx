"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useViewer } from "@/components/app/viewer"
import { useNow } from "@/hooks/use-now"
import { createCompany, createContact, createDeal, createTask, createTicket } from "@/lib/crm/actions/crm"
import { DEAL_STAGES, PRIORITIES, SOURCES } from "@/lib/crm/constants"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, secondaryButton, useAction } from "./client"
import { FieldLabel, inputClass, selectClass, textareaClass } from "./ui"

export type Option = { id: string; name: string }

function FormDialog({
  trigger,
  title,
  description,
  children,
  onSubmit,
  pending,
  submitLabel,
  open,
  onOpenChange,
  wide,
}: {
  trigger: ReactNode
  title: string
  description: string
  children: ReactNode
  onSubmit: (form: FormData) => void
  pending: boolean
  submitLabel: string
  open: boolean
  onOpenChange: (o: boolean) => void
  wide?: boolean
}) {
  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("gap-5 p-5", wide ? "sm:max-w-xl" : "sm:max-w-md")}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit(new FormData(e.currentTarget))
            }}
          >
            {children}
            <DialogFooter className="-mx-5 -mb-5 px-5">
              <button type="button" onClick={() => onOpenChange(false)} className={secondaryButton}>
                Cancel
              </button>
              <PendingButton type="submit" pending={pending} className={primaryButton}>
                {submitLabel}
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TriggerButton({ label, onClick, variant = "primary" }: { label: string; onClick: () => void; variant?: "primary" | "secondary" }) {
  const viewer = useViewer()
  const canWrite = viewer?.permissions.includes("crm:write")
  return (
    <button
      onClick={onClick}
      disabled={!canWrite}
      title={canWrite ? undefined : "Viewers have read-only access"}
      className={cn(variant === "primary" ? primaryButton : secondaryButton, "inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50")}
    >
      <Plus className="size-4" />
      {label}
    </button>
  )
}

const str = (f: FormData, k: string) => {
  const v = f.get(k)
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

export function NewContactDialog({ members, label = "New contact" }: { members: Option[]; label?: string }) {
  const router = useRouter()
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton label={label} onClick={() => setOpen(true)} />}
      title="New contact"
      description="Lumora scores the lead from title, company size and source, then runs your automations."
      pending={pending}
      submitLabel="Create contact"
      onSubmit={async (f) => {
        const data = await exec(
          () =>
            createContact({
              name: str(f, "name") ?? "",
              email: str(f, "email") ?? "",
              title: str(f, "title"),
              phone: str(f, "phone"),
              companyName: str(f, "company"),
              source: (str(f, "source") ?? "website") as (typeof SOURCES)[number],
              ownerId: str(f, "owner"),
            }),
          { success: "Contact created" }
        )
        if (data) {
          setOpen(false)
          router.push(`/app/crm/contacts/${data.id}`)
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Full name">
          <input name="name" required minLength={2} className={inputClass} placeholder="Maya Chen" autoFocus />
        </FieldLabel>
        <FieldLabel label="Email">
          <input name="email" type="email" required className={inputClass} placeholder="maya@company.com" />
        </FieldLabel>
        <FieldLabel label="Job title">
          <input name="title" className={inputClass} placeholder="VP of Operations" />
        </FieldLabel>
        <FieldLabel label="Company" hint="Created if it doesn't exist">
          <input name="company" className={inputClass} placeholder="Acme Robotics" />
        </FieldLabel>
        <FieldLabel label="Source">
          <select name="source" defaultValue="website" className={selectClass}>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Owner">
          <select name="owner" defaultValue={viewer?.memberId} className={selectClass}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
    </FormDialog>
  )
}

export function NewCompanyDialog({ label = "New company" }: { label?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton label={label} onClick={() => setOpen(true)} />}
      title="New company"
      description="Add an account to track its people, deals, tickets and health."
      pending={pending}
      submitLabel="Create company"
      onSubmit={async (f) => {
        const data = await exec(
          () =>
            createCompany({
              name: str(f, "name") ?? "",
              domain: str(f, "domain"),
              industry: str(f, "industry"),
              size: (str(f, "size") ?? null) as "1-10" | null,
              country: str(f, "country"),
            }),
          { success: "Company created" }
        )
        if (data) {
          setOpen(false)
          router.push(`/app/crm/companies/${data.id}`)
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Name">
          <input name="name" required minLength={2} className={inputClass} placeholder="Acme Robotics" autoFocus />
        </FieldLabel>
        <FieldLabel label="Domain">
          <input name="domain" className={inputClass} placeholder="acme.com" />
        </FieldLabel>
        <FieldLabel label="Industry">
          <input name="industry" className={inputClass} placeholder="Manufacturing" />
        </FieldLabel>
        <FieldLabel label="Employees">
          <select name="size" defaultValue="" className={selectClass}>
            <option value="">Unknown</option>
            {["1-10", "11-50", "51-200", "201-1000", "1000+"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Country">
          <input name="country" className={inputClass} placeholder="Germany" />
        </FieldLabel>
      </div>
    </FormDialog>
  )
}

export function NewDealDialog({
  members,
  companies,
  contacts,
  defaults,
  label = "New deal",
}: {
  members: Option[]
  companies: Option[]
  contacts: (Option & { companyId: string | null })[]
  defaults?: { companyId?: string; contactId?: string; stage?: string }
  label?: string
}) {
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const [companyId, setCompanyId] = useState(defaults?.companyId ?? "")
  const { pending, exec } = useAction()
  const people = contacts.filter((c) => !companyId || c.companyId === companyId)
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton label={label} onClick={() => setOpen(true)} />}
      title="New deal"
      description="Deals move across the board; win probability follows the stage."
      pending={pending}
      submitLabel="Create deal"
      wide
      onSubmit={async (f) => {
        const close = str(f, "close")
        const data = await exec(
          () =>
            createDeal({
              title: str(f, "title") ?? "",
              value: Number(str(f, "value") ?? 0),
              stage: (str(f, "stage") ?? "new") as "new",
              companyId: str(f, "company") ?? null,
              contactId: str(f, "contact") ?? null,
              ownerId: str(f, "owner"),
              expectedCloseAt: close ? new Date(close) : null,
              nextStep: str(f, "next"),
            }),
          { success: "Deal created" }
        )
        if (data) setOpen(false)
      }}
    >
      <FieldLabel label="Deal name">
        <input name="title" required minLength={3} className={inputClass} placeholder="Acme Robotics — Enterprise rollout" autoFocus />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Value (USD)">
          <input name="value" type="number" min={0} step={100} required defaultValue={12000} className={inputClass} />
        </FieldLabel>
        <FieldLabel label="Stage">
          <select name="stage" defaultValue={defaults?.stage ?? "new"} className={selectClass}>
            {DEAL_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Expected close">
          <input name="close" type="date" className={inputClass} />
        </FieldLabel>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Company">
          <select name="company" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={selectClass}>
            <option value="">None</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Contact">
          <select name="contact" defaultValue={defaults?.contactId ?? ""} className={selectClass}>
            <option value="">None</option>
            {people.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Owner">
          <select name="owner" defaultValue={viewer?.memberId} className={selectClass}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label="Next step">
        <input name="next" className={inputClass} placeholder="Send proposal by Friday" />
      </FieldLabel>
    </FormDialog>
  )
}

export function NewTaskDialog({
  members,
  related,
  label = "New task",
  variant = "primary",
}: {
  members: Option[]
  related?: { type: "contact" | "company" | "deal" | "ticket"; id: string; name: string }
  label?: string
  variant?: "primary" | "secondary"
}) {
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  const now = useNow()
  const tomorrow = now ? new Date(now + 86_400_000).toISOString().slice(0, 10) : ""
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton label={label} variant={variant} onClick={() => setOpen(true)} />}
      title="New task"
      description={related ? `Follow-up linked to ${related.name}.` : "Assign a follow-up to yourself or a teammate."}
      pending={pending}
      submitLabel="Create task"
      onSubmit={async (f) => {
        const due = str(f, "due")
        const data = await exec(
          () =>
            createTask({
              title: str(f, "title") ?? "",
              dueAt: due ? new Date(`${due}T${str(f, "time") ?? "10:00"}`) : null,
              assigneeId: str(f, "assignee"),
              priority: (str(f, "priority") ?? "normal") as "normal",
              relatedType: related?.type,
              relatedId: related?.id,
            }),
          { success: "Task created" }
        )
        if (data) setOpen(false)
      }}
    >
      <FieldLabel label="Task">
        <input name="title" required minLength={2} className={inputClass} placeholder={related ? `Follow up with ${related.name}` : "Send the renewal quote"} autoFocus />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldLabel label="Due date">
          <input name="due" type="date" defaultValue={tomorrow} className={inputClass} />
        </FieldLabel>
        <FieldLabel label="Time">
          <input name="time" type="time" defaultValue="10:00" className={inputClass} />
        </FieldLabel>
        <FieldLabel label="Priority">
          <select name="priority" defaultValue="normal" className={selectClass}>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label="Assignee">
        <select name="assignee" defaultValue={viewer?.memberId} className={selectClass}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.id === viewer?.memberId ? " (you)" : ""}
            </option>
          ))}
        </select>
      </FieldLabel>
    </FormDialog>
  )
}

export function NewTicketDialog({ label = "New ticket" }: { label?: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  return (
    <FormDialog
      open={open}
      onOpenChange={setOpen}
      trigger={<TriggerButton label={label} onClick={() => setOpen(true)} />}
      title="New ticket"
      description="Leave priority on Auto and Lumora triages it: priority, team, tags and SLA, then runs automations."
      pending={pending}
      submitLabel="Create ticket"
      wide
      onSubmit={async (f) => {
        const priority = str(f, "priority")
        const data = await exec(
          () =>
            createTicket({
              subject: str(f, "subject") ?? "",
              body: str(f, "body") ?? "",
              contactEmail: str(f, "email") ?? "",
              contactName: str(f, "name"),
              priority: priority === "auto" ? undefined : (priority as "high"),
              channel: (str(f, "channel") ?? "web") as "web",
            }),
          {
            success: (d) =>
              `Ticket #${d.number} created · ${d.priority} priority${d.automations.length ? ` · ran ${d.automations.length} automation${d.automations.length > 1 ? "s" : ""}` : ""}`,
          }
        )
        if (data) {
          setOpen(false)
          router.push(`/app/crm/inbox?t=${data.id}`)
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Customer email" hint="Matched to a contact, or a new lead is created">
          <input name="email" type="email" required className={inputClass} placeholder="customer@company.com" autoFocus />
        </FieldLabel>
        <FieldLabel label="Customer name">
          <input name="name" className={inputClass} placeholder="Optional" />
        </FieldLabel>
      </div>
      <FieldLabel label="Subject">
        <input name="subject" required minLength={4} className={inputClass} placeholder="Webhook deliveries failing since yesterday" />
      </FieldLabel>
      <FieldLabel label="Message">
        <textarea name="body" required minLength={4} rows={4} className={textareaClass} placeholder="What did the customer write?" />
      </FieldLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldLabel label="Priority">
          <select name="priority" defaultValue="auto" className={selectClass}>
            <option value="auto">Auto (AI triage)</option>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Channel">
          <select name="channel" defaultValue="email" className={selectClass}>
            {["email", "chat", "web", "api"].map((c) => (
              <option key={c} value={c}>
                {c[0].toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
    </FormDialog>
  )
}
