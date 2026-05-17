"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useMessages } from "@/lib/hooks/use-messages"
import { MessageRow } from "./message-row"
import { MessageListSkeleton } from "./message-skeleton"
import { BottomNav } from "./bottom-nav"
import { ThreadSheet, type ThreadActionData } from "./thread-sheet"
import { ComposeSheet, type ComposePrefill } from "./compose-sheet"
import { AccountsSheet, type AccountSummary } from "./accounts-sheet"
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

interface InboxClientProps {
  accountIds?: string[]
  initialSyncAccountIds?: string[]
  accounts?: AccountSummary[]
}

export function InboxClient({ accountIds = [], initialSyncAccountIds = [], accounts = [] }: InboxClientProps) {
  const { messages, loading, refreshing, hasMore, folder, setFolder, loadMore, refresh, optimisticArchive, optimisticTrash } =
    useMessages(undefined, accountIds)

  const [activeThread, setActiveThread] = useState<ActiveThread | null>(null)
  const [compose, setCompose] = useState<ComposeState | null>(null)
  const [pullDelta, setPullDelta] = useState(0)

  // Auto-sync accounts that have never been synced (e.g. first sign-in)
  useEffect(() => {
    if (initialSyncAccountIds.length === 0) return
    Promise.all(
      initialSyncAccountIds.map((id) =>
        fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailAccountId: id }),
        }).catch(() => {})
      )
    ).then(() => refresh())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MessageSummary[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPulling = useRef(false)
  const startY = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounced search fetch
  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) {
      setSearchResults([])
      return
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/messages/search?q=${encodeURIComponent(searchQuery.trim())}`)
        const data = await res.json()
        setSearchResults(data.messages ?? [])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [searchQuery, searchOpen])

  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery("")
    setSearchResults([])
  }

  const archiveWithUndo = useCallback(
    (messageId: string) => {
      optimisticArchive(messageId)
      toast("Archived", {
        action: {
          label: "Undo",
          onClick: () => {
            fetch("/api/messages/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId }),
            }).then(() => refresh())
          },
        },
      })
    },
    [optimisticArchive, refresh]
  )

  const trashWithUndo = useCallback(
    (messageId: string) => {
      optimisticTrash(messageId)
      toast("Moved to Trash", {
        action: {
          label: "Undo",
          onClick: () => {
            fetch("/api/messages/restore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId }),
            }).then(() => refresh())
          },
        },
      })
    },
    [optimisticTrash, refresh]
  )

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

  const handleDraftReply = useCallback((data: ThreadActionData, bodyText: string) => {
    setActiveThread(null)
    const prefill = buildReplyPrefill(data)
    setCompose({ mode: "reply", mailAccountId: data.mailAccountId, prefill: { ...prefill, body: bodyText } })
  }, [])

  const [accountsOpen, setAccountsOpen] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)

  const baseMessages = searchOpen && searchQuery ? searchResults : messages
  const displayMessages = priorityFilter
    ? baseMessages.filter((m) => m.aiPriority === priorityFilter)
    : baseMessages
  const defaultMailAccountId = messages[0]?.mailAccountId ?? ""

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        {searchOpen ? (
          <>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={closeSearch}
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h1 className="flex-1 text-lg font-semibold capitalize">
              {folder === "INBOX" ? "Inbox" : folder.charAt(0) + folder.slice(1).toLowerCase()}
            </h1>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
              aria-label="Refresh"
            >
              {refreshing ? "⏳" : "🔄"}
            </button>
            <button onClick={openSearch} className="text-lg text-muted-foreground hover:text-foreground" aria-label="Search">
              🔍
            </button>
            <button
              onClick={() => setAccountsOpen(true)}
              className="text-lg text-muted-foreground hover:text-foreground"
              aria-label="Accounts"
            >
              ⊕
            </button>
          </>
        )}
      </header>

      {/* Priority filter bar */}
      {!searchOpen && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2 scrollbar-none">
          {[null, "URGENT", "NORMAL", "LOW", "NOISE"].map((p) => (
            <button
              key={p ?? "all"}
              onClick={() => setPriorityFilter(p)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                priorityFilter === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {p ?? "All"}
            </button>
          ))}
        </div>
      )}

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
        {loading || (searchOpen && searchLoading) ? (
          <MessageListSkeleton />
        ) : displayMessages.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {searchOpen && searchQuery ? "No results" : "No messages"}
          </div>
        ) : (
          <>
            {displayMessages.map((msg) => (
              <MessageRow
                key={msg.id}
                message={msg}
                onClick={() => openThread(msg)}
                onArchive={() => archiveWithUndo(msg.id)}
              />
            ))}
            {!searchOpen && hasMore && (
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
      {defaultMailAccountId && !searchOpen && (
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
          onDraftReply={handleDraftReply}
          onArchive={(data) => archiveWithUndo(data.messageId)}
          onTrash={(data) => trashWithUndo(data.messageId)}
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

      {accountsOpen && (
        <AccountsSheet accounts={accounts} onClose={() => setAccountsOpen(false)} />
      )}
    </div>
  )
}
