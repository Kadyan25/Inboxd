import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { SignInButton } from "./sign-in-button"

export default async function SignInPage() {
  const session = await getServerSession(authOptions)
  if (session) redirect("/inbox")

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Inboxd</h1>
          <p className="text-sm text-muted-foreground">
            Your AI-first universal inbox
          </p>
        </div>
        <SignInButton />
      </div>
    </main>
  )
}
