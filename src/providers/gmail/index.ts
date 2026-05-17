import { decrypt, encrypt } from "@/lib/encryption"
import { prisma } from "@/lib/prisma"
import type {
  Draft,
  EmailProvider,
  ListOpts,
  ListResult,
  NormalizedLabel,
  NormalizedMessage,
  NormalizedThread,
  SyncResult,
} from "@/providers/types"

interface GmailCreds {
  accessToken: string
  refreshToken: string
  expiresAt: number | null
}

interface GmailHeader {
  name: string
  value: string
}

interface GmailPayload {
  mimeType?: string
  headers?: GmailHeader[]
  body?: { data?: string }
  parts?: GmailPayload[]
}

interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  historyId?: string
  internalDate?: string
  payload?: GmailPayload
}

export class GmailProvider implements EmailProvider {
  readonly type = "GMAIL" as const

  private creds: GmailCreds
  private readonly mailAccountId: string

  constructor(mailAccountId: string, encryptedCreds: string) {
    this.mailAccountId = mailAccountId
    this.creds = JSON.parse(decrypt(encryptedCreds)) as GmailCreds
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  private async gmailFetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `https://www.googleapis.com/gmail/v1/users/me${path}`
    const headers = {
      Authorization: `Bearer ${this.creds.accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    }

    let res = await fetch(url, { ...options, headers })

    if (res.status === 401) {
      await this.refreshAccessToken()
      res = await fetch(url, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${this.creds.accessToken}` },
      })
    }

    return res
  }

  private async refreshAccessToken(): Promise<void> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: this.creds.refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)

    const data = (await res.json()) as { access_token: string; expires_in: number }
    this.creds.accessToken = data.access_token
    this.creds.expiresAt = Date.now() + data.expires_in * 1000

    await prisma.mailAccount.update({
      where: { id: this.mailAccountId },
      data: { encryptedCreds: encrypt(JSON.stringify(this.creds)) },
    })
  }

  // ─── Interface methods ────────────────────────────────────────────────────

  async verifyConnection(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      const res = await this.gmailFetch("/profile")
      if (!res.ok) return { ok: false, reason: `Gmail API ${res.status}` }
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: String(e) }
    }
  }

  async listMessages(opts: ListOpts = {}): Promise<ListResult> {
    const { folder = "INBOX", limit = 50, cursor, query, labelId } = opts
    const params = new URLSearchParams({ maxResults: String(limit) })
    if (cursor) params.set("pageToken", cursor)

    const q: string[] = []
    if (query) q.push(query)
    if (labelId) {
      q.push(`label:${labelId}`)
    } else if (folder === "INBOX") {
      q.push("in:inbox")
    } else if (folder === "SENT") {
      q.push("in:sent")
    } else if (folder === "TRASH") {
      q.push("in:trash")
    } else if (folder === "ARCHIVE") {
      q.push("-in:inbox -in:trash -in:sent -in:spam")
    }
    if (q.length) params.set("q", q.join(" "))

    const res = await this.gmailFetch(`/messages?${params}`)
    if (!res.ok) throw new Error(`Gmail list error: ${res.status}`)
    const data = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string }

    if (!data.messages?.length) return { messages: [], nextCursor: undefined }

    const messages = (
      await Promise.all(data.messages.map((m) => this.fetchMessage(m.id)))
    ).filter((m): m is NormalizedMessage => m !== null)

    return { messages, nextCursor: data.nextPageToken }
  }

  private async fetchMessage(id: string): Promise<NormalizedMessage | null> {
    const res = await this.gmailFetch(`/messages/${id}?format=full`)
    if (!res.ok) return null
    return normalizeMessage((await res.json()) as GmailMessage)
  }

  async getThread(threadId: string): Promise<NormalizedThread> {
    const res = await this.gmailFetch(`/threads/${threadId}?format=full`)
    if (!res.ok) throw new Error(`Gmail thread error: ${res.status}`)
    const data = (await res.json()) as { messages?: GmailMessage[] }

    const messages = (data.messages ?? [])
      .map(normalizeMessage)
      .filter((m): m is NormalizedMessage => m !== null)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())

    return {
      threadId,
      subject: messages[0]?.subject ?? null,
      messages,
      participantCount: new Set(messages.map((m) => m.from.email)).size,
      lastMessageAt: messages[messages.length - 1]?.sentAt ?? new Date(),
    }
  }

  async sendMessage(draft: Draft): Promise<{ providerMessageId: string; threadId: string }> {
    const raw = buildRfc2822(draft)
    const encoded = Buffer.from(raw).toString("base64url")
    const body: Record<string, string> = { raw: encoded }
    if (draft.threadId) body.threadId = draft.threadId

    const res = await this.gmailFetch("/messages/send", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Gmail send error: ${res.status}`)
    const data = (await res.json()) as { id: string; threadId: string }
    return { providerMessageId: data.id, threadId: data.threadId }
  }

  async archive(providerMessageId: string): Promise<void> {
    await this.gmailFetch(`/messages/${providerMessageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
    })
  }

  async trash(providerMessageId: string): Promise<void> {
    await this.gmailFetch(`/messages/${providerMessageId}/trash`, { method: "POST" })
  }

  async markRead(providerMessageId: string, read: boolean): Promise<void> {
    const body = read
      ? { removeLabelIds: ["UNREAD"] }
      : { addLabelIds: ["UNREAD"] }
    await this.gmailFetch(`/messages/${providerMessageId}/modify`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async listLabels(): Promise<NormalizedLabel[]> {
    const res = await this.gmailFetch("/labels")
    if (!res.ok) throw new Error(`Gmail labels error: ${res.status}`)
    const data = (await res.json()) as { labels?: { id: string; name: string; type: string }[] }
    return (data.labels ?? []).map((l) => ({
      providerLabelId: l.id,
      name: l.name,
      isSystem: l.type === "system",
    }))
  }

  async applyLabel(providerMessageId: string, providerLabelId: string): Promise<void> {
    await this.gmailFetch(`/messages/${providerMessageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ addLabelIds: [providerLabelId] }),
    })
  }

  async removeLabel(providerMessageId: string, providerLabelId: string): Promise<void> {
    await this.gmailFetch(`/messages/${providerMessageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ removeLabelIds: [providerLabelId] }),
    })
  }

  async search(query: string, opts?: Pick<ListOpts, "limit" | "cursor">): Promise<ListResult> {
    return this.listMessages({ query, limit: opts?.limit ?? 50, cursor: opts?.cursor })
  }

  async syncChanges(lastCursor: string | null): Promise<SyncResult> {
    if (!lastCursor) {
      const result = await this.listMessages({ folder: "INBOX", limit: 50 })
      const firstMeta = result.messages[0]?.providerMeta as { historyId?: string } | undefined
      return {
        newMessages: result.messages,
        updatedMessages: [],
        deletedMessageIds: [],
        nextCursor: firstMeta?.historyId ?? "1",
      }
    }

    const res = await this.gmailFetch(
      `/history?startHistoryId=${lastCursor}&historyTypes=messageAdded,messageDeleted,labelAdded,labelRemoved&maxResults=100`
    )

    // historyId expired or invalid — full re-sync
    if (res.status === 404 || res.status === 400) return this.syncChanges(null)
    if (!res.ok) throw new Error(`Gmail history error: ${res.status}`)

    const data = (await res.json()) as {
      history?: Array<{
        messagesAdded?: Array<{ message: { id: string } }>
        messagesDeleted?: Array<{ message: { id: string } }>
        labelsAdded?: Array<{ message: { id: string } }>
        labelsRemoved?: Array<{ message: { id: string } }>
      }>
      historyId?: string
    }

    const addedIds = new Set<string>()
    const deletedIds = new Set<string>()
    const updatedIds = new Set<string>()

    for (const h of data.history ?? []) {
      for (const m of h.messagesAdded ?? []) addedIds.add(m.message.id)
      for (const m of h.messagesDeleted ?? []) deletedIds.add(m.message.id)
      for (const m of h.labelsAdded ?? []) updatedIds.add(m.message.id)
      for (const m of h.labelsRemoved ?? []) updatedIds.add(m.message.id)
    }

    // Don't re-fetch IDs already in added or deleted
    const addedArr = Array.from(addedIds)
    const deletedArr = Array.from(deletedIds)
    const updatedArr = Array.from(updatedIds).filter(
      (id) => !addedIds.has(id) && !deletedIds.has(id)
    )

    const [newMessages, updatedMessages] = await Promise.all([
      Promise.all(addedArr.map((id) => this.fetchMessage(id))),
      Promise.all(updatedArr.map((id) => this.fetchMessage(id))),
    ])

    return {
      newMessages: newMessages.filter((m): m is NormalizedMessage => m !== null),
      updatedMessages: updatedMessages.filter((m): m is NormalizedMessage => m !== null),
      deletedMessageIds: deletedArr,
      nextCursor: data.historyId ?? lastCursor,
    }
  }
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function parseAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    const name = match[1].trim()
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() }
  }
  return { email: raw.trim() }
}

function parseAddressList(raw: string): { email: string; name?: string }[] {
  if (!raw) return []
  return raw.split(/,(?![^<]*>)/).map((s) => parseAddress(s.trim()))
}

function extractBody(payload: GmailPayload): { text: string | null; html: string | null } {
  const mime = payload.mimeType ?? ""

  if (mime === "text/plain") return { text: decodeBase64url(payload.body?.data ?? ""), html: null }
  if (mime === "text/html") return { text: null, html: decodeBase64url(payload.body?.data ?? "") }

  if (payload.parts?.length) {
    let text: string | null = null
    let html: string | null = null
    for (const part of payload.parts) {
      const sub = extractBody(part)
      if (!text && sub.text) text = sub.text
      if (!html && sub.html) html = sub.html
    }
    return { text, html }
  }

  return { text: null, html: null }
}

function decodeBase64url(data: string): string {
  if (!data) return ""
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
}

function normalizeMessage(msg: GmailMessage): NormalizedMessage | null {
  if (!msg?.payload) return null

  const headers = msg.payload.headers ?? []
  const labelIds = msg.labelIds ?? []

  const from = parseAddress(getHeader(headers, "from"))
  const dateStr = getHeader(headers, "date")
  const sentAt = dateStr ? new Date(dateStr) : new Date(Number(msg.internalDate ?? 0))

  const { text, html } = extractBody(msg.payload)

  let folder: NormalizedMessage["folder"] = "INBOX"
  if (labelIds.includes("SENT")) folder = "SENT"
  else if (labelIds.includes("TRASH")) folder = "TRASH"
  else if (labelIds.includes("SPAM")) folder = "SPAM"
  else if (labelIds.includes("DRAFT")) folder = "DRAFT"
  else if (!labelIds.includes("INBOX")) folder = "ARCHIVE"

  return {
    providerMessageId: msg.id,
    threadId: msg.threadId,
    from,
    to: parseAddressList(getHeader(headers, "to")),
    cc: parseAddressList(getHeader(headers, "cc")),
    bcc: parseAddressList(getHeader(headers, "bcc")),
    subject: getHeader(headers, "subject") || null,
    bodyText: text,
    bodyHtml: html,
    snippet: (msg.snippet ?? "").slice(0, 150),
    sentAt,
    isRead: !labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    folder,
    providerMeta: {
      labelIds,
      historyId: msg.historyId,
      internalDate: msg.internalDate,
      messageId: getHeader(headers, "message-id"),
    },
  }
}

function buildRfc2822(draft: Draft): string {
  const fmt = (a: { email: string; name?: string }) =>
    a.name ? `${a.name} <${a.email}>` : a.email

  const lines = [
    `To: ${draft.to.map(fmt).join(", ")}`,
    ...(draft.cc?.length ? [`Cc: ${draft.cc.map(fmt).join(", ")}`] : []),
    ...(draft.bcc?.length ? [`Bcc: ${draft.bcc.map(fmt).join(", ")}`] : []),
    `Subject: ${draft.subject}`,
    ...(draft.inReplyTo ? [`In-Reply-To: ${draft.inReplyTo}`] : []),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    draft.bodyText,
  ]

  return lines.join("\r\n")
}
