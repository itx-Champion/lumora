"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, CircleDashed, Download, Moon, RotateCcw, Sun } from "lucide-react"
import { toast } from "sonner"
import { useWorkspace } from "@/components/app/workspace-provider"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

type Status = {
  gemini: boolean
  groq: boolean
  github: boolean
  rateLimit: "upstash" | "memory"
  models: { gemini: string; groq: string }
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b py-8 last:border-0 md:grid-cols-[1fr_1.6fr]">
      <div>
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  )
}

function StatusRow({ on, label, detail }: { on: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-3 p-3.5">
      {on ? (
        <CheckCircle2 className="size-4.5 text-emerald-500" />
      ) : (
        <CircleDashed className="size-4.5 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          on ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-foreground/[0.06] text-muted-foreground"
        )}
      >
        {on ? "Connected" : "Not configured"}
      </span>
    </li>
  )
}

export default function SettingsPage() {
  const { user, workspace, store } = useWorkspace()
  const { theme, setTheme } = useTheme()
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? (r.json() as Promise<Status>) : null))
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  const exportWorkspace = () => {
    if (!workspace) return
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `lumora-workspace-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <Section title="Profile" description="You're signed in to a private demo workspace.">
        <div className="flex items-center gap-4 rounded-2xl border bg-card/60 p-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--brand-violet),var(--brand-cyan))] text-lg font-semibold text-white">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </Section>

      <Section
        title="AI models"
        description="Lumora tries each provider in order and falls back automatically. With none configured it answers extractively from your documents."
      >
        <ul className="divide-y rounded-2xl border bg-card/60">
          <StatusRow
            on={status?.gemini ?? false}
            label="Google Gemini (primary)"
            detail={status ? status.models.gemini : "Checking…"}
          />
          <StatusRow on={status?.groq ?? false} label="Groq (fallback)" detail={status ? status.models.groq : "Checking…"} />
          <StatusRow on label="Extractive demo mode (always available)" detail="BM25 retrieval + sentence extraction, no API key needed" />
          <StatusRow
            on={status?.rateLimit === "upstash"}
            label="Distributed rate limiting"
            detail={status?.rateLimit === "upstash" ? "Upstash Redis · 15 requests / minute" : "Using in-memory limiter · 15 requests / minute"}
          />
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Keys are configured as server environment variables (see <code className="font-mono">.env.example</code>) and are never
          exposed to the browser.
        </p>
      </Section>

      <Section title="Appearance" description="Choose how Lumora looks on this device.">
        <div className="grid grid-cols-2 gap-3">
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
                theme === t ? "border-violet ring-2 ring-violet/20" : "hover:bg-foreground/[0.03]"
              )}
            >
              {t === "dark" ? <Moon className="size-5" /> : <Sun className="size-5" />}
              <span className="font-medium capitalize">{t}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Workspace data" description="Everything is stored in this browser's IndexedDB.">
        <div className="grid gap-3 rounded-2xl border bg-card/60 p-4 text-sm sm:grid-cols-4">
          {[
            ["Documents", workspace?.documents.length ?? 0],
            ["Conversations", workspace?.conversations.length ?? 0],
            ["Actions", workspace?.actions.length ?? 0],
            ["Logged questions", workspace?.logs.length ?? 0],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={exportWorkspace}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium hover:bg-foreground/5"
          >
            <Download className="size-4" /> Export as JSON
          </button>
          <button
            onClick={async () => {
              if (!window.confirm("Reset the workspace? Uploaded documents, chats and actions will be deleted.")) return
              await store.reset()
              toast.success("Workspace reset to the sample data")
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <RotateCcw className="size-4" /> Reset workspace
          </button>
        </div>
      </Section>
    </div>
  )
}
