import { test, expect } from "@playwright/test"

test("sign-in page renders", async ({ page }) => {
  await page.goto("/sign-in")
  await expect(page.getByRole("heading", { name: "Inboxd" })).toBeVisible()
  await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible()
})

test("root redirects to inbox then to sign-in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/sign-in/)
})
