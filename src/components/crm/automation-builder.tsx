"use client"

import { useState } from "react"
import { motion } from "motion/react"
import { ArrowDown, Pencil, Plus, Trash2, X, Zap } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { Automation, AutomationAction, AutomationCondition, AutomationTrigger } from "@/db/schema"
import { deleteAutomation, saveAutomation, toggleAutomation } from "@/lib/crm/actions/admin"
import { ACTION_LABELS, describeAutomation, OPERATOR_LABELS, TRIGGERS } from "@/lib/crm/automation-engine"
import { PRIORITIES, TEAMS } from "@/lib/crm/constants"
import type { MemberLite } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, RelativeTime, secondaryButton, useAction } from "./client"
import { FieldLabel, inputClass, selectClass } from "./ui"

type Draft = { name: string; trigger: AutomationTrigger; conditions: AutomationCondition[]; actions: AutomationAction[] }

function defaultAction(type: AutomationAction["type"], members: MemberLite[]): AutomationAction {
  const first = members.find((m) => m.status === "active" && m.role !== "viewer")?.id ?? ""
  switch (type) {
    case "assign":
      return { type, memberId: first }
    case "round_robin":
      return { type, team: "Support" }
    case "set_priority":
      return { type, priority: "high" }
    case "add_tag":
      return { type, tag: "" }
    case "create_task":
      return { type, title: "", dueInDays: 1 }
    case "notify":
      return { type, memberId: first, message: "" }
    case "set_lifecycle":
      return { type, lifecycle: "qualified" }
  }
}

function Builder({ draft, setDraft, members }: { draft: Draft; setDraft: (d: Draft) => void; members: MemberLite[] }) {
  const trigger = TRIGGERS[draft.trigger]
  const active = members.filter((m) => m.status === "active" && m.role !== "viewer")
  const setCondition = (i: number, patch: Partial<AutomationCondition>) => setDraft({ ...draft, conditions: draft.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const setAction = (i: number, next: AutomationAction) => setDraft({ ...draft, actions: draft.actions.map((a, j) => (j === i ? next : a)) })
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "someone"

  return (
    <div className="space-y-4">
      <FieldLabel label="Name">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="Escalate VIP tickets" />
      </FieldLabel>

      <div className="rounded-xl border bg-background/50 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet uppercase">
          <Zap className="size-3.5" /> When
        </p>
        <select
          aria-label="Trigger"
          value={draft.trigger}
          onChange={(e) => {
            const t = e.target.value as AutomationTrigger
            setDraft({ ...draft, trigger: t, conditions: [], actions: [defaultAction(TRIGGERS[t].actions[0], members)] })
          }}
          className={selectClass}
        >
          {(Object.keys(TRIGGERS) as AutomationTrigger[]).map((t) => (
            <option key={t} value={t}>
              {TRIGGERS[t].label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted-foreground">{trigger.description}</p>
      </div>

      <ArrowDown className="mx-auto size-4 text-muted-foreground" />

      <div className="rounded-xl border bg-background/50 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-cyan uppercase">If (all must match)</p>
        <div className="space-y-2">
          {draft.conditions.length === 0 && <p className="text-xs text-muted-foreground">No conditions: runs every time.</p>}
          {draft.conditions.map((c, i) => {
            const field = trigger.fields.find((f) => f.id === c.field) ?? trigger.fields[0]
            const ops: AutomationCondition["op"][] = field.type === "number" ? ["gte", "lte", "eq"] : field.type === "text" ? ["contains", "eq", "neq"] : ["eq", "neq"]
            return (
              <div key={i} className="flex gap-2">
                <select aria-label="Field" value={c.field} onChange={(e) => setCondition(i, { field: e.target.value, value: "", op: "eq" })} className={cn(selectClass, "h-8")}>
                  {trigger.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <select aria-label="Operator" value={c.op} onChange={(e) => setCondition(i, { op: e.target.value as AutomationCondition["op"] })} className={cn(selectClass, "h-8 w-36")}>
                  {ops.map((o) => (
                    <option key={o} value={o}>
                      {OPERATOR_LABELS[o]}
                    </option>
                  ))}
                </select>
                {field.type === "enum" ? (
                  <select aria-label="Value" value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} className={cn(selectClass, "h-8")}>
                    <option value="">Choose…</option>
                    {field.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input aria-label="Value" value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} type={field.type === "number" ? "number" : "text"} className={cn(inputClass, "h-8")} />
                )}
                <button
                  type="button"
                  aria-label="Remove condition"
                  onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5"
                >
                  <X className="size-4" />
                </button>
              </div>
            )
          })}
          {draft.conditions.length < 5 && (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, { field: trigger.fields[0].id, op: "eq", value: "" }] })}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" /> Add condition
            </button>
          )}
        </div>
      </div>

      <ArrowDown className="mx-auto size-4 text-muted-foreground" />

      <div className="rounded-xl border bg-background/50 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wide text-emerald-500 uppercase">Then</p>
        <div className="space-y-2">
          {draft.actions.map((a, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <select aria-label="Action" value={a.type} onChange={(e) => setAction(i, defaultAction(e.target.value as AutomationAction["type"], members))} className={cn(selectClass, "h-8 w-52")}>
                {trigger.actions.map((t) => (
                  <option key={t} value={t}>
                    {ACTION_LABELS[t]}
                  </option>
                ))}
              </select>
              {(a.type === "assign" || a.type === "notify") && (
                <select aria-label="Member" value={a.memberId} onChange={(e) => setAction(i, { ...a, memberId: e.target.value })} className={cn(selectClass, "h-8 w-44")}>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              )}
              {a.type === "notify" && <input aria-label="Message" value={a.message} onChange={(e) => setAction(i, { ...a, message: e.target.value })} placeholder="Message" className={cn(inputClass, "h-8 min-w-40 flex-1")} />}
              {a.type === "round_robin" && (
                <select aria-label="Team" value={a.team} onChange={(e) => setAction(i, { ...a, team: e.target.value })} className={cn(selectClass, "h-8 w-40")}>
                  {TEAMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
              {a.type === "set_priority" && (
                <select aria-label="Priority" value={a.priority} onChange={(e) => setAction(i, { ...a, priority: e.target.value as "high" })} className={cn(selectClass, "h-8 w-36")}>
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              )}
              {a.type === "add_tag" && <input aria-label="Tag" value={a.tag} onChange={(e) => setAction(i, { ...a, tag: e.target.value })} placeholder="vip" className={cn(inputClass, "h-8 w-40")} />}
              {a.type === "set_lifecycle" && (
                <select aria-label="Lifecycle" value={a.lifecycle} onChange={(e) => setAction(i, { ...a, lifecycle: e.target.value as "lead" })} className={cn(selectClass, "h-8 w-36")}>
                  {["lead", "qualified", "customer", "churned"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              )}
              {a.type === "create_task" && (
                <>
                  <input aria-label="Task title" value={a.title} onChange={(e) => setAction(i, { ...a, title: e.target.value })} placeholder="Task title" className={cn(inputClass, "h-8 min-w-40 flex-1")} />
                  <input aria-label="Due in days" type="number" min={0} max={60} value={a.dueInDays} onChange={(e) => setAction(i, { ...a, dueInDays: Number(e.target.value) })} className={cn(inputClass, "h-8 w-20")} />
                </>
              )}
              {draft.actions.length > 1 && (
                <button
                  type="button"
                  aria-label="Remove action"
                  onClick={() => setDraft({ ...draft, actions: draft.actions.filter((_, j) => j !== i) })}
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
          {draft.actions.length < 5 && (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, actions: [...draft.actions, defaultAction(trigger.actions[0], members)] })}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" /> Add action
            </button>
          )}
        </div>
      </div>

      <p className="rounded-xl bg-violet/[0.07] p-3 text-sm">{describeAutomation(draft.trigger, draft.conditions, draft.actions, memberName)}</p>
    </div>
  )
}

function BuilderDialog({ automation, members, trigger }: { automation?: Automation; members: MemberLite[]; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  const initial = (): Draft =>
    automation
      ? { name: automation.name, trigger: automation.trigger, conditions: automation.conditions, actions: automation.actions }
      : { name: "", trigger: "ticket.created", conditions: [{ field: "priority", op: "eq", value: "urgent" }], actions: [defaultAction("assign", members)] }
  const [draft, setDraft] = useState<Draft>(initial)
  return (
    <>
      <span
        onClick={() => {
          setDraft(initial())
          setOpen(true)
        }}
      >
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] gap-4 overflow-y-auto p-5 sm:max-w-2xl" data-lenis-prevent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{automation ? "Edit automation" : "New automation"}</DialogTitle>
            <DialogDescription>Rules run on the server for every entry point: the UI, the REST API, the MCP server and the AI agent.</DialogDescription>
          </DialogHeader>
          <Builder draft={draft} setDraft={setDraft} members={members} />
          <DialogFooter className="-mx-5 -mb-5 px-5">
            <button onClick={() => setOpen(false)} className={secondaryButton}>
              Cancel
            </button>
            <PendingButton
              pending={pending}
              className={primaryButton}
              onClick={async () => {
                const data = await exec(() => saveAutomation(automation?.id ?? null, draft), { success: automation ? "Automation saved" : "Automation created" })
                if (data) setOpen(false)
              }}
            >
              {automation ? "Save changes" : "Create automation"}
            </PendingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function NewAutomationButton({ members }: { members: MemberLite[] }) {
  return (
    <BuilderDialog
      members={members}
      trigger={
        <button className={cn(primaryButton, "inline-flex items-center gap-1.5")}>
          <Plus className="size-4" /> New automation
        </button>
      }
    />
  )
}

export function AutomationCard({ automation, members }: { automation: Automation; members: MemberLite[] }) {
  const { pending, exec } = useAction()
  const [enabled, setEnabled] = useState(automation.enabled)
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "a removed member"
  return (
    <motion.li layout className={cn("rounded-2xl border bg-card/60 p-4 shadow-sm transition-opacity", !enabled && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", enabled ? "bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white" : "bg-foreground/8 text-muted-foreground")}>
          <Zap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{automation.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{describeAutomation(automation.trigger, automation.conditions, automation.actions, memberName)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ran <span className="font-medium text-foreground tabular-nums">{automation.runCount}</span> times
            {automation.lastRunAt && (
              <>
                {" · last "}
                <RelativeTime date={automation.lastRunAt} />
              </>
            )}
            {automation.createdById && ` · by ${memberName(automation.createdById)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={enabled}
            disabled={pending}
            aria-label={enabled ? "Pause automation" : "Turn on automation"}
            onCheckedChange={async (on) => {
              setEnabled(on)
              const ok = await exec(() => toggleAutomation(automation.id, on), { success: on ? "Automation on" : "Automation paused" })
              if (ok === null) setEnabled(!on)
            }}
          />
          <BuilderDialog
            automation={automation}
            members={members}
            trigger={
              <button aria-label="Edit automation" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                <Pencil className="size-4" />
              </button>
            }
          />
          <button
            aria-label="Delete automation"
            onClick={() => confirm(`Delete “${automation.name}”?`) && exec(() => deleteAutomation(automation.id), { success: "Automation deleted" })}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </motion.li>
  )
}
