import { describe, it, expect } from "vitest"
import { MockAIProvider } from "@/services/ai/mock"
import { draftReplyOutputSchema } from "@/services/ai/schemas"
import type { NormalizedThread } from "@/providers/types"

function makeThread(): NormalizedThread {
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
        bodyText: "Hi Bob, can we sync on Q3 priorities this week?",
        bodyHtml: null,
        snippet: "Hi Bob, can we sync on Q3 priorities this week?",
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
        bodyText: "Sure! Thursday works. What agenda items do you have in mind?",
        bodyHtml: null,
        snippet: "Sure! Thursday works.",
        sentAt: new Date("2024-03-01T12:00:00Z"),
        isRead: false,
        isStarred: false,
        folder: "INBOX",
        providerMeta: {},
      },
    ],
  }
}

describe("draftReplies — MockAIProvider", () => {
  const ai = new MockAIProvider()

  it("returns exactly 3 drafts", async () => {
    const result = await ai.draftReplies({ thread: makeThread() })
    expect(result.drafts).toHaveLength(3)
  })

  it("output passes Zod schema", async () => {
    const result = await ai.draftReplies({ thread: makeThread() })
    expect(() => draftReplyOutputSchema.parse(result)).not.toThrow()
  })

  it("each draft has a non-empty label and bodyText", async () => {
    const result = await ai.draftReplies({ thread: makeThread() })
    for (const draft of result.drafts) {
      expect(draft.label.trim()).toBeTruthy()
      expect(draft.bodyText.trim()).toBeTruthy()
    }
  })

  it("drafts have meaningfully different labels", async () => {
    const result = await ai.draftReplies({ thread: makeThread() })
    const labels = result.drafts.map((d) => d.label)
    const unique = new Set(labels)
    expect(unique.size).toBe(3)
  })

  it("bodyText includes a greeting referencing the sender", async () => {
    const result = await ai.draftReplies({ thread: makeThread() })
    // MockAIProvider uses the sender name in greetings
    const allBodies = result.drafts.map((d) => d.bodyText).join(" ").toLowerCase()
    expect(allBodies).toMatch(/bob|there/)
  })
})
