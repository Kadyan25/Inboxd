import { describe, it, expect } from "vitest"
import { MockAIProvider } from "@/services/ai/mock"
import { summarizeOutputSchema, draftReplyOutputSchema, prioritizeOutputSchema } from "@/services/ai/schemas"
import type { NormalizedThread } from "@/providers/types"

const mockThread: NormalizedThread = {
  threadId: "t-1",
  subject: "Project deadline reminder",
  participantCount: 2,
  lastMessageAt: new Date("2024-01-15"),
  messages: [
    {
      providerMessageId: "m-1",
      threadId: "t-1",
      from: { email: "alice@example.com", name: "Alice" },
      to: [{ email: "bob@example.com" }],
      cc: [],
      bcc: [],
      subject: "Project deadline reminder",
      bodyText: "Hi Bob, just a reminder that the project deadline is tomorrow.",
      bodyHtml: null,
      snippet: "Hi Bob, just a reminder that the project deadline is tomorrow.",
      sentAt: new Date("2024-01-15"),
      isRead: false,
      isStarred: false,
      folder: "INBOX",
      providerMeta: {},
    },
  ],
}

describe("MockAIProvider", () => {
  const ai = new MockAIProvider()

  it("summarize returns valid SummarizeOutput", async () => {
    const result = await ai.summarize({ thread: mockThread })
    expect(() => summarizeOutputSchema.parse(result)).not.toThrow()
    expect(result.summary).toBeTruthy()
    expect(Array.isArray(result.keyPoints)).toBe(true)
  })

  it("draftReplies returns exactly 3 drafts", async () => {
    const result = await ai.draftReplies({ thread: mockThread })
    expect(() => draftReplyOutputSchema.parse(result)).not.toThrow()
    expect(result.drafts).toHaveLength(3)
    result.drafts.forEach((d) => {
      expect(d.label).toBeTruthy()
      expect(d.bodyText).toBeTruthy()
    })
  })

  it("prioritize returns one result per input message", async () => {
    const input = {
      messages: [
        { providerMessageId: "m-1", from: { email: "alice@example.com" }, subject: "URGENT: deadline", snippet: "Action required immediately", sentAt: new Date() },
        { providerMessageId: "m-2", from: { email: "news@newsletter.com" }, subject: "Weekly newsletter", snippet: "Unsubscribe at any time", sentAt: new Date() },
        { providerMessageId: "m-3", from: { email: "bob@example.com" }, subject: "Lunch tomorrow?", snippet: "Hey, free for lunch tomorrow?", sentAt: new Date() },
      ],
    }
    const result = await ai.prioritize(input)
    expect(() => prioritizeOutputSchema.parse(result)).not.toThrow()
    expect(result.results).toHaveLength(3)
    expect(result.results[0].priority).toBe("URGENT")
    expect(result.results[1].priority).toBe("NOISE")
    expect(result.results[2].priority).toBe("NORMAL")
  })

  it("prioritize result IDs match input IDs", async () => {
    const input = {
      messages: [
        { providerMessageId: "abc-123", from: { email: "x@y.com" }, subject: "Hello", snippet: "Hi there", sentAt: new Date() },
      ],
    }
    const result = await ai.prioritize(input)
    expect(result.results[0].providerMessageId).toBe("abc-123")
  })
})

describe("AI output schemas", () => {
  it("summarizeOutputSchema rejects missing summary", () => {
    expect(() => summarizeOutputSchema.parse({ keyPoints: [] })).toThrow()
  })

  it("draftReplyOutputSchema rejects fewer than 3 drafts", () => {
    expect(() =>
      draftReplyOutputSchema.parse({ drafts: [{ label: "a", bodyText: "b" }] })
    ).toThrow()
  })

  it("prioritizeOutputSchema rejects invalid priority", () => {
    expect(() =>
      prioritizeOutputSchema.parse({
        results: [{ providerMessageId: "x", priority: "INVALID", reason: "test" }],
      })
    ).toThrow()
  })
})
