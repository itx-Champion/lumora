"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

/**
 * Each browser gets its own sandbox organization, even when visitors keep the default
 * name and email, so one visitor's admin changes never show up for another.
 */
function sandboxId() {
  const key = "lumora-sandbox-id"
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter()
  const [name, setName] = useState("Alex Morgan")
  const [email, setEmail] = useState("alex@example.com")
  const [pending, setPending] = useState<"demo" | "github" | null>(null)

  async function enterDemo(e: React.FormEvent) {
    e.preventDefault()
    setPending("demo")
    const res = await signIn("demo", { name, email, sandbox: sandboxId(), redirect: false })
    if (res?.error) {
      toast.error("Please enter a valid name and email.")
      setPending(null)
      return
    }
    router.push("/app")
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-semibold tracking-tight">Open your workspace</h1>
      <p className="mt-2 text-muted-foreground">
        Jump into a private demo workspace pre-loaded with sample company documents.
      </p>

      <form onSubmit={enterDemo} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            autoComplete="name"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="h-11"
          />
        </div>
        <button
          type="submit"
          disabled={pending !== null}
          className="group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(110deg,var(--brand-violet),color-mix(in_oklch,var(--brand-violet),var(--brand-cyan)_55%))] font-medium text-white shadow-[0_8px_30px_-8px_var(--brand-glow)] transition-transform hover:-translate-y-0.5 disabled:opacity-70"
        >
          {pending === "demo" ? <Loader2 className="size-4 animate-spin" /> : null}
          Enter demo workspace
          {pending !== "demo" && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>

      {githubEnabled && (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setPending("github")
              void signIn("github", { redirectTo: "/app" })
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border bg-background font-medium transition-colors hover:bg-foreground/5 disabled:opacity-70"
          >
            {pending === "github" ? <Loader2 className="size-4 animate-spin" /> : <GitHubIcon />}
            Continue with GitHub
          </button>
        </>
      )}

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        You get a private sandbox: documents stay in this browser, and the CRM is a separate
        organization with its own sample team and data. Nothing is shared with other visitors.
      </p>
    </div>
  )
}
