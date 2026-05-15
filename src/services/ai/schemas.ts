import { z } from "zod"

export const summarizeOutputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
})

export const draftReplySchema = z.object({
  label: z.string(),
  bodyText: z.string(),
})

export const draftReplyOutputSchema = z.object({
  drafts: z.array(draftReplySchema).length(3),
})

export const prioritizedMessageSchema = z.object({
  providerMessageId: z.string(),
  priority: z.enum(["URGENT", "NORMAL", "LOW", "NOISE"]),
  reason: z.string(),
})

export const prioritizeOutputSchema = z.object({
  results: z.array(prioritizedMessageSchema),
})
