"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CalendarClock, Clock, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCan } from "@/components/app/viewer"
import { useNow } from "@/hooks/use-now"
import type { DealStage } from "@/db/schema"
import { deleteDeal, moveDeal, updateDeal } from "@/lib/crm/actions/crm"
import { compactMoney, DEAL_STAGES, money, stageProbability } from "@/lib/crm/constants"
import type { MemberLite, PipelineDeal } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, secondaryButton, useAction } from "./client"
import { dateFmt, FieldLabel, inputClass, MemberAvatar, selectClass } from "./ui"

const DAY = 86_400_000
type Columns = Record<DealStage, PipelineDeal[]>

function group(deals: PipelineDeal[]): Columns {
  const cols = Object.fromEntries(DEAL_STAGES.map((s) => [s.id, [] as PipelineDeal[]])) as Columns
  for (const d of [...deals].sort((a, b) => a.position - b.position)) cols[d.stage].push(d)
  return cols
}

function DealCard({ deal, owner, overlay, onOpen, now }: { deal: PipelineDeal; owner?: MemberLite; overlay?: boolean; onOpen?: () => void; now: number }) {
  const age = now ? Math.floor((now - new Date(deal.stageChangedAt).getTime()) / DAY) : 0
  const open = deal.stage !== "won" && deal.stage !== "lost"
  const stalled = open && age > 14
  return (
    <div
      onClick={onOpen}
      className={cn(
        "group cursor-grab rounded-xl border bg-background/80 p-3 text-left shadow-sm transition-[box-shadow,border-color] hover:border-violet/40 active:cursor-grabbing",
        overlay && "rotate-2 border-violet/50 shadow-2xl shadow-violet/20",
        stalled && "border-amber-500/30"
      )}
    >
      <p className="line-clamp-2 text-sm leading-snug font-medium">{deal.title.split(" — ")[1] ?? deal.title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.company ?? deal.contact ?? "No company"}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{money.format(deal.value)}</span>
        {owner && <MemberAvatar name={owner.name} hue={owner.avatarHue} size="xs" />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {stalled ? (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/12 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-300">
            <Clock className="size-3" /> {age}d stalled
          </span>
        ) : (
          open && now > 0 && <span>{age === 0 ? "Moved today" : `${age}d in stage`}</span>
        )}
        {open && deal.expectedCloseAt && (
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3" /> {dateFmt.format(new Date(deal.expectedCloseAt)).replace(/, \d{4}$/, "")}
          </span>
        )}
        {deal.stage === "lost" && deal.lostReason && <span className="truncate">{deal.lostReason}</span>}
      </div>
    </div>
  )
}

function SortableDeal({ deal, owner, onOpen, now, disabled }: { deal: PipelineDeal; owner?: MemberLite; onOpen: () => void; now: number; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { stage: deal.stage }, disabled })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-30")} {...attributes} {...listeners}>
      <DealCard deal={deal} owner={owner} onOpen={onOpen} now={now} />
    </div>
  )
}

function Column({ stage, deals, children }: { stage: (typeof DEAL_STAGES)[number]; deals: PipelineDeal[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage.id}`, data: { stage: stage.id } })
  const total = deals.reduce((n, d) => n + d.value, 0)
  const tone = stage.id === "won" ? "bg-emerald-500" : stage.id === "lost" ? "bg-foreground/30" : "bg-[linear-gradient(90deg,var(--brand-violet),var(--brand-cyan))]"
  return (
    <section className={cn("flex w-[272px] shrink-0 flex-col rounded-2xl border bg-card/40 transition-colors", isOver && "border-violet/40 bg-violet/[0.04]")}>
      <header className="space-y-2 px-3 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {stage.label}
            <span className="rounded-full bg-foreground/8 px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">{deals.length}</span>
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">{stage.probability}%</span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          <span className="font-medium text-foreground">{compactMoney.format(total)}</span>
          {stage.open && ` · ${compactMoney.format((total * stage.probability) / 100)} weighted`}
        </p>
        <div className={cn("h-0.5 rounded-full", tone)} />
      </header>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2 pt-1" data-lenis-prevent>
        {children}
      </div>
    </section>
  )
}

export function DealsBoard({ deals, members }: { deals: PipelineDeal[]; members: MemberLite[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const can = useCan()
  const now = useNow()
  const [columns, setColumns] = useState<Columns>(() => group(deals))
  const [source, setSource] = useState(deals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragFrom, setDragFrom] = useState<DealStage | null>(null)
  const [query, setQuery] = useState("")
  const [owner, setOwner] = useState("")
  const [stalledOnly, setStalledOnly] = useState(params.get("stalled") === "1")
  const [lost, setLost] = useState<{ id: string; position: number; from: DealStage } | null>(null)
  const { exec } = useAction()

  // Server data changed (after a mutation or refresh): reset local board state.
  if (source !== deals) {
    setSource(deals)
    setColumns(group(deals))
  }

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const all = Object.values(columns).flat()
  const selected = all.find((d) => d.id === params.get("deal")) ?? null
  const active = activeId ? all.find((d) => d.id === activeId) : null
  const canWrite = can("crm:write")

  const visible = (d: PipelineDeal) => {
    if (owner && d.ownerId !== owner) return false
    if (query && !`${d.title} ${d.company ?? ""} ${d.contact ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false
    if (stalledOnly) {
      const open = d.stage !== "won" && d.stage !== "lost"
      if (!open || !now || now - new Date(d.stageChangedAt).getTime() < 14 * DAY) return false
    }
    return true
  }

  const openDeal = (id: string | null) => {
    const next = new URLSearchParams(params.toString())
    if (id) next.set("deal", id)
    else next.delete("deal")
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false })
  }

  const stageOf = (id: string): DealStage | null => {
    if (id.startsWith("col:")) return id.slice(4) as DealStage
    return (Object.keys(columns) as DealStage[]).find((s) => columns[s].some((d) => d.id === id)) ?? null
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id))
    setDragFrom(stageOf(String(e.active.id)))
  }

  // Move the card between columns while dragging so the drop target previews correctly.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = stageOf(String(active.id))
    const to = stageOf(String(over.id))
    if (!from || !to || from === to) return
    setColumns((cols) => {
      const card = cols[from].find((d) => d.id === active.id)
      if (!card) return cols
      const target = cols[to].filter((d) => d.id !== active.id)
      const overIndex = target.findIndex((d) => d.id === over.id)
      const index = overIndex >= 0 ? overIndex : target.length
      target.splice(index, 0, { ...card, stage: to })
      return { ...cols, [from]: cols[from].filter((d) => d.id !== active.id), [to]: target }
    })
  }

  const persist = async (id: string, stage: DealStage, position: number, from: DealStage | null, lostReason?: string) => {
    const result = await exec(() => moveDeal(id, stage, position, lostReason), {})
    if (result === null) {
      setColumns(group(deals))
      return
    }
    if (from && from !== stage) {
      const title = all.find((d) => d.id === id)?.title ?? "Deal"
      if (stage === "won") toast.success(`🎉 ${title} won`, { description: "Contact marked as customer. Automations created the onboarding follow-up." })
      else toast.success(`Moved to ${DEAL_STAGES.find((s) => s.id === stage)?.label}`, { description: `Win probability is now ${stageProbability(stage)}%.` })
    }
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    const from = dragFrom
    setActiveId(null)
    setDragFrom(null)
    if (!over) return setColumns(group(deals))
    const stage = stageOf(id)
    if (!stage) return
    // Reorder within the column, then compute a fractional position between neighbours.
    const list = [...columns[stage]]
    const oldIndex = list.findIndex((d) => d.id === id)
    const overIndex = list.findIndex((d) => d.id === over.id)
    if (overIndex >= 0 && overIndex !== oldIndex) {
      const [card] = list.splice(oldIndex, 1)
      list.splice(overIndex, 0, card)
    }
    const index = list.findIndex((d) => d.id === id)
    const prev = list[index - 1]?.position
    const next = list[index + 1]?.position
    const position = prev !== undefined && next !== undefined ? (prev + next) / 2 : prev !== undefined ? prev + 1000 : next !== undefined ? next - 1000 : 1000
    setColumns((cols) => ({ ...cols, [stage]: list.map((d) => (d.id === id ? { ...d, stage, position } : d)) }))
    if (stage === "lost" && from !== "lost") {
      setLost({ id, position, from: from ?? "new" })
      return
    }
    if (from === stage && overIndex === oldIndex) return
    void persist(id, stage, position, from)
  }

  const openStages = DEAL_STAGES.filter((s) => s.open)
  const openValue = openStages.reduce((n, s) => n + columns[s.id].reduce((m, d) => m + d.value, 0), 0)
  const weighted = openStages.reduce((n, s) => n + columns[s.id].reduce((m, d) => m + (d.value * s.probability) / 100, 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter deals" aria-label="Filter deals" className={cn(inputClass, "pl-9")} />
        </div>
        <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={cn(selectClass, "w-44")}>
          <option value="">All owners</option>
          {members
            .filter((m) => m.role !== "viewer")
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-background/60 px-3 text-sm">
          <input type="checkbox" checked={stalledOnly} onChange={(e) => setStalledOnly(e.target.checked)} className="accent-amber-500" />
          Stalled 14+ days
        </label>
        <p className="ml-auto text-sm text-muted-foreground">
          Open <span className="font-semibold text-foreground tabular-nums">{compactMoney.format(openValue)}</span> · Forecast{" "}
          <span className="font-semibold text-foreground tabular-nums">{compactMoney.format(weighted)}</span>
        </p>
      </div>

      <DndContext id="deals-board" sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setColumns(group(deals))}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" style={{ height: "calc(100svh - 15rem)" }} data-lenis-prevent>
          {DEAL_STAGES.map((stage) => {
            const list = columns[stage.id].filter(visible)
            return (
              <Column key={stage.id} stage={stage} deals={list}>
                <SortableContext items={list.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  {list.map((d) => (
                    <SortableDeal key={d.id} deal={d} owner={d.ownerId ? memberById.get(d.ownerId) : undefined} onOpen={() => openDeal(d.id)} now={now} disabled={!canWrite} />
                  ))}
                </SortableContext>
                {list.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Drop deals here</p>}
              </Column>
            )
          })}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
          {active ? <DealCard deal={active} owner={active.ownerId ? memberById.get(active.ownerId) : undefined} overlay now={now} /> : null}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        open={Boolean(lost)}
        onCancel={() => {
          setLost(null)
          setColumns(group(deals))
        }}
        onConfirm={(reason) => {
          if (lost) void persist(lost.id, "lost", lost.position, lost.from, reason)
          setLost(null)
        }}
      />
      <DealDrawer deal={selected} members={members} onClose={() => openDeal(null)} />
    </div>
  )
}

function LostReasonDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState("Went with a competitor")
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="gap-4 p-5">
        <DialogHeader>
          <DialogTitle className="font-semibold">Why was this deal lost?</DialogTitle>
          <DialogDescription>Loss reasons feed win/loss reporting and the AI briefing.</DialogDescription>
        </DialogHeader>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={selectClass}>
          {["Went with a competitor", "No budget this year", "Project paused", "Missing feature", "No response", "Price too high"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <DialogFooter className="-mx-5 -mb-5 px-5">
          <button onClick={onCancel} className={secondaryButton}>
            Cancel
          </button>
          <button onClick={() => onConfirm(reason)} className={primaryButton}>
            Mark as lost
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DealDrawer({ deal, members, onClose }: { deal: PipelineDeal | null; members: MemberLite[]; onClose: () => void }) {
  const can = useCan()
  const { pending, exec } = useAction()
  const disabled = !can("crm:write")
  return (
    <Sheet open={Boolean(deal)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {deal && (
          <form
            key={deal.id}
            className="flex h-full flex-col"
            onSubmit={async (e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              const close = String(f.get("close") ?? "")
              const ok = await exec(
                () =>
                  updateDeal(deal.id, {
                    title: String(f.get("title")),
                    value: Number(f.get("value")),
                    ownerId: String(f.get("owner")) || null,
                    nextStep: String(f.get("next") ?? ""),
                    expectedCloseAt: close ? new Date(close) : null,
                  }),
                { success: "Deal saved" }
              )
              if (ok !== null) onClose()
            }}
          >
            <SheetHeader className="border-b p-5">
              <SheetTitle className="pr-8 text-base font-semibold">{deal.title}</SheetTitle>
              <SheetDescription>
                {DEAL_STAGES.find((s) => s.id === deal.stage)?.label} · {deal.probability}% win probability · {deal.company ?? "No company"}
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <FieldLabel label="Deal name">
                <input name="title" defaultValue={deal.title} disabled={disabled} className={inputClass} />
              </FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Value (USD)">
                  <input name="value" type="number" min={0} step={100} defaultValue={deal.value} disabled={disabled} className={inputClass} />
                </FieldLabel>
                <FieldLabel label="Expected close">
                  <input name="close" type="date" defaultValue={deal.expectedCloseAt ? new Date(deal.expectedCloseAt).toISOString().slice(0, 10) : ""} disabled={disabled} className={inputClass} />
                </FieldLabel>
              </div>
              <FieldLabel label="Owner">
                <select name="owner" defaultValue={deal.ownerId ?? ""} disabled={disabled} className={selectClass}>
                  <option value="">Unassigned</option>
                  {members
                    .filter((m) => m.status === "active" && m.role !== "viewer")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Next step">
                <input name="next" defaultValue={deal.nextStep ?? ""} disabled={disabled} className={inputClass} placeholder="What has to happen next?" />
              </FieldLabel>
              {deal.lostReason && <p className="rounded-xl bg-foreground/5 p-3 text-sm text-muted-foreground">Lost reason: {deal.lostReason}</p>}
              <div className="flex flex-wrap gap-2 text-sm">
                {deal.contactId && (
                  <a href={`/app/crm/contacts/${deal.contactId}`} className="rounded-lg border px-3 py-1.5 hover:bg-foreground/5">
                    Contact: {deal.contact}
                  </a>
                )}
                {deal.companyId && (
                  <a href={`/app/crm/companies/${deal.companyId}`} className="rounded-lg border px-3 py-1.5 hover:bg-foreground/5">
                    Company: {deal.company}
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 border-t p-4">
              {can("crm:delete") && (
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm(`Delete “${deal.title}”?`)) return
                    const ok = await exec(() => deleteDeal(deal.id), { success: "Deal deleted" })
                    if (ok !== null) onClose()
                  }}
                  className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
              <button type="button" onClick={onClose} className={cn(secondaryButton, "ml-auto")}>
                Close
              </button>
              {!disabled && (
                <PendingButton type="submit" pending={pending} className={primaryButton}>
                  Save changes
                </PendingButton>
              )}
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
