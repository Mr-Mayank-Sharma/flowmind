import { test, expect } from "@playwright/test";

test("API health endpoint returns ok", async ({ request }) => {
  const resp = await request.get("http://localhost:3001/health");
  expect(resp.ok()).toBe(true);
  const body = await resp.json();
  expect(body).toMatchObject({ status: "ok", version: "0.1.0" });
  expect(typeof body.uptime).toBe("number");
});

test("Login page loads and shows sign-in form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("text=Welcome back").or(page.locator("text=Sign In"))).toBeVisible({ timeout: 10_000 });
});

test("Metrics endpoint returns prometheus format", async ({ request }) => {
  const resp = await request.get("http://localhost:3001/metrics");
  expect(resp.ok()).toBe(true);
  const text = await resp.text();
  expect(text).toContain("nodejs_version_info");
  expect(resp.headers()["content-type"]).toBe("text/plain; charset=utf-8");
});
