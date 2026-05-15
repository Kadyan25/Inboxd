import { describe, it, expect, vi, beforeEach } from "vitest"

const VALID_ENV = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  NEXTAUTH_URL: "http://localhost:3000",
  NEXTAUTH_SECRET: "testsecret",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  ENCRYPTION_KEY: "a".repeat(64),
}

describe("env validation", () => {
  beforeEach(() => {
    vi.resetModules()
    for (const [k, v] of Object.entries(VALID_ENV)) vi.stubEnv(k, v)
  })

  it("loads successfully with required vars present", async () => {
    const { env } = await import("@/lib/env")
    expect(env.NEXTAUTH_URL).toBe("http://localhost:3000")
  })

  it("defaults MOCK_MODE to false", async () => {
    vi.stubEnv("MOCK_MODE", "false")
    const { env } = await import("@/lib/env")
    expect(env.MOCK_MODE).toBe(false)
  })

  it("parses MOCK_MODE=true as boolean true", async () => {
    vi.stubEnv("MOCK_MODE", "true")
    const { env } = await import("@/lib/env")
    expect(env.MOCK_MODE).toBe(true)
  })
})
