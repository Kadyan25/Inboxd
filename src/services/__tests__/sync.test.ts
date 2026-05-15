import { describe, it, expect, vi, beforeEach } from "vitest"
import { MockProvider } from "@/providers/mock"

// Test the sync logic via the MockProvider directly (no DB needed for unit tests)
describe("sync via MockProvider", () => {
  let provider: MockProvider

  beforeEach(() => {
    provider = new MockProvider("acc-gmail")
  })

  it("full sync returns all messages as new", async () => {
    const result = await provider.syncChanges(null)
    expect(result.newMessages.length).toBeGreaterThan(0)
    expect(result.updatedMessages).toHaveLength(0)
    expect(result.deletedMessageIds).toHaveLength(0)
    expect(result.nextCursor).toBeTruthy()
  })

  it("incremental sync after cursor returns empty delta", async () => {
    const first = await provider.syncChanges(null)
    const second = await provider.syncChanges(first.nextCursor)
    expect(second.newMessages).toHaveLength(0)
    expect(second.updatedMessages).toHaveLength(0)
    expect(second.deletedMessageIds).toHaveLength(0)
    expect(second.nextCursor).toBe(first.nextCursor)
  })

  it("archived message does not appear in next full sync inbox", async () => {
    const { messages } = await provider.listMessages({ folder: "INBOX" })
    const target = messages[0]
    await provider.archive(target.providerMessageId)

    const { messages: inbox } = await provider.listMessages({ folder: "INBOX" })
    expect(inbox.find((m) => m.providerMessageId === target.providerMessageId)).toBeUndefined()

    const { messages: archive } = await provider.listMessages({ folder: "ARCHIVE" })
    expect(archive.find((m) => m.providerMessageId === target.providerMessageId)).toBeDefined()
  })

  it("sent message appears in SENT after send", async () => {
    await provider.sendMessage({
      to: [{ email: "test@example.com" }],
      subject: "Sync test",
      bodyText: "Hello from sync test",
    })
    const { messages } = await provider.listMessages({ folder: "SENT" })
    const sent = messages.find((m) => m.subject === "Sync test")
    expect(sent).toBeDefined()
    expect(sent?.isRead).toBe(true)
  })
})

describe("encryption helpers", () => {
  beforeEach(() => {
    vi.stubEnv("ENCRYPTION_KEY", "a".repeat(64))
  })

  it("encrypt/decrypt round-trips correctly", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption")
    const plaintext = "super secret token"
    const ciphertext = encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    expect(decrypt(ciphertext)).toBe(plaintext)
  })

  it("each encryption produces a unique ciphertext", async () => {
    const { encrypt } = await import("@/lib/encryption")
    const a = encrypt("same plaintext")
    const b = encrypt("same plaintext")
    expect(a).not.toBe(b)
  })
})
