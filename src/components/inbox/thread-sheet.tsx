"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

interface ThreadMessage {
  id: string
  providerMessageId: string
  threadId: string
  mailAccountId: string
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  subject: string | null
  bodyText: string | null
  snippet: string | null
  sentAt: string
  isRead: boolean
  folder: string
}

export interface ThreadActionData {
  mailAccountId: string
  threadId: string
  fromAddress: string
  fromName: string | null
  subject: string | null
  lastBody: string | null
  sentAt: string
  providerMessageId: string
}

interface ThreadSheetProps {
  threadId: string
  mailAccountId: string
  onClose: () => void
  onReply?: (data: ThreadActionData) => void
  onForward?: (data: ThreadActionData) => void
  onArchive?: (mailAccountId: string, providerMessageId: string) => void
}

export function ThreadSheet({ threadId, mailAccountId, onClose, onReply, onForward, onArchive }: ThreadSheetProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/messages/thread?threadId=${encodeURIComponent(threadId)}&mailAccountId=${mailAccountId}`
        )
        const data = await res.json()
        setMessages(data.messages ?? [])
      } catch {
        // leave empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [threadId, mailAccountId])

  const subject = messages[0]?.subject ?? "(no subject)"
  const lastMessage = messages[messages.length - 1]

  function buildActionData(): ThreadActionData {
    return {
      mailAccountId,
      threadId,
      fromAddress: lastMessage.fromAddress,
      fromName: lastMessage.fromName,
      subject: lastMessage.subject,
      lastBody: lastMessage.bodyText,
      sentAt: lastMessage.sentAt,
      providerMessageId: lastMessage.providerMessageId,
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90svh] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
          <SheetTitle className="text-left text-base font-semibold leading-snug line-clamp-2">
            {loading ? <Skeleton className="h-5 w-48" /> : subject}
          </SheetTitle>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {messages.length} message{messages.length !== 1 ? "s" : ""}
            </p>
          )}
        </SheetHeader>

        <div className="space-y-0 pb-32">
          {loading ? (
            <div className="space-y-4 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble key={msg.id} message={msg} defaultOpen={i === messages.length - 1} />
            ))
          )}
        </div>

        {!loading && lastMessage && (
          <div className="fixed bottom-0 left-0 right-0 flex gap-2 border-t border-border bg-background px-4 py-3 pb-safe">
            <Button variant="default" className="flex-1" onClick={() => onReply?.(buildActionData())}>
              Reply
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onForward?.(buildActionData())}>
              Forward
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onArchive?.(mailAccountId, lastMessage.providerMessageId)
                onClose()
              }}
            >
              Archive
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function MessageBubble({ message, defaultOpen }: { message: ThreadMessage; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const senderName = message.fromName || message.fromAddress.split("@")[0]
  const sentAt = new Date(message.sentAt)

  return (
    <div className="border-b border-border">
      <button
        className="flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
          {senderName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium">{senderName}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {sentAt.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
              {sentAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          </div>
          {!open && <p className="truncate text-xs text-muted-foreground">{message.snippet}</p>}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-0">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {message.bodyText ?? message.snippet}
          </p>
        </div>
      )}
    </div>
  )
}
