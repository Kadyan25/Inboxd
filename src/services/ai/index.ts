import type { AIProvider } from "./types"
import { MockAIProvider } from "./mock"
import { ClaudeProvider } from "./claude"
import { OpenAIProvider } from "./openai"

export function getAIProvider(): AIProvider {
  const choice = process.env.AI_PROVIDER ?? "mock"
  switch (choice) {
    case "claude":
      return new ClaudeProvider()
    case "openai":
      return new OpenAIProvider()
    default:
      return new MockAIProvider()
  }
}

export type { AIProvider }
export type { SummarizeInput, SummarizeOutput, DraftReplyInput, DraftReplyOutput, PrioritizeInput, PrioritizeOutput } from "./types"
