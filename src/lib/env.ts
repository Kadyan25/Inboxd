import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MOCK_MODE: z
    .string()
    .transform((v) => v === "true")
    .default(false),

  DATABASE_URL: z.string().min(1),

  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
})

// Validate once at module load — throws on misconfiguration
const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error("Invalid environment variables:", _env.error.flatten().fieldErrors)
  throw new Error("Invalid environment variables")
}

export const env = _env.data

export const isMockMode = env.MOCK_MODE
