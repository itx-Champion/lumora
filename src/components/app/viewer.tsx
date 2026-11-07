"use client"

import { createContext, use, type ReactNode } from "react"
import type { MemberRole } from "@/db/schema"
import type { Permission } from "@/lib/crm/permissions"

/** What the client needs to know about the signed-in member (or the one being viewed as). */
export type Viewer = {
  memberId: string
  name: string
  email: string
  role: MemberRole
  title: string | null
  avatarHue: number
  orgName: string
  permissions: Permission[]
  impersonating: boolean
  realName: string
  unread: number
  openTickets: number
  myTasksDue: number
}

const ViewerContext = createContext<Viewer | null>(null)

export function ViewerProvider({ viewer, children }: { viewer: Viewer | null; children: ReactNode }) {
  return <ViewerContext value={viewer}>{children}</ViewerContext>
}

/** Null when the CRM database is unavailable; the knowledge-base features still work. */
export function useViewer() {
  return use(ViewerContext)
}

export function useCan() {
  const viewer = useViewer()
  return (permission: Permission) => Boolean(viewer?.permissions.includes(permission))
}
