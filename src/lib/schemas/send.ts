import { z } from "zod"

const addressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
})

export const sendSchema = z.object({
  mailAccountId: z.string().min(1),
  to: z.array(addressSchema).min(1, "At least one recipient required"),
  cc: z.array(addressSchema).optional(),
  bcc: z.array(addressSchema).optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyText: z.string().min(1, "Body is required"),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
})
