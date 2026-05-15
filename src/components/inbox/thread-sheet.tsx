"use client"

import { useEffect, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button" // used for Reply / Forward
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  messageId: string
}

interface ThreadSheetProps {
  threadId: string
  mailAccountId: string
  onClose: () => void
  onReply?: (data: ThreadActionData) => void
  onForward?: (data: ThreadActionData) => void
  onArchive?: (data: ThreadActionData) => void
  onTrash?: (data: ThreadActionData) => void
}

interface NormalizedLabel {
  providerLabelId: string
  name: string
  color?: string
  isSystem: boolean
}

export function ThreadSheet({
  threadId,
  mailAccountId,
  onClose,
  onReply,
  onForward,
  onArchive,
  onTrash,
}: ThreadSheetProps) {
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showLabels, setShowLabels] = useState(false)
  const [labels, setLabels] = useState<NormalizedLabel[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [keyPoints, setKeyPoints] = useState<string[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [keyPointsOpen, setKeyPointsOpen] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setSummaryLoading(true)
      setSummary(null)
      setKeyPoints([])

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

      // Fire summarize in parallel — doesn't block message rendering
      try {
        const res = await fetch("/api/ai/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, mailAccountId }),
        })
        if (res.ok) {
          const data = await res.json()
          setSummary(data.summary ?? null)
          setKeyPoints(data.keyPoints ?? [])
        }
      } catch {
        // summary unavailable — silent fail
      } finally {
        setSummaryLoading(false)
      }
    }
    load()
  }, [threadId, mailAccountId])

  async function openLabels() {
    setShowLabels(true)
    if (labels.length > 0) return
    setLabelsLoading(true)
    try {
      const res = await fetch(`/api/labels?mailAccountId=${mailAccountId}`)
      const data = await res.json()
      setLabels(data.labels ?? [])
    } finally {
      setLabelsLoading(false)
    }
  }

  async function applyLabel(labelId: string) {
    if (!lastMessage) return
    await fetch("/api/messages/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: lastMessage.id, labelId, action: "apply" }),
    })
    setShowLabels(false)
  }

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
      messageId: lastMessage.id,
    }
  }

  return (
    <>
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

          {/* AI Summary panel */}
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ) : summary ? (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed text-foreground">{summary}</p>
                {keyPoints.length > 0 && (
                  <button
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setKeyPointsOpen((v) => !v)}
                  >
                    <span>{keyPointsOpen ? "▾" : "▸"}</span>
                    Why this matters
                  </button>
                )}
                {keyPointsOpen && (
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {keyPoints.map((pt, i) => (
                      <li key={i} className="text-xs text-muted-foreground before:mr-1.5 before:content-['•']">
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

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
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-sm hover:bg-accent">
                  ⋯
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      onArchive?.(buildActionData())
                      onClose()
                    }}
                  >
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      onTrash?.(buildActionData())
                      onClose()
                    }}
                  >
                    Move to Trash
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openLabels}>
                    Labels…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Label picker */}
      <Sheet open={showLabels} onOpenChange={(open) => !open && setShowLabels(false)}>
        <SheetContent side="bottom" className="max-h-[60svh] p-0">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-left text-base">Apply label</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto">
            {labelsLoading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : labels.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No labels found.</p>
            ) : (
              labels.map((label) => (
                <button
                  key={label.providerLabelId}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm hover:bg-muted/50"
                  onClick={() => applyLabel(label.providerLabelId)}
                >
                  {label.color && (
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: label.color }}
                    />
                  )}
                  {label.name}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
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
