"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, MailCheck, MoreHorizontal, Plus, Trash2, UserCheck, UserRound, UserX } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useViewer } from "@/components/app/viewer"
import type { MemberRole } from "@/db/schema"
import { acceptInvite, inviteMember, removeMember, startViewAs, updateMember } from "@/lib/crm/actions/admin"
import { compactMoney, TEAMS } from "@/lib/crm/constants"
import { canImpersonate, memberChangeError, roleInfo, ROLES } from "@/lib/crm/permissions"
import type { TeamMember } from "@/lib/crm/queries"
import { cn } from "@/lib/utils"
import { PendingButton, primaryButton, RelativeTime, secondaryButton, useAction } from "./client"
import { FieldLabel, inputClass, MemberAvatar, Pill, RoleBadge, selectClass } from "./ui"

export function TeamTable({ members, seats }: { members: TeamMember[]; seats: number }) {
  const router = useRouter()
  const viewer = useViewer()
  const { pending, exec } = useAction()
  const me = { id: viewer?.memberId ?? "", role: viewer?.role ?? ("viewer" as MemberRole) }
  const owners = members.filter((m) => m.role === "owner" && m.status === "active").length
  const used = members.filter((m) => m.status !== "suspended").length

  const viewAs = async (m: TeamMember) => {
    const data = await exec(() => startViewAs(m.id), {})
    if (data) {
      toast.success(`Now viewing as ${data.name}`, { description: "Their role and permissions apply until you stop." })
      router.push("/app/crm")
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card/60 p-4 shadow-sm">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium">
            Seats: <span className="tabular-nums">{used}</span> of <span className="tabular-nums">{seats}</span> used
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/8">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-violet),var(--brand-cyan))]" style={{ width: `${Math.min(100, (used / seats) * 100)}%` }} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {members.filter((m) => m.status === "active").length} active · {members.filter((m) => m.status === "invited").length} invited ·{" "}
          {members.filter((m) => m.status === "suspended").length} suspended
        </p>
        <InviteDialog disabled={used >= seats} />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card/60 shadow-sm">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-3 pl-4 font-medium">Member</th>
              <th className="py-3 font-medium">Team</th>
              <th className="py-3 font-medium">Role</th>
              <th className="py-3 font-medium">Status</th>
              <th className="py-3 text-right font-medium">Open tickets</th>
              <th className="py-3 text-right font-medium">Pipeline</th>
              <th className="py-3 pl-6 font-medium">Last active</th>
              <th className="w-12 py-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const self = m.id === me.id
              const roleLocked = (r: MemberRole) => Boolean(memberChangeError(me, m, { role: r }, owners))
              const manageable = !memberChangeError(me, m, { status: "suspended" }, owners)
              return (
                <tr key={m.id} className={cn("border-b last:border-0", m.status === "suspended" && "opacity-55")}>
                  <td className="py-3 pl-4">
                    <Link href={`/app/admin/team/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                      <MemberAvatar name={m.name} hue={m.avatarHue} />
                      <span className="min-w-0">
                        <span className="block font-medium">
                          {m.name}
                          {self && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
                        </span>
                        <span className="block text-xs text-muted-foreground">{m.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3">
                    <span className="block">{m.team}</span>
                    <span className="block text-xs text-muted-foreground">{m.title}</span>
                  </td>
                  <td className="py-3">
                    {ROLES.every(roleLocked) || (self && m.role === "owner" && owners <= 1) ? (
                      <RoleBadge role={m.role} />
                    ) : (
                      <select
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        disabled={pending}
                        onChange={(e) =>
                          exec(() => updateMember(m.id, { role: e.target.value as MemberRole }), { success: `${m.name} is now ${roleInfo[e.target.value as MemberRole].label}` })
                        }
                        className={cn(selectClass, "h-8 w-32")}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r} disabled={r !== m.role && roleLocked(r)}>
                            {roleInfo[r].label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-3">
                    {m.status === "active" ? (
                      <Pill className="bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
                        <span className="size-1.5 rounded-full bg-current" /> Active
                      </Pill>
                    ) : m.status === "invited" ? (
                      <Pill className="bg-sky-500/12 text-sky-600 dark:text-sky-300">Invited</Pill>
                    ) : (
                      <Pill className="bg-red-500/12 text-red-600 dark:text-red-300">Suspended</Pill>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums">{m.openTickets || "—"}</td>
                  <td className="py-3 text-right tabular-nums">{m.pipeline ? compactMoney.format(m.pipeline) : "—"}</td>
                  <td className="py-3 pl-6 text-xs text-muted-foreground">{m.status === "invited" ? "Pending invite" : <RelativeTime date={m.lastActiveAt} />}</td>
                  <td className="py-3 pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Actions for ${m.name}`} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => router.push(`/app/admin/team/${m.id}`)}>
                          <UserRound /> View profile
                        </DropdownMenuItem>
                        {viewer && canImpersonate({ id: me.id, role: me.role }, m) && !viewer.impersonating && (
                          <DropdownMenuItem onClick={() => viewAs(m)}>
                            <Eye /> View app as {m.name.split(" ")[0]}
                          </DropdownMenuItem>
                        )}
                        {m.status === "invited" && (
                          <DropdownMenuItem onClick={() => exec(() => acceptInvite(m.id), { success: `${m.name} joined the team` })}>
                            <MailCheck /> Mark invite accepted
                          </DropdownMenuItem>
                        )}
                        {!self && manageable && m.status === "active" && (
                          <DropdownMenuItem onClick={() => exec(() => updateMember(m.id, { status: "suspended" }), { success: `${m.name} suspended. Their open tickets went back to the queue.` })}>
                            <UserX /> Suspend access
                          </DropdownMenuItem>
                        )}
                        {!self && manageable && m.status === "suspended" && (
                          <DropdownMenuItem onClick={() => exec(() => updateMember(m.id, { status: "active" }), { success: `${m.name} reactivated` })}>
                            <UserCheck /> Reactivate
                          </DropdownMenuItem>
                        )}
                        {!self && manageable && !m.userId && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                if (confirm(m.status === "invited" ? `Revoke the invite for ${m.name}?` : `Remove ${m.name} from the organization?`)) {
                                  void exec(() => removeMember(m.id), { success: m.status === "invited" ? "Invite revoked" : `${m.name} removed` })
                                }
                              }}
                            >
                              <Trash2 /> {m.status === "invited" ? "Revoke invite" : "Remove member"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InviteDialog({ disabled }: { disabled: boolean }) {
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const { pending, exec } = useAction()
  const grantable = ROLES.filter((r) => !memberChangeError({ id: viewer?.memberId ?? "", role: viewer?.role ?? "viewer" }, { id: "new", role: "viewer" }, { role: r }, 2))
  return (
    <>
      <button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "All seats are in use" : undefined} className={cn(primaryButton, "inline-flex items-center gap-1.5 disabled:opacity-50")}>
        <Plus className="size-4" /> Invite member
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 p-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Invite a teammate</DialogTitle>
            <DialogDescription>They join with the role you pick. Every change is recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const f = new FormData(e.currentTarget)
              const data = await exec(
                () =>
                  inviteMember({
                    name: String(f.get("name")),
                    email: String(f.get("email")),
                    role: String(f.get("role")) as MemberRole,
                    team: String(f.get("team")) as (typeof TEAMS)[number],
                    title: String(f.get("title") ?? ""),
                  }),
                { success: "Invite created" }
              )
              if (data) setOpen(false)
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldLabel label="Name">
                <input name="name" required minLength={2} className={inputClass} placeholder="Jordan Lee" autoFocus />
              </FieldLabel>
              <FieldLabel label="Work email">
                <input name="email" type="email" required className={inputClass} placeholder="jordan@kitelane.example" />
              </FieldLabel>
              <FieldLabel label="Role">
                <select name="role" defaultValue="agent" className={selectClass}>
                  {grantable.map((r) => (
                    <option key={r} value={r}>
                      {roleInfo[r].label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Team">
                <select name="team" defaultValue="Support" className={selectClass}>
                  {TEAMS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            <FieldLabel label="Job title">
              <input name="title" className={inputClass} placeholder="Support Specialist" />
            </FieldLabel>
            <p className="rounded-xl bg-foreground/[0.04] p-3 text-xs text-muted-foreground">
              This is a private demo, so no email is sent. Use “Mark invite accepted” in the member menu to simulate them joining.
            </p>
            <DialogFooter className="-mx-5 -mb-5 px-5">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
                Cancel
              </button>
              <PendingButton type="submit" pending={pending} className={primaryButton}>
                Send invite
              </PendingButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
