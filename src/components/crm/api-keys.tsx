"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Plus, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createApiKey, revokeApiKey } from "@/lib/crm/actions/admin"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, RelativeTime, secondaryButton, useAction } from "./client"
import { FieldLabel, inputClass, Pill } from "./ui"

export type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdBy: string | null
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        toast.success("Copied to clipboard")
        setTimeout(() => setCopied(false), 1600)
      }}
      className="inline-flex h-7 items-center gap-1 rounded-md border bg-background/70 px-2 text-xs font-medium hover:bg-foreground/5"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  )
}

export function ApiKeys({ keys }: { keys: ApiKeyRow[] }) {
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [scopes, setScopes] = useState<("crm:read" | "crm:write")[]>(["crm:read"])
  const { pending, exec } = useAction()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Keys act with the permissions of the admin who created them, narrowed to their scopes. Only a SHA-256 hash is stored.</p>
        <button
          onClick={() => {
            setSecret(null)
            setScopes(["crm:read"])
            setOpen(true)
          }}
          className={cn(primaryButton, "inline-flex shrink-0 items-center gap-1.5")}
        >
          <Plus className="size-4" /> Create key
        </button>
      </div>

      {keys.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No API keys yet. Create one to connect Claude, Cursor, Zapier or your own scripts.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {keys.map((k) => (
            <li key={k.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", k.revokedAt && "opacity-50")}>
              <KeyRound className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.prefix}••••••••</p>
              </div>
              <div className="flex gap-1">
                {k.scopes.map((s) => (
                  <Pill key={s} className={s === "crm:write" ? "bg-amber-500/12 text-amber-600 dark:text-amber-300" : "bg-foreground/8 text-muted-foreground"}>
                    {s}
                  </Pill>
                ))}
              </div>
              <p className="w-40 text-xs text-muted-foreground">
                {k.revokedAt ? (
                  <>
                    Revoked <RelativeTime date={k.revokedAt} />
                  </>
                ) : k.lastUsedAt ? (
                  <>
                    Used <RelativeTime date={k.lastUsedAt} />
                  </>
                ) : (
                  "Never used"
                )}
                <span className="block">by {k.createdBy ?? "unknown"}</span>
              </p>
              {!k.revokedAt && (
                <button
                  onClick={() => confirm(`Revoke “${k.name}”? Apps using it stop working immediately.`) && exec(() => revokeApiKey(k.id), { success: "Key revoked" })}
                  className="h-8 rounded-lg px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 p-5 sm:max-w-lg">
          {secret ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Copy your key now</DialogTitle>
                <DialogDescription>For security we only store a hash. You won&apos;t be able to see this key again.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-xl border bg-background/70 p-3">
                <code className="min-w-0 flex-1 truncate font-mono text-sm">{secret}</code>
                <CopyButton text={secret} />
              </div>
              <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" /> Treat it like a password. Store it in a secret manager or an environment variable, never in source code.
              </p>
              <DialogFooter className="-mx-5 -mb-5 px-5">
                <button onClick={() => setOpen(false)} className={primaryButton}>
                  Done
                </button>
              </DialogFooter>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const name = String(new FormData(e.currentTarget).get("name") ?? "")
                const data = await exec(() => createApiKey({ name, scopes }), {})
                if (data) setSecret(data.key)
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Create an API key</DialogTitle>
                <DialogDescription>Use it with the REST API or to connect an AI client to the Lumora MCP server.</DialogDescription>
              </DialogHeader>
              <FieldLabel label="Name">
                <input name="name" required minLength={2} className={inputClass} placeholder="Claude Desktop" autoFocus />
              </FieldLabel>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted-foreground">Scopes</legend>
                {(
                  [
                    ["crm:read", "Read contacts, deals, tickets and reports"],
                    ["crm:write", "Create tickets, contacts and tasks; move deals"],
                  ] as const
                ).map(([scope, label]) => (
                  <label key={scope} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm hover:bg-foreground/[0.03]">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(e) => setScopes(e.target.checked ? [...scopes, scope] : scopes.filter((s) => s !== scope))}
                      className="size-4 accent-violet-500"
                    />
                    <span>
                      <span className="block font-mono text-xs">{scope}</span>
                      <span className="text-muted-foreground">{label}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <DialogFooter className="-mx-5 -mb-5 px-5">
                <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                  Cancel
                </button>
                <PendingButton type="submit" pending={pending} disabled={!scopes.length} className={primaryButton}>
                  Create key
                </PendingButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
