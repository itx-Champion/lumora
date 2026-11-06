import type { LumoraUIMessage } from "@/lib/ai/types"
import type { ActionRecord } from "./types"

/** Collects completed tool calls from chat messages as Actions inbox records. */
export function extractActions(messages: LumoraUIMessage[], conversationId: string): ActionRecord[] {
  const records: ActionRecord[] = []
  for (const message of messages) {
    if (message.role !== "assistant") continue
    for (const part of message.parts) {
      if (part.type === "tool-createTicket" && part.state === "output-available") {
        records.push({ kind: "ticket", toolCallId: part.toolCallId, conversationId, data: part.output })
      } else if (part.type === "tool-draftEmail" && part.state === "output-available") {
        records.push({ kind: "email", toolCallId: part.toolCallId, conversationId, data: part.output })
      } else if (part.type === "tool-scheduleMeeting" && part.state === "output-available") {
        records.push({ kind: "meeting", toolCallId: part.toolCallId, conversationId, data: part.output })
      }
    }
  }
  return records
}
