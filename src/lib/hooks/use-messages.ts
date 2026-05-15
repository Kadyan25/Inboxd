"use client"

import { useState, useCallback, useEffect, useRef } from "react"

export interface MessageSummary {
  id: string
  mailAccountId: string
  providerMessageId: string
  threadId: string
  fromAddress: string
  fromName: string | null
  subject: string | null
  snippet: string | null
  sentAt: string
  isRead: boolean
  isStarred: boolean
  folder: string
  aiPriority: string | null
  aiPriorityReason: string | null
}

type Folder = "INBOX" | "SENT" | "ARCHIVE" | "TRASH"

interface UseMessagesResult {
  messages: MessageSummary[]
  loading: boolean
  refreshing: boolean
  hasMore: boolean
  folder: Folder
  setFolder: (f: Folder) => void
  loadMore: () => void
  refresh: () => void
  optimisticArchive: (id: string) => void
  optimisticTrash: (id: string) => void
}

export function useMessages(accountId?: string): UseMessagesResult {
  const [folder, setFolderState] = useState<Folder>("INBOX")
  const [messages, setMessages] = useState<MessageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cursor, setCursor] = useState<string | undefined>()
  const [hasMore, setHasMore] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchPage = useCallback(
    async (opts: { reset?: boolean; signal?: AbortSignal } = {}) => {
      const params = new URLSearchParams({ folder, limit: "30" })
      if (accountId) params.set("accountId", accountId)
      if (!opts.reset && cursor) params.set("cursor", cursor)

      const res = await fetch(`/api/messages?${params}`, { signal: opts.signal })
      if (!res.ok) throw new Error("fetch failed")
      return res.json() as Promise<{ messages: MessageSummary[]; nextCursor?: string }>
    },
    [folder, accountId, cursor]
  )

  const load = useCallback(
    async (reset = false) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      if (reset) {
        setLoading(true)
        setCursor(undefined)
      }

      try {
        const data = await fetchPage({ reset, signal: ctrl.signal })
        setMessages((prev) => (reset ? data.messages : [...prev, ...data.messages]))
        setCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [fetchPage]
  )

  // Reload on folder change
  useEffect(() => {
    load(true)
  }, [folder, accountId]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFolder = useCallback((f: Folder) => {
    setFolderState(f)
    setMessages([])
    setLoading(true)
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    // Trigger sync then reload
    const accounts = accountId ? [accountId] : []
    if (accounts.length > 0) {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailAccountId: accounts[0] }),
      }).catch(() => {})
    }
    load(true)
  }, [accountId, load])

  const loadMore = useCallback(() => {
    if (hasMore && !loading) load(false)
  }, [hasMore, loading, load])

  const optimisticArchive = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    fetch("/api/messages/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    }).catch(() => {})
  }, [])

  const optimisticTrash = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    fetch("/api/messages/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    }).catch(() => {})
  }, [])

  return {
    messages,
    loading,
    refreshing,
    hasMore,
    folder,
    setFolder,
    loadMore,
    refresh,
    optimisticArchive,
    optimisticTrash,
  }
}
