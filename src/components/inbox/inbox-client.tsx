"use client"

import { useCallback, useRef, useState } from "react"
import { useMessages } from "@/lib/hooks/use-messages"
import { MessageRow } from "./message-row"
import { MessageListSkeleton } from "./message-skeleton"
import { BottomNav } from "./bottom-nav"
import { ThreadSheet } from "./thread-sheet"
import type { MessageSummary } from "@/lib/hooks/use-messages"

const PULL_THRESHOLD = 64

export function InboxClient() {
  const { messages, loading, refreshing, hasMore, folder, setFolder, loadMore, refresh, optimisticArchive } =
    useMessages()

  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [pullDelta, setPullDelta] = useState(0)
  const isPulling = useRef(false)
  const startY = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Pull-to-refresh handlers
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
    setActiveThread(msg.threadId)
  }, [])

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <h1 className="text-lg font-semibold capitalize">
          {folder === "INBOX" ? "Inbox" : folder.charAt(0) + folder.slice(1).toLowerCase()}
        </h1>
        {refreshing && (
          <span className="ml-2 text-xs text-muted-foreground animate-pulse">Refreshing…</span>
        )}
      </header>

      {/* Pull-to-refresh indicator */}
      {pullDelta > 0 && (
        <div
          className="flex items-center justify-center overflow-hidden bg-muted/50 text-xs text-muted-foreground transition-all"
          style={{ height: `${pullDelta}px` }}
        >
          {pullDelta >= PULL_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}

      {/* Message list */}
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

      <BottomNav folder={folder} onSelect={setFolder} />

      {activeThread && (
        <ThreadSheet
          threadId={activeThread}
          onClose={() => setActiveThread(null)}
        />
      )}
    </div>
  )
}
