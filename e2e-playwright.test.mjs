import { test } from "node:test";
import assert from "node:assert";
import { chromium } from "playwright";

test("Playwright End-to-End Suite: Advance Pay Complete Multi-Tenant Verification", async (t) => {
  const browser = await chromium.launch({ headless: true });

  const owner1 = {
    name: "Aadya Boutique Head",
    businessName: "Aadya Silks & Weaves",
    email: `aadya_${Date.now()}@e2eboutique.com`,
    phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "Password123!Aadya",
  };

  const owner2 = {
    name: "Bhavna Designer Head",
    businessName: "", // Test case 1: empty business name
    email: `bhavna_${Date.now()}@e2eboutique.com`,
    phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "Password123!Bhavna",
  };

  const owner3Whitespace = {
    name: "Charu Couture Head",
    businessName: "   ", // Test case 3: whitespace-only business name
    email: `charu_${Date.now()}@e2eboutique.com`,
    phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "Password123!Charu",
  };

  await t.test("Workflow 1: Register Owner 1 (Desktop 1440x900) with Business Name", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Click register toggle
    await page.getByRole("button", { name: /Create Account|Register/i }).first().click();
    await page.waitForSelector("input[placeholder='e.g. Anusha Rao']");

    // Fill form
    await page.fill("input[placeholder='e.g. Anusha Rao']", owner1.name);
    await page.fill("input[placeholder='e.g. Anusha Haute Couture']", owner1.businessName);
    await page.fill("input[placeholder='owner@yourboutique.com']", owner1.email);
    await page.fill("input[placeholder='e.g. 9876543210']", owner1.phone);
    await page.fill("input[placeholder='••••••••••••'] >> nth=0", owner1.password);
    await page.fill("input[placeholder='••••••••••••'] >> nth=1", owner1.password);

    await page.click("button[type='submit']");

    // Wait for automatic redirect directly to owner dashboard
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    const content = await page.content();
    assert.ok(content.includes(owner1.email), "Should automatically authenticate and show dashboard with owner1 email");

    // Verify session persistence across page reload
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    const reloadedContent = await page.content();
    assert.ok(reloadedContent.includes(owner1.email), "Session should persist after refresh");

    // Verify logout works
    const avatar = page.locator("button[aria-label='Owner profile menu']");
    if (await avatar.isVisible()) await avatar.click();
    await page.click("button:has-text('Sign Out')");
    await page.waitForSelector("button:has-text('Sign In')", { timeout: 10000 });
    const loggedOutContent = await page.content();
    assert.ok(loggedOutContent.includes("Owner Dashboard Login"), "Logout should return to login view");

    await page.close();
  });

  await t.test("Workflow 2: Register Owner 2 (Mobile 390x844) with EMPTY Business Name", async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Create Account|Register/i }).first().click();
    await page.waitForSelector("input[placeholder='e.g. Anusha Rao']");

    // Fill form without business name
    await page.fill("input[placeholder='e.g. Anusha Rao']", owner2.name);
    await page.fill("input[placeholder='owner@yourboutique.com']", owner2.email);
    await page.fill("input[placeholder='e.g. 9876543210']", owner2.phone);
    await page.fill("input[placeholder='••••••••••••'] >> nth=0", owner2.password);
    await page.fill("input[placeholder='••••••••••••'] >> nth=1", owner2.password);

    await page.click("button[type='submit']");
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });

    // Verify registration succeeded and directly opened dashboard
    const content = await page.content();
    assert.ok(content.includes(owner2.email));

    // Sign out so subsequent tests can log in
    const avatar = page.locator("button[aria-label='Owner profile menu']");
    if (await avatar.isVisible()) await avatar.click();
    await page.click("button:has-text('Sign Out')");
    await page.waitForSelector("button:has-text('Sign In')", { timeout: 10000 });

    await page.close();
  });

  await t.test("Workflow 3: Register Owner 3 with WHITESPACE-ONLY Business Name", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Create Account|Register/i }).first().click();
    await page.waitForSelector("input[placeholder='e.g. Anusha Rao']");

    await page.fill("input[placeholder='e.g. Anusha Rao']", owner3Whitespace.name);
    await page.fill("input[placeholder='e.g. Anusha Haute Couture']", owner3Whitespace.businessName);
    await page.fill("input[placeholder='owner@yourboutique.com']", owner3Whitespace.email);
    await page.fill("input[placeholder='e.g. 9876543210']", owner3Whitespace.phone);
    await page.fill("input[placeholder='••••••••••••'] >> nth=0", owner3Whitespace.password);
    await page.fill("input[placeholder='••••••••••••'] >> nth=1", owner3Whitespace.password);

    await page.click("button[type='submit']");
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });

    const content = await page.content();
    assert.ok(content.includes(owner3Whitespace.email));

    const avatar = page.locator("button[aria-label='Owner profile menu']");
    if (await avatar.isVisible()) await avatar.click();
    await page.click("button:has-text('Sign Out')");
    await page.waitForSelector("button:has-text('Sign In')", { timeout: 10000 });

    await page.close();
  });

  await t.test("Workflow 4: Rejects Duplicate Email on Registration", async () => {
    const page = await browser.newPage();
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Create Account|Register/i }).first().click();
    await page.waitForSelector("input[placeholder='e.g. Anusha Rao']");

    await page.fill("input[placeholder='e.g. Anusha Rao']", "Duplicate Test");
    await page.fill("input[placeholder='owner@yourboutique.com']", owner1.email); // Same email as Owner 1
    await page.fill("input[placeholder='e.g. 9876543210']", "9555555555");
    await page.fill("input[placeholder='••••••••••••'] >> nth=0", "Password123!");
    await page.fill("input[placeholder='••••••••••••'] >> nth=1", "Password123!");

    await page.click("button[type='submit']");
    await page.waitForTimeout(1000);

    const bannerText = await page.locator(".api-error-banner").innerText();
    assert.ok(bannerText.includes("already exists"), "Should show email already exists error");

    await page.close();
  });

  await t.test("Workflow 5: Owner 1 Logs In, Creates Customer & Order, Verifies Dashboard & Public Tracking", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Fill login form
    await page.fill("input[type='email']", owner1.email);
    await page.fill("input[type='password']", owner1.password);
    await page.click("button[type='submit']");

    // Wait for Dashboard to render
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    const headerContent = await page.content();
    assert.ok(headerContent.includes(owner1.email));

    // Create a customer
    await page.fill("input[placeholder='Customer name']", "Pooja Hegde");
    await page.fill("input[placeholder*='Phone number']", "9811122233");
    await page.fill("input[placeholder*='Email address']", "pooja.hegde@example.com");
    await page.click("button:has-text('Add Customer')");
    await page.waitForTimeout(1000);

    // Select the newly created customer from select dropdown (Format: "{name} - {phone}")
    const selectCustomer = page.locator("form:has-text('Create Order') select");
    await selectCustomer.selectOption({ label: "Pooja Hegde - 9811122233" });

    // Create an order for this customer
    await page.fill("input[placeholder='Item name']", "Embroidered Silk Saree");
    await page.fill("input[placeholder='Total amount (₹)']", "25000");
    await page.fill("input[placeholder='Advance amount (₹)']", "10000");
    await page.fill("input[type='date']", "2026-12-15");
    await page.click("button:has-text('Create Order')");
    await page.waitForTimeout(1500);

    // Record cash payment of 5000
    const cashInput = page.locator("input[placeholder='Enter cash amount in ₹']").first();
    if (await cashInput.isVisible()) {
      await cashInput.fill("5000");
      await page.click("button:has-text('Record Cash Payment')");
      await page.waitForTimeout(1000);
    }

    // Verify Dashboard Metrics
    const dashboardText = await page.content();
    assert.ok(dashboardText.includes("Embroidered Silk Saree"));
    assert.ok(dashboardText.includes("Pooja Hegde"));

    // Click "View Details" to expand the OrderCard
    await page.click("button:has-text('View Details')");
    await page.waitForTimeout(500);

    // Extract tracking link from the tracking input
    const trackingInput = page.locator("input[value*='/track/']").first();
    await trackingInput.waitFor({ state: "visible", timeout: 5000 });
    const trackingUrl = await trackingInput.inputValue();
    assert.ok(trackingUrl && trackingUrl.includes("/track/"));

    // Open public tracking link in fresh page without auth
    const trackingPage = await browser.newPage();
    await trackingPage.goto(trackingUrl, { waitUntil: "networkidle" });
    const trackingBodyText = await trackingPage.locator("body").innerText();
    assert.ok(trackingBodyText.includes("Embroidered Silk Saree"));
    assert.ok(trackingBodyText.includes("Aadya Silks & Weaves"));
    assert.ok(!trackingBodyText.includes("Owner Dashboard Login")); // public tracking must not require login
    await trackingPage.close();

    // Logout
    const avatar = page.locator("button[aria-label='Owner profile menu']");
    if (await avatar.isVisible()) await avatar.click();
    await page.click("button:has-text('Sign Out')");
    await page.waitForTimeout(1000);
    assert.ok((await page.content()).includes("Owner Dashboard Login"));

    await page.close();
  });

  await t.test("Workflow 6: Owner 2 Logs In & Verifies Strict Tenant Data Isolation", async () => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Login as Owner 2
    await page.fill("input[type='email']", owner2.email);
    await page.fill("input[type='password']", owner2.password);
    await page.click("button[type='submit']");

    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    const owner2Content = await page.content();

    // Verify Owner 2 CANNOT see Owner 1's customer, order, or amounts
    assert.ok(!owner2Content.includes("Pooja Hegde"), "Owner 2 must not see Owner 1 customer");
    assert.ok(!owner2Content.includes("Embroidered Silk Saree"), "Owner 2 must not see Owner 1 order");
    assert.ok(!owner2Content.includes("Aadya Silks & Weaves"), "Owner 2 must not see Owner 1 business name");

    await page.close();
  });

  await browser.close();
});

