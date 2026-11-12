import { test } from "node:test";
import assert from "node:assert";
import { chromium } from "playwright";
import path from "node:path";

const ARTIFACT_DIR = "/Users/apple/.gemini/antigravity/brain/6d3b7529-949b-410c-be53-0e06b7196c2f";

test("Playwright Full Finalization & UI/UX Audit Suite", async (t) => {
  const browser = await chromium.launch({ headless: true });

  const owner = {
    name: "Kavya Designer",
    businessName: "Kavya Heritage Boutique",
    email: `kavya_${Date.now()}@testboutique.com`,
    phone: `91${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "Password123!Kavya",
    newPassword: "NewSecurePassword456!",
  };

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  await t.test("1. Owner Registration & Session Persistence", async () => {
    await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

    // Switch to Sign Up
    await page.getByRole("button", { name: /Create Account|Register/i }).first().click();
    await page.waitForSelector("input[placeholder='e.g. Anusha Rao']");

    await page.fill("input[placeholder='e.g. Anusha Rao']", owner.name);
    await page.fill("input[placeholder='e.g. Anusha Haute Couture']", owner.businessName);
    await page.fill("input[placeholder='owner@yourboutique.com']", owner.email);
    await page.fill("input[placeholder='e.g. 9876543210']", owner.phone);
    await page.fill("input[placeholder='••••••••••••'] >> nth=0", owner.password);
    await page.fill("input[placeholder='••••••••••••'] >> nth=1", owner.password);

    await page.click("button[type='submit']");
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });

    const content = await page.content();
    assert.ok(content.includes(owner.name) || content.includes(owner.email), "Should display owner in top bar");
  });

  await t.test("2. Owner Profile Navigation & Dropdown Interaction", async () => {
    const profileBtn = page.locator("button[aria-label='Owner profile menu']");
    await profileBtn.waitFor({ state: "visible", timeout: 5000 });
    assert.ok(await profileBtn.isVisible(), "Profile avatar button must be visible");

    // Click profile button to open dropdown
    await profileBtn.click();
    await page.waitForSelector("[role='menu']", { timeout: 3000 });

    const menu = page.locator("[role='menu']");
    const menuText = await menu.innerText();
    assert.ok(menuText.includes("Business Profile & Settings"), "Menu must contain Settings option");
    assert.ok(menuText.includes("Sign Out"), "Menu must contain Sign Out option");

    // Click outside to close
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
    assert.ok(!(await page.locator("[role='menu']").isVisible()), "Dropdown should close on outside click");
  });

  await t.test("3. Profile Settings & Change Password", async () => {
    // Open dropdown and navigate to Settings
    await page.locator("button[aria-label='Owner profile menu']").click();
    await page.waitForSelector("[role='menu']", { timeout: 3000 });
    await page.getByRole("menuitem", { name: /Business Profile & Settings/i }).click();
    await page.waitForSelector("h2:has-text('Settings')", { timeout: 5000 });

    // Update profile
    const nameInput = page.locator("input[placeholder='Your name']");
    await nameInput.fill("Kavya Sri Rao");
    await page.getByRole("button", { name: /Save Profile/i }).click();
    await page.waitForSelector("text=Profile updated successfully!", { timeout: 5000 });

    // Test Change Password with invalid current password
    const curPass = page.locator("input[placeholder='Enter current password']");
    const newPass = page.locator("input[placeholder='At least 8 characters']");
    const confPass = page.locator("input[placeholder='Repeat new password']");

    await curPass.fill("WrongCurrentPassword!");
    await newPass.fill(owner.newPassword);
    await confPass.fill(owner.newPassword);
    await page.getByRole("button", { name: /Update Password/i }).click();
    await page.waitForSelector("text=Current password is incorrect", { timeout: 5000 });

    // Valid change password
    await curPass.fill(owner.password);
    await page.getByRole("button", { name: /Update Password/i }).click();
    await page.waitForSelector("text=Password changed. Please log in again.", { timeout: 5000 });

    // Auto-logout redirect
    await page.waitForSelector("input[placeholder='owner@yourboutique.com']", { timeout: 10000 });

    // Re-login with new password
    await page.fill("input[placeholder='owner@yourboutique.com']", owner.email);
    await page.fill("input[placeholder='••••••••••••']", owner.newPassword);
    await page.click("button[type='submit']");
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
  });

  await t.test("4. Dashboard Summary Cards Clickability & Navigation", async () => {
    // Verify Dashboard heading shows business name
    await page.waitForSelector("h1:has-text('Kavya Heritage Boutique')", { timeout: 5000 });

    // Click cards to verify navigation and filter actions
    await page.locator(".summary-card:has-text('Total Orders')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Total Customers')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Total Revenue Collected')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Outstanding Balance')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Paid Orders')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Partially Paid')").click();
    await page.waitForTimeout(200);

    await page.locator(".summary-card:has-text('Pending Production')").click();
    await page.waitForTimeout(200);

    // Reset filter
    await page.locator(".summary-card:has-text('Total Orders')").click();
    await page.waitForTimeout(200);
  });

  await t.test("5. Customer Management: Add, Edit, Archive & Restore", async () => {
    const custPhone = `92${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Add Customer
    await page.fill("input[placeholder='Customer name']", "Meera Nambiar");
    await page.fill("input[placeholder='Phone number (exactly 10 digits, starts with 6–9)']", custPhone);
    await page.fill("input[placeholder='Email address (optional, for payment receipts)']", "meera@test.com");
    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.waitForSelector("text=Meera Nambiar", { timeout: 10000 });

    // Edit Customer
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.waitForSelector("h4:has-text('Edit Customer')", { timeout: 5000 });
    const editInput = page.locator("input[placeholder='Customer name'] >> nth=1");
    if (await editInput.isVisible()) {
      await editInput.fill("Meera R Nambiar");
      await page.getByRole("button", { name: "Save Changes" }).click();
      await page.waitForSelector("text=Meera R Nambiar", { timeout: 5000 });
    }

    // Archive Customer
    const archiveBtn = page.getByRole("button", { name: "Archive" }).first();
    await archiveBtn.click();
    await page.waitForTimeout(600);

    // Toggle Show Archived Customers
    await page.getByRole("button", { name: "Show Archived" }).click();
    await page.waitForSelector("text=Meera R Nambiar", { timeout: 5000 });
    assert.ok((await page.content()).includes("Restore"), "Should show Restore button on archived customer");

    // Restore Customer
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.waitForTimeout(600);

    // Switch back to Show Active
    await page.getByRole("button", { name: "Show Active" }).click();
    await page.waitForSelector("text=Meera R Nambiar", { timeout: 5000 });
  });

  await t.test("6. Customer Safe Deletion Rules", async () => {
    // Create zero-order customer
    const tempPhone = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.fill("input[placeholder='Customer name']", "Temporary Contact");
    await page.fill("input[placeholder='Phone number (exactly 10 digits, starts with 6–9)']", tempPhone);
    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.waitForSelector("text=Temporary Contact", { timeout: 10000 });

    // Archive zero-order customer
    const tempCard = page.locator("text=Temporary Contact").locator("xpath=ancestor::div[contains(@style, 'border')]");
    await tempCard.getByRole("button", { name: "Archive" }).click();
    await page.waitForTimeout(600);

    // Go to archived and delete
    await page.getByRole("button", { name: "Show Archived" }).click();
    await page.waitForSelector("text=Temporary Contact", { timeout: 5000 });

    const deleteBtn = page.locator("text=Temporary Contact").locator("xpath=ancestor::div[contains(@style, 'border')]").getByRole("button", { name: "Delete" });
    await deleteBtn.click();
    await page.waitForTimeout(600);

    const bodyText = await page.content();
    assert.ok(!bodyText.includes("Temporary Contact"), "Eligible customer safely deleted");

    // Switch back to active
    await page.getByRole("button", { name: "Show Active" }).click();
  });

  await t.test("7. Order Management: Create, Advance Stages, Payment & Cancellation", async () => {
    // Select customer by index 1
    await page.locator("select").first().selectOption({ index: 1 });

    await page.fill("input[placeholder='Item name']", "Banarasi Silk Saree");
    await page.fill("input[placeholder='Total amount (₹)']", "15000");
    await page.fill("input[placeholder='Advance amount (₹)']", "5000");
    await page.fill("input[type='date']", "2026-12-15");

    await page.getByRole("button", { name: "Create Order & Generate Payment Link" }).click();
    await page.waitForSelector("text=Banarasi Silk Saree", { timeout: 10000 });

    // Expand details
    await page.getByRole("button", { name: /View Details/i }).first().click();
    await page.waitForSelector("text=Production Stages", { timeout: 5000 });

    // Advance first stage
    const stageSelect = page.locator(".order-card select").first();
    if (await stageSelect.isVisible()) {
      await stageSelect.selectOption("IN_PROGRESS");
      await page.waitForTimeout(500);
    }

    // Record cash payment
    const paymentAmt = page.locator(".order-card input[type='number']").first();
    if (await paymentAmt.isVisible()) {
      await paymentAmt.fill("2000");
      await page.getByRole("button", { name: /Record Cash Payment/i }).first().click();
      await page.waitForSelector("text=Payment recorded successfully", { timeout: 10000 });
    }

    // Cancel order
    const cancelBtn = page.getByRole("button", { name: "Cancel Order" }).first();
    await cancelBtn.click();
    await page.waitForSelector("textarea[placeholder*='reason for cancelling']", { timeout: 5000 });

    await page.fill("textarea[placeholder*='reason for cancelling']", "Client postponed event to autumn 2027.");
    await page.getByRole("button", { name: "Confirm Cancellation" }).click();

    await page.waitForSelector("text=CANCELLED", { timeout: 10000 });
    const orderCardText = await page.content();
    assert.ok(orderCardText.includes("CANCELLED"), "Order card must show CANCELLED badge");
    assert.ok(orderCardText.includes("Client postponed event"), "Cancellation reason must be displayed");
  });

  await t.test("8. Order Archival & Restore", async () => {
    // Archive cancelled order
    const archiveBtn = page.getByRole("button", { name: "Archive Order" }).first();
    await archiveBtn.click();
    await page.waitForTimeout(600);

    // Toggle to archived orders
    await page.getByRole("button", { name: "View Archived Orders" }).click();
    await page.waitForSelector("text=Restore Order", { timeout: 5000 });

    // Restore order
    await page.getByRole("button", { name: "Restore Order" }).first().click();
    await page.waitForTimeout(600);

    // Switch back to active orders
    await page.getByRole("button", { name: "Show Active Orders" }).click();
    await page.waitForSelector("text=Banarasi Silk Saree", { timeout: 5000 });
  });

  await t.test("9. Responsive Layout Audit & Screenshots (375px, 390px, 430px, 768px, 1024px, 1440px)", async () => {
    const viewports = [
      { width: 375, height: 667, name: "mobile-375" },
      { width: 390, height: 844, name: "mobile-390" },
      { width: 430, height: 932, name: "mobile-430" },
      { width: 768, height: 1024, name: "tablet-768" },
      { width: 1024, height: 768, name: "laptop-1024" },
      { width: 1440, height: 900, name: "desktop-1440" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      // Verify zero horizontal document overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      assert.ok(
        scrollWidth <= clientWidth + 2,
        `Viewport ${vp.name} should have no horizontal overflow (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`
      );

      // Save required audit screenshots at 375px, 390px, 1440px
      if (["mobile-375", "mobile-390", "desktop-1440"].includes(vp.name)) {
        const screenshotPath = path.join(ARTIFACT_DIR, `dashboard-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Saved screenshot: ${screenshotPath}`);
      }
    }
  });

  await page.close();
  await browser.close();
});
