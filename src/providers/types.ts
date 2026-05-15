export interface MessageAddress {
  email: string
  name?: string
}

export interface NormalizedMessage {
  providerMessageId: string
  threadId: string

  from: MessageAddress
  to: MessageAddress[]
  cc: MessageAddress[]
  bcc: MessageAddress[]

  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  snippet: string

  sentAt: Date
  isRead: boolean
  isStarred: boolean
  folder: "INBOX" | "SENT" | "ARCHIVE" | "TRASH" | "DRAFT" | "SPAM"

  providerMeta: Record<string, unknown>
}

export interface NormalizedThread {
  threadId: string
  subject: string | null
  messages: NormalizedMessage[]
  participantCount: number
  lastMessageAt: Date
}

export interface NormalizedLabel {
  providerLabelId: string
  name: string
  color?: string
  isSystem: boolean
}

export interface Draft {
  to: MessageAddress[]
  cc?: MessageAddress[]
  bcc?: MessageAddress[]
  subject: string
  bodyText: string
  bodyHtml?: string
  inReplyTo?: string
  threadId?: string
}

export interface ListOpts {
  folder?: NormalizedMessage["folder"]
  limit?: number
  cursor?: string
  query?: string
  labelId?: string
}

export interface ListResult {
  messages: NormalizedMessage[]
  nextCursor?: string
}

export interface SyncResult {
  newMessages: NormalizedMessage[]
  updatedMessages: NormalizedMessage[]
  deletedMessageIds: string[]
  nextCursor: string
}

export interface EmailProvider {
  readonly type: "GMAIL" | "IMAP" | "GRAPH" | "MOCK"

  verifyConnection(): Promise<{ ok: true } | { ok: false; reason: string }>

  listMessages(opts: ListOpts): Promise<ListResult>
  getThread(threadId: string): Promise<NormalizedThread>

  sendMessage(draft: Draft): Promise<{ providerMessageId: string; threadId: string }>

  archive(providerMessageId: string): Promise<void>
  trash(providerMessageId: string): Promise<void>
  permanentlyDelete?(providerMessageId: string): Promise<void>

  markRead(providerMessageId: string, read: boolean): Promise<void>

  listLabels(): Promise<NormalizedLabel[]>
  applyLabel(providerMessageId: string, providerLabelId: string): Promise<void>
  removeLabel(providerMessageId: string, providerLabelId: string): Promise<void>

  search(query: string, opts?: Pick<ListOpts, "limit" | "cursor">): Promise<ListResult>

  syncChanges(lastCursor: string | null): Promise<SyncResult>
}
