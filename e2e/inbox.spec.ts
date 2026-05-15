import { test, expect } from "@playwright/test"

// These tests run against the app in mock mode (MOCK_MODE=true)
// They require the dev server to be running

test.describe("inbox flow", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to sign-in page
    await page.goto("/sign-in")
  })

  test("unauthenticated user is redirected to sign-in", async ({ page }) => {
    await page.goto("/inbox")
    await expect(page).toHaveURL(/sign-in/)
    await expect(page.getByRole("heading", { name: "Inboxd" })).toBeVisible()
  })

  test("sign-in page has Google button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sign in with google/i })).toBeVisible()
  })
})
