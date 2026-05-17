import { describe, it, expect } from "vitest"
import { sendSchema } from "@/lib/schemas/send"

describe("sendSchema", () => {
  const valid = {
    mailAccountId: "acc-1",
    to: [{ email: "bob@example.com" }],
    subject: "Hello",
    bodyText: "Hi there",
  }

  it("accepts a minimal valid payload", () => {
    expect(sendSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts optional cc/bcc/threadId/inReplyTo", () => {
    const result = sendSchema.safeParse({
      ...valid,
      cc: [{ email: "cc@example.com", name: "CC Person" }],
      bcc: [{ email: "bcc@example.com" }],
      threadId: "thread-1",
      inReplyTo: "msg-1",
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty to array", () => {
    const result = sendSchema.safeParse({ ...valid, to: [] })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email in to", () => {
    const result = sendSchema.safeParse({ ...valid, to: [{ email: "not-an-email" }] })
    expect(result.success).toBe(false)
  })

  it("rejects missing subject", () => {
    const result = sendSchema.safeParse({ ...valid, subject: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing body", () => {
    const result = sendSchema.safeParse({ ...valid, bodyText: "" })
    expect(result.success).toBe(false)
  })

  it("rejects missing mailAccountId", () => {
    const result = sendSchema.safeParse({ ...valid, mailAccountId: "" })
    expect(result.success).toBe(false)
  })
})
