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

interface ThreadSheetProps {
  threadId: string
  onClose: () => void
  onReply?: (threadId: string, mailAccountId: string) => void
  onArchive?: (mailAccountId: string, providerMessageId: string) => void
}

export function ThreadSheet({ threadId, onClose, onReply, onArchive }: ThreadSheetProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Find a mailAccountId from the first message — we need it for the API call
    // Since threadId may span a single account, we fetch from all accounts by trying each
    async function load() {
      setLoading(true)
      try {
        // First get the message list to find the mailAccountId
        const listRes = await fetch(`/api/messages?folder=INBOX&limit=100`)
        const listData = await listRes.json()
        const match = listData.messages?.find((m: { threadId: string; mailAccountId: string }) => m.threadId === threadId)
        if (!match) {
          // Try other folders
          for (const folder of ["SENT", "ARCHIVE", "TRASH"]) {
            const r = await fetch(`/api/messages?folder=${folder}&limit=100`)
            const d = await r.json()
            const m = d.messages?.find((x: { threadId: string; mailAccountId: string }) => x.threadId === threadId)
            if (m) {
              await loadThread(m.mailAccountId)
              return
            }
          }
        } else {
          await loadThread(match.mailAccountId)
        }
      } catch {
        setLoading(false)
      }
    }

    async function loadThread(mailAccountId: string) {
      const res = await fetch(`/api/messages/thread?threadId=${encodeURIComponent(threadId)}&mailAccountId=${mailAccountId}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
      setLoading(false)
    }

    load()
  }, [threadId])

  const subject = messages[0]?.subject ?? "(no subject)"
  const mailAccountId = messages[0]?.mailAccountId
  const lastMessage = messages[messages.length - 1]

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[90svh] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3">
          <SheetTitle className="text-left text-base font-semibold leading-snug line-clamp-2">
            {loading ? <Skeleton className="h-5 w-48" /> : subject}
          </SheetTitle>
          {!loading && (
            <p className="text-xs text-muted-foreground">{messages.length} message{messages.length !== 1 ? "s" : ""}</p>
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

        {/* Action bar */}
        {!loading && lastMessage && (
          <div className="fixed bottom-0 left-0 right-0 flex gap-2 border-t border-border bg-background px-4 py-3 pb-safe">
            <Button
              variant="default"
              className="flex-1"
              onClick={() => onReply?.(threadId, mailAccountId!)}
            >
              Reply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onArchive?.(mailAccountId!, lastMessage.providerMessageId)
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
          {!open && (
            <p className="truncate text-xs text-muted-foreground">{message.snippet}</p>
          )}
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
