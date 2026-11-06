"use client"

import { Suspense, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Chat } from "@/components/chat/chat"
import { useWorkspace } from "@/components/app/workspace-provider"
import { LogoMark } from "@/components/shared/logo"

function ChatRoute() {
  const params = useSearchParams()
  const { workspace } = useWorkspace()
  const requestedId = params.get("c")
  const question = params.get("q") ?? undefined
  const paramsKey = params.toString()

  // A fresh id per "new chat" navigation; existing chats keep their own id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draftId = useMemo(() => crypto.randomUUID(), [paramsKey])
  const conversationId = requestedId ?? draftId

  if (!workspace) return <ChatSkeleton />

  const conversation = workspace.conversations.find((c) => c.id === conversationId)
  return (
    <Chat
      key={conversationId}
      conversationId={conversationId}
      initialMessages={conversation?.messages ?? []}
      initialQuestion={requestedId ? undefined : question}
    />
  )
}

function ChatSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <LogoMark className="size-10 animate-pulse" />
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatRoute />
    </Suspense>
  )
}
