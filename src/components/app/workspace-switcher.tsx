"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, FilePlus2, Headset, Plus, Scale, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { templateList, type TemplateId } from "@/lib/demo/templates"
import { cn } from "@/lib/utils"
import { useWorkspace } from "./workspace-provider"

export const templateIcons: Record<TemplateId, typeof Headset> = {
  support: Headset,
  hr: Users,
  legal: Scale,
  blank: FilePlus2,
}

function WorkspaceBadge({ template, className }: { template: TemplateId; className?: string }) {
  const Icon = templateIcons[template]
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-white",
        className
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}

export function NewWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter()
  const { createWorkspace } = useWorkspace()
  const [selected, setSelected] = useState<TemplateId>("hr")
  const [name, setName] = useState("")

  const create = () => {
    const template = templateList.find((t) => t.id === selected)!
    createWorkspace(selected, name.trim() || template.name)
    onOpenChange(false)
    setName("")
    router.push("/app")
    toast.success(`${name.trim() || template.name} is ready`, {
      description: template.docs.length ? `${template.docs.length} sample documents indexed.` : "Upload documents to get started.",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogTitle>Create a workspace</DialogTitle>
        <DialogDescription>Start from a template with sample documents, or begin with a blank workspace.</DialogDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          {templateList.map((t) => {
            const Icon = templateIcons[t.id]
            const active = selected === t.id
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={cn(
                  "flex gap-3 rounded-2xl border p-4 text-left transition-all",
                  active ? "border-violet bg-violet/5 ring-2 ring-violet/20" : "hover:bg-foreground/[0.03]"
                )}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet/10 text-violet">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {t.name}
                    {active && <Check className="size-4 text-violet" />}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.tagline}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t.docs.length ? `${t.docs.length} sample docs · ${t.company} (fictional)` : "No documents"}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">Workspace name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={templateList.find((t) => t.id === selected)?.name}
            maxLength={40}
            className="h-10 w-full rounded-xl border bg-background px-3 outline-none focus:border-violet/50"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={() => onOpenChange(false)} className="rounded-xl border px-4 py-2 text-sm hover:bg-foreground/5">
            Cancel
          </button>
          <button
            onClick={create}
            className="rounded-xl bg-[linear-gradient(110deg,var(--brand-violet),var(--brand-cyan))] px-4 py-2 text-sm font-medium text-white"
          >
            Create workspace
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const { workspaces, activeWorkspace, switchWorkspace, removeWorkspace, workspace } = useWorkspace()
  const [creating, setCreating] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex w-full items-center gap-3 rounded-xl border bg-background/50 p-2 text-left transition-colors hover:bg-foreground/[0.04]" />
          }
        >
          <WorkspaceBadge template={activeWorkspace.template} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{activeWorkspace.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {workspace ? `${workspace.documents.length} documents` : "Loading…"}
            </p>
          </div>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => {
                  switchWorkspace(w.id)
                  onNavigate?.()
                  router.push("/app")
                }}
                className="gap-2"
              >
                <WorkspaceBadge template={w.template} className="size-6 rounded-md [&_svg]:size-3" />
                <span className="truncate">{w.name}</span>
                {w.id === activeWorkspace.id && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreating(true)} className="gap-2">
            <Plus className="size-4" /> New workspace
          </DropdownMenuItem>
          {workspaces.length > 1 && (
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={async () => {
                if (!window.confirm(`Delete "${activeWorkspace.name}" and all of its documents and chats?`)) return
                const name = activeWorkspace.name
                await removeWorkspace(activeWorkspace.id)
                toast(`${name} deleted`)
              }}
            >
              <Trash2 className="size-4" /> Delete this workspace
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <NewWorkspaceDialog open={creating} onOpenChange={setCreating} />
    </>
  )
}

