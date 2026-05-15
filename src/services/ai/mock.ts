import type { AIProvider, SummarizeInput, SummarizeOutput, DraftReplyInput, DraftReplyOutput, PrioritizeInput, PrioritizeOutput } from "./types"

const URGENT_SIGNALS = ["urgent", "asap", "deadline", "action required", "security alert", "overdue", "expires"]
const NOISE_SIGNALS = ["unsubscribe", "newsletter", "offer", "sale", "% off", "deal", "promo", "marketing", "no-reply"]

function guessPriority(subject: string | null, snippet: string): "URGENT" | "NORMAL" | "LOW" | "NOISE" {
  const text = `${subject ?? ""} ${snippet}`.toLowerCase()
  if (NOISE_SIGNALS.some((s) => text.includes(s))) return "NOISE"
  if (URGENT_SIGNALS.some((s) => text.includes(s))) return "URGENT"
  if (text.includes("fyi") || text.includes("newsletter") || text.includes("update")) return "LOW"
  return "NORMAL"
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock" as const

  async summarize(input: SummarizeInput): Promise<SummarizeOutput> {
    const { thread } = input
    const participants = thread.messages.map((m) => m.from.name ?? m.from.email).join(", ")
    return {
      summary: `This thread between ${participants} covers: ${thread.subject ?? "an ongoing topic"}. ${thread.messages.length} message(s) exchanged.`,
      keyPoints: [
        `${thread.messages.length} message(s) in thread`,
        `Last message from ${thread.messages[thread.messages.length - 1]?.from.name ?? "unknown"}`,
      ],
    }
  }

  async draftReplies(input: DraftReplyInput): Promise<DraftReplyOutput> {
    const lastMsg = input.thread.messages[input.thread.messages.length - 1]
    const sender = lastMsg?.from.name ?? lastMsg?.from.email ?? "there"
    return {
      drafts: [
        {
          label: "Acknowledge and confirm",
          bodyText: `Hi ${sender},\n\nThanks for reaching out. I've received your message and will follow up shortly.\n\nBest regards`,
        },
        {
          label: "Ask for more info",
          bodyText: `Hi ${sender},\n\nThanks for your message. Could you provide more details so I can help you better?\n\nBest regards`,
        },
        {
          label: "Politely decline",
          bodyText: `Hi ${sender},\n\nThank you for getting in touch. Unfortunately I'm not able to assist with this at this time.\n\nBest regards`,
        },
      ],
    }
  }

  async prioritize(input: PrioritizeInput): Promise<PrioritizeOutput> {
    return {
      results: input.messages.map((m) => {
        const priority = guessPriority(m.subject, m.snippet)
        return {
          providerMessageId: m.providerMessageId,
          priority,
          reason: `Classified as ${priority.toLowerCase()} based on subject and content signals.`,
        }
      }),
    }
  }
}
