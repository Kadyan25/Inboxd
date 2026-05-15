import Dexie, { type Table } from "dexie"

export interface DBMessage {
  id: string
  mailAccountId: string
  providerMessageId: string
  threadId: string
  fromAddress: string
  fromName: string | null
  toAddresses: string[]
  subject: string | null
  snippet: string | null
  sentAt: number // stored as epoch ms for Dexie indexing
  isRead: boolean
  isStarred: boolean
  folder: string
  aiPriority: string | null
  aiPriorityReason: string | null
}

export interface DBMailAccount {
  id: string
  userId: string
  type: string
  emailAddress: string
  displayName: string | null
  lastSyncAt: number | null
  syncCursor: string | null
  syncStatus: string
}

export interface DBThreadSummary {
  threadId: string
  mailAccountId: string
  lastMessageAt: number
  summaryText: string
  keyPoints?: string[]
}

class InboxdDB extends Dexie {
  messages!: Table<DBMessage>
  mailAccounts!: Table<DBMailAccount>
  threadSummaries!: Table<DBThreadSummary>

  constructor() {
    super("inboxd")
    this.version(1).stores({
      messages:
        "id, mailAccountId, threadId, [mailAccountId+folder+sentAt], sentAt, isRead, folder",
      mailAccounts: "id, userId",
      threadSummaries: "[threadId+mailAccountId], mailAccountId",
    })
  }
}

// Singleton — safe to call on server (returns undefined) and client
let _db: InboxdDB | undefined

export function getDB(): InboxdDB {
  if (typeof window === "undefined") {
    throw new Error("getDB() called server-side — IndexedDB is client-only")
  }
  if (!_db) _db = new InboxdDB()
  return _db
}
