"use client"

import { useCallback, useRef, useState } from "react"
import { useMessages } from "@/lib/hooks/use-messages"
import { MessageRow } from "./message-row"
import { MessageListSkeleton } from "./message-skeleton"
import { BottomNav } from "./bottom-nav"
import { ThreadSheet, type ThreadActionData } from "./thread-sheet"
import { ComposeSheet, type ComposePrefill } from "./compose-sheet"
import type { MessageSummary } from "@/lib/hooks/use-messages"

const PULL_THRESHOLD = 64

interface ActiveThread {
  threadId: string
  mailAccountId: string
}

interface ComposeState {
  mode: "compose" | "reply" | "forward"
  mailAccountId: string
  prefill?: ComposePrefill
}

function buildReplyPrefill(data: ThreadActionData): ComposePrefill {
  const date = new Date(data.sentAt).toLocaleDateString()
  const sender = data.fromName ?? data.fromAddress
  const subj = data.subject ?? ""
  return {
    to: data.fromAddress,
    subject: subj.startsWith("Re:") ? subj : `Re: ${subj}`,
    body: `\n\n— On ${date}, ${sender} wrote:\n${data.lastBody ?? ""}`,
    threadId: data.threadId,
    inReplyTo: data.providerMessageId,
  }
}

function buildForwardPrefill(data: ThreadActionData): ComposePrefill {
  const date = new Date(data.sentAt).toLocaleDateString()
  const sender = data.fromName ?? data.fromAddress
  const subj = data.subject ?? ""
  return {
    subject: subj.startsWith("Fwd:") ? subj : `Fwd: ${subj}`,
    body: `\n\n— Forwarded message from ${sender} on ${date}:\n${data.lastBody ?? ""}`,
  }
}

export function InboxClient() {
  const { messages, loading, refreshing, hasMore, folder, setFolder, loadMore, refresh, optimisticArchive } =
    useMessages()

  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null)
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [pullDelta, setPullDelta] = useState(0)
  const isPulling = useRef(false)
  const startY = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (listRef.current?.scrollTop === 0) {
      isPulling.current = true
      startY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) setPullDelta(Math.min(delta, PULL_THRESHOLD * 1.5))
  }, [])

  const onTouchEnd = useCallback(() => {
    if (pullDelta >= PULL_THRESHOLD) refresh()
    isPulling.current = false
    setPullDelta(0)
  }, [pullDelta, refresh])

  const openThread = useCallback((msg: MessageSummary) => {
    setActiveThread({ threadId: msg.threadId, mailAccountId: msg.mailAccountId })
  }, [])

  const handleReply = useCallback((data: ThreadActionData) => {
    setActiveThread(null)
    setCompose({ mode: "reply", mailAccountId: data.mailAccountId, prefill: buildReplyPrefill(data) })
  }, [])

  const handleForward = useCallback((data: ThreadActionData) => {
    setActiveThread(null)
    setCompose({ mode: "forward", mailAccountId: data.mailAccountId, prefill: buildForwardPrefill(data) })
  }, [])

  // Use first message's mailAccountId as default for compose FAB
  const defaultMailAccountId = messages[0]?.mailAccountId ?? ""

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <h1 className="text-lg font-semibold capitalize">
          {folder === "INBOX" ? "Inbox" : folder.charAt(0) + folder.slice(1).toLowerCase()}
        </h1>
        {refreshing && (
          <span className="ml-2 text-xs text-muted-foreground animate-pulse">Refreshing…</span>
        )}
      </header>

      {pullDelta > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden bg-muted/50 text-xs text-muted-foreground transition-all"
          style={{ height: `${pullDelta}px` }}
        >
          {pullDelta >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto pb-16"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {loading ? (
          <MessageListSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            No messages
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                onClick={() => openThread(msg)}
                onArchive={() => optimisticArchive(msg.id)}
              />
            ))}
            {hasMore && (
              <button
                className="w-full py-4 text-sm text-muted-foreground hover:text-foreground"
                onClick={loadMore}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>

      {/* Compose FAB */}
      {defaultMailAccountId && (
        <button
          onClick={() => setCompose({ mode: "compose", mailAccountId: defaultMailAccountId })}
          className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
          aria-label="Compose"
        >
          ✎
        </button>
      )}

      <BottomNav folder={folder} onSelect={setFolder} />

      {activeThread && (
        <ThreadSheet
          threadId={activeThread.threadId}
          mailAccountId={activeThread.mailAccountId}
          onClose={() => setActiveThread(null)}
          onReply={handleReply}
          onForward={handleForward}
          onArchive={(accId, msgId) => {
            optimisticArchive(messages.find((m) => m.providerMessageId === msgId)?.id ?? msgId)
          }}
        />
      )}

      {compose && (
        <ComposeSheet
          mode={compose.mode}
          mailAccountId={compose.mailAccountId}
          prefill={compose.prefill}
          onClose={() => setCompose(null)}
        />
      )}
    </div>
  )
}
