import { describe, it, expect, beforeEach } from "vitest"
import type { EmailProvider } from "@/providers/types"
import { MockProvider } from "@/providers/mock"

// Shared contract suite — run against every provider implementation
function runContractTests(name: string, factory: () => EmailProvider) {
  describe(`${name} — contract`, () => {
    let provider: EmailProvider

    beforeEach(() => {
      provider = factory()
    })

    it("verifyConnection returns ok:true", async () => {
      const result = await provider.verifyConnection()
      expect(result.ok).toBe(true)
    })

    it("listMessages returns messages with required fields", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      expect(messages.length).toBeGreaterThan(0)
      for (const msg of messages) {
        expect(msg.providerMessageId).toBeTruthy()
        expect(msg.threadId).toBeTruthy()
        expect(msg.from.email).toBeTruthy()
        expect(msg.sentAt).toBeInstanceOf(Date)
        expect(typeof msg.snippet).toBe("string")
        expect(["INBOX","SENT","ARCHIVE","TRASH","DRAFT","SPAM"]).toContain(msg.folder)
      }
    })

    it("listMessages respects folder filter", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      expect(messages.every((m) => m.folder === "INBOX")).toBe(true)
    })

    it("listMessages respects limit", async () => {
      const { messages, nextCursor } = await provider.listMessages({ limit: 2 })
      expect(messages.length).toBeLessThanOrEqual(2)
      if (messages.length === 2) expect(nextCursor).toBeDefined()
    })

    it("listMessages paginates via cursor", async () => {
      const page1 = await provider.listMessages({ limit: 2 })
      if (!page1.nextCursor) return // not enough messages to paginate
      const page2 = await provider.listMessages({ limit: 2, cursor: page1.nextCursor })
      const ids1 = new Set(page1.messages.map((m) => m.providerMessageId))
      for (const msg of page2.messages) {
        expect(ids1.has(msg.providerMessageId)).toBe(false)
      }
    })

    it("getThread returns ordered messages", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      // Find a thread with >1 message
      const threadCounts: Record<string, number> = {}
      for (const m of messages) {
        threadCounts[m.threadId] = (threadCounts[m.threadId] ?? 0) + 1
      }
      const multiThreadId = Object.entries(threadCounts).find(([, c]) => c > 1)?.[0]
      if (!multiThreadId) return // skip if no multi-message thread in INBOX

      const thread = await provider.getThread(multiThreadId)
      expect(thread.threadId).toBe(multiThreadId)
      expect(thread.messages.length).toBeGreaterThan(1)
      for (let i = 1; i < thread.messages.length; i++) {
        expect(thread.messages[i].sentAt.getTime()).toBeGreaterThanOrEqual(
          thread.messages[i - 1].sentAt.getTime()
        )
      }
    })

    it("sendMessage adds to SENT folder", async () => {
      await provider.sendMessage({
        to: [{ email: "test@example.com" }],
        subject: "Test",
        bodyText: "Hello",
      })
      const { messages } = await provider.listMessages({ folder: "SENT" })
      const sent = messages.find((m) => m.subject === "Test")
      expect(sent).toBeDefined()
      expect(sent?.folder).toBe("SENT")
    })

    it("archive moves message out of INBOX", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      const target = messages[0]
      await provider.archive(target.providerMessageId)
      const { messages: inbox } = await provider.listMessages({ folder: "INBOX" })
      expect(inbox.find((m) => m.providerMessageId === target.providerMessageId)).toBeUndefined()
      const { messages: archive } = await provider.listMessages({ folder: "ARCHIVE" })
      expect(archive.find((m) => m.providerMessageId === target.providerMessageId)).toBeDefined()
    })

    it("trash moves message to TRASH", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      const target = messages[0]
      await provider.trash(target.providerMessageId)
      const { messages: trash } = await provider.listMessages({ folder: "TRASH" })
      expect(trash.find((m) => m.providerMessageId === target.providerMessageId)).toBeDefined()
    })

    it("markRead toggles read state", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      const target = messages.find((m) => !m.isRead) ?? messages[0]
      await provider.markRead(target.providerMessageId, true)
      const thread = await provider.getThread(target.threadId)
      const updated = thread.messages.find((m) => m.providerMessageId === target.providerMessageId)
      expect(updated?.isRead).toBe(true)
    })

    it("listLabels returns system labels", async () => {
      const labels = await provider.listLabels()
      expect(labels.length).toBeGreaterThan(0)
      expect(labels.some((l) => l.isSystem)).toBe(true)
    })

    it("applyLabel and removeLabel work", async () => {
      const { messages } = await provider.listMessages({ folder: "INBOX" })
      const target = messages[0]
      const labels = await provider.listLabels()
      const label = labels.find((l) => !l.isSystem) ?? labels[0]

      await provider.applyLabel(target.providerMessageId, label.providerLabelId)
      const { messages: labeled } = await provider.listMessages({ labelId: label.providerLabelId })
      expect(labeled.find((m) => m.providerMessageId === target.providerMessageId)).toBeDefined()

      await provider.removeLabel(target.providerMessageId, label.providerLabelId)
      const { messages: after } = await provider.listMessages({ labelId: label.providerLabelId })
      expect(after.find((m) => m.providerMessageId === target.providerMessageId)).toBeUndefined()
    })

    it("search returns matching messages", async () => {
      const { messages: all } = await provider.listMessages({ folder: "INBOX" })
      if (all.length === 0) return
      const subject = all[0].subject ?? ""
      const word = subject.split(" ")[0]
      if (!word) return
      const { messages: results } = await provider.search(word)
      expect(results.length).toBeGreaterThan(0)
    })

    it("syncChanges(null) returns all messages as new", async () => {
      const result = await provider.syncChanges(null)
      expect(result.newMessages.length).toBeGreaterThan(0)
      expect(result.nextCursor).toBeTruthy()
    })

    it("syncChanges with existing cursor returns no duplicates", async () => {
      const first = await provider.syncChanges(null)
      const second = await provider.syncChanges(first.nextCursor)
      const firstIds = new Set(first.newMessages.map((m) => m.providerMessageId))
      for (const msg of second.newMessages) {
        expect(firstIds.has(msg.providerMessageId)).toBe(false)
      }
    })
  })
}

// Run contract tests against MockProvider for all three accounts
runContractTests("MockProvider (gmail account)", () => new MockProvider("acc-gmail"))
runContractTests("MockProvider (outlook account)", () => new MockProvider("acc-outlook"))
runContractTests("MockProvider (yahoo account)", () => new MockProvider("acc-yahoo"))
