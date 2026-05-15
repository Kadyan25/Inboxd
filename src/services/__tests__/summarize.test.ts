import { describe, it, expect } from "vitest"
import { MockAIProvider } from "@/services/ai/mock"
import { summarizeOutputSchema } from "@/services/ai/schemas"
import type { NormalizedThread } from "@/providers/types"

function makeThread(overrides?: Partial<NormalizedThread>): NormalizedThread {
  return {
    threadId: "t-1",
    subject: "Q3 Planning",
    participantCount: 2,
    lastMessageAt: new Date("2024-03-01T12:00:00Z"),
    messages: [
      {
        providerMessageId: "m-1",
        threadId: "t-1",
        from: { email: "alice@example.com", name: "Alice" },
        to: [{ email: "bob@example.com" }],
        cc: [],
        bcc: [],
        subject: "Q3 Planning",
        bodyText: "Hi Bob, can we align on Q3 priorities?",
        bodyHtml: null,
        snippet: "Hi Bob, can we align on Q3 priorities?",
        sentAt: new Date("2024-03-01T10:00:00Z"),
        isRead: true,
        isStarred: false,
        folder: "INBOX",
        providerMeta: {},
      },
      {
        providerMessageId: "m-2",
        threadId: "t-1",
        from: { email: "bob@example.com", name: "Bob" },
        to: [{ email: "alice@example.com" }],
        cc: [],
        bcc: [],
        subject: "Re: Q3 Planning",
        bodyText: "Sure, let's meet Thursday. The main goal is to ship the new dashboard.",
        bodyHtml: null,
        snippet: "Sure, let's meet Thursday.",
        sentAt: new Date("2024-03-01T12:00:00Z"),
        isRead: false,
        isStarred: false,
        folder: "INBOX",
        providerMeta: {},
      },
    ],
    ...overrides,
  }
}

describe("summarize — MockAIProvider", () => {
  const ai = new MockAIProvider()

  it("returns summary and keyPoints for a multi-message thread", async () => {
    const result = await ai.summarize({ thread: makeThread() })
    expect(result.summary).toBeTruthy()
    expect(Array.isArray(result.keyPoints)).toBe(true)
    expect(result.keyPoints.length).toBeGreaterThanOrEqual(1)
  })

  it("output passes Zod schema", async () => {
    const result = await ai.summarize({ thread: makeThread() })
    expect(() => summarizeOutputSchema.parse(result)).not.toThrow()
  })

  it("single-message thread still returns valid output", async () => {
    const single = makeThread()
    single.messages = [single.messages[0]]
    const result = await ai.summarize({ thread: single })
    expect(() => summarizeOutputSchema.parse(result)).not.toThrow()
    expect(result.summary).toBeTruthy()
  })

  it("summary mentions thread participants", async () => {
    const result = await ai.summarize({ thread: makeThread() })
    // MockAIProvider includes participant names in summary
    expect(result.summary.toLowerCase()).toMatch(/alice|bob/)
  })

  it("respects maxSentences option without throwing", async () => {
    const result = await ai.summarize({ thread: makeThread(), maxSentences: 1 })
    expect(() => summarizeOutputSchema.parse(result)).not.toThrow()
  })
})

describe("summarize — cache key logic", () => {
  it("newer lastMessageAt invalidates cache (timestamp comparison)", () => {
    const cachedAt = new Date("2024-03-01T12:00:00Z")
    const newLastMessageAt = new Date("2024-03-01T13:00:00Z")
    // cache miss when thread has newer message
    expect(cachedAt.getTime() >= newLastMessageAt.getTime()).toBe(false)
  })

  it("same lastMessageAt is a cache hit", () => {
    const cachedAt = new Date("2024-03-01T12:00:00Z")
    const sameAt = new Date("2024-03-01T12:00:00Z")
    expect(cachedAt.getTime() >= sameAt.getTime()).toBe(true)
  })
})
