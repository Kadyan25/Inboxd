import type {
  EmailProvider,
  NormalizedMessage,
  NormalizedThread,
  NormalizedLabel,
  Draft,
  ListOpts,
  ListResult,
  SyncResult,
} from "@/providers/types"
import {
  ALL_MESSAGES_BY_ACCOUNT,
  MOCK_LABELS,
} from "./fixtures/messages"

export class MockProvider implements EmailProvider {
  readonly type = "MOCK" as const

  // Mutable in-memory store per instance (scoped to accountId)
  private messages: NormalizedMessage[]
  private labelAssignments: Map<string, Set<string>> = new Map()
  private syncCursor = "mock-cursor-0"

  constructor(accountId: string) {
    // Deep copy so mutations don't affect the seed fixtures
    this.messages = JSON.parse(
      JSON.stringify(ALL_MESSAGES_BY_ACCOUNT[accountId] ?? []),
      (key, value) => (key === "sentAt" ? new Date(value) : value)
    )
  }

  async verifyConnection() {
    return { ok: true as const }
  }

  async listMessages(opts: ListOpts = {}): Promise<ListResult> {
    const { folder = "INBOX", limit = 50, cursor, query, labelId } = opts

    let results = this.messages.filter((m) => {
      if (labelId) return this.labelAssignments.get(m.providerMessageId)?.has(labelId)
      return m.folder === folder
    })

    if (query) {
      const q = query.toLowerCase()
      results = results.filter(
        (m) =>
          m.subject?.toLowerCase().includes(q) ||
          m.snippet.toLowerCase().includes(q) ||
          m.from.email.toLowerCase().includes(q) ||
          m.from.name?.toLowerCase().includes(q)
      )
    }

    // Sort newest first
    results.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())

    const offset = cursor ? parseInt(cursor, 10) : 0
    const page = results.slice(offset, offset + limit)
    const nextOffset = offset + page.length
    const nextCursor = nextOffset < results.length ? String(nextOffset) : undefined

    return { messages: page, nextCursor }
  }

  async getThread(threadId: string): Promise<NormalizedThread> {
    const messages = this.messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())

    if (messages.length === 0) throw new Error(`Thread not found: ${threadId}`)

    const participants = new Set([
      ...messages.map((m) => m.from.email),
      ...messages.flatMap((m) => m.to.map((t) => t.email)),
    ])

    return {
      threadId,
      subject: messages[0].subject,
      messages,
      participantCount: participants.size,
      lastMessageAt: messages[messages.length - 1].sentAt,
    }
  }

  async sendMessage(draft: Draft): Promise<{ providerMessageId: string; threadId: string }> {
    const id = `mock-sent-${Date.now()}`
    const threadId = draft.threadId ?? `mock-thread-${Date.now()}`

    const sent: NormalizedMessage = {
      providerMessageId: id,
      threadId,
      from: { email: "alex.morgan@mock.com", name: "Alex" },
      to: draft.to,
      cc: draft.cc ?? [],
      bcc: draft.bcc ?? [],
      subject: draft.subject,
      bodyText: draft.bodyText,
      bodyHtml: draft.bodyHtml ?? null,
      snippet: draft.bodyText.slice(0, 150),
      sentAt: new Date(),
      isRead: true,
      isStarred: false,
      folder: "SENT",
      providerMeta: {},
    }

    this.messages.push(sent)
    return { providerMessageId: id, threadId }
  }

  async archive(providerMessageId: string): Promise<void> {
    this._updateFolder(providerMessageId, "ARCHIVE")
  }

  async trash(providerMessageId: string): Promise<void> {
    this._updateFolder(providerMessageId, "TRASH")
  }

  async permanentlyDelete(providerMessageId: string): Promise<void> {
    this.messages = this.messages.filter((m) => m.providerMessageId !== providerMessageId)
  }

  async markRead(providerMessageId: string, read: boolean): Promise<void> {
    const msg = this._find(providerMessageId)
    if (msg) msg.isRead = read
  }

  async listLabels(): Promise<NormalizedLabel[]> {
    return MOCK_LABELS
  }

  async applyLabel(providerMessageId: string, providerLabelId: string): Promise<void> {
    if (!this.labelAssignments.has(providerMessageId)) {
      this.labelAssignments.set(providerMessageId, new Set())
    }
    this.labelAssignments.get(providerMessageId)!.add(providerLabelId)
  }

  async removeLabel(providerMessageId: string, providerLabelId: string): Promise<void> {
    this.labelAssignments.get(providerMessageId)?.delete(providerLabelId)
  }

  async search(query: string, opts: Pick<ListOpts, "limit" | "cursor"> = {}): Promise<ListResult> {
    return this.listMessages({ ...opts, query })
  }

  async syncChanges(lastCursor: string | null): Promise<SyncResult> {
    // On first sync (null cursor) return all messages as new
    if (lastCursor === null) {
      const newCursor = `mock-cursor-${Date.now()}`
      this.syncCursor = newCursor
      return {
        newMessages: [...this.messages],
        updatedMessages: [],
        deletedMessageIds: [],
        nextCursor: newCursor,
      }
    }

    // Subsequent syncs return nothing new (mock data is static)
    return {
      newMessages: [],
      updatedMessages: [],
      deletedMessageIds: [],
      nextCursor: this.syncCursor,
    }
  }

  private _find(id: string): NormalizedMessage | undefined {
    return this.messages.find((m) => m.providerMessageId === id)
  }

  private _updateFolder(id: string, folder: NormalizedMessage["folder"]): void {
    const msg = this._find(id)
    if (msg) msg.folder = folder
  }
}
