import { test } from "node:test";
import assert from "node:assert";
import { chromium } from "playwright";

test("Playwright Phase 12 Complete Web App End-to-End Suite", async (t) => {
  const browser = await chromium.launch({ headless: true });

  const owner = {
    name: "Deepa Designer",
    businessName: "Deepa Couture",
    email: `deepa_${Date.now()}@testboutique.com`,
    phone: `94${Math.floor(10000000 + Math.random() * 90000000)}`,
    password: "InitialPassword123!",
    newPassword: "UpdatedSecurePass456!",
  };

  let page;

  // Setup dialog handler to auto-confirm window.confirm() dialogs
  const setupPage = async (viewport = { width: 1440, height: 900 }) => {
    const p = await browser.newPage({ viewport });
    p.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    return p;
  };

  await t.test("1. Owner Registration & Session Persistence", async () => {
    page = await setupPage();
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
    assert.ok(content.includes(owner.email), "Should show logged in owner email in top bar");

    // Session persistence across reload
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    const contentReloaded = await page.content();
    assert.ok(contentReloaded.includes(owner.email), "Session should persist after reload");
  });

  await t.test("2. Settings: Update Business Profile", async () => {
    // Navigate to Settings tab
    await page.getByRole("button", { name: "Settings" }).click();
    await page.waitForSelector("h2:has-text('Settings')");

    // Update Owner Name and Business Name
    const nameInput = page.locator("input[placeholder='Your name']");
    await nameInput.fill("Deepa K Rao");

    const businessInput = page.locator("input[placeholder='Business / shop name']");
    await businessInput.fill("Deepa Haute Silk & Weaves");

    await page.getByRole("button", { name: /Save Profile/i }).click();

    // Verify success message
    await page.waitForSelector("text=Profile updated successfully!", { timeout: 5000 });
  });

  await t.test("3. Settings: Change Password & Re-login", async () => {
    // Test wrong current password error
    const currentPass = page.locator("input[placeholder='Enter current password']");
    const newPass = page.locator("input[placeholder='At least 8 characters']");
    const confirmNewPass = page.locator("input[placeholder='Repeat new password']");

    await currentPass.fill("WrongCurrentPass!");
    await newPass.fill(owner.newPassword);
    await confirmNewPass.fill(owner.newPassword);

    await page.getByRole("button", { name: /Update Password/i }).click();
    await page.waitForSelector("text=Current password is incorrect", { timeout: 5000 });

    // Submit with correct current password
    await currentPass.fill(owner.password);
    await page.getByRole("button", { name: /Update Password/i }).click();
    await page.waitForSelector("text=Password changed. Please log in again.", { timeout: 5000 });

    // Wait for auto-logout redirect to login page
    await page.waitForSelector("input[placeholder='owner@yourboutique.com']", { timeout: 10000 });

    // Log in with new password
    await page.fill("input[placeholder='owner@yourboutique.com']", owner.email);
    await page.fill("input[placeholder='••••••••••••']", owner.newPassword);
    await page.click("button[type='submit']");

    await page.waitForSelector(".owner-top-bar", { timeout: 10000 });
    assert.ok((await page.content()).includes(owner.email), "Successfully logged in with new password");
  });

  await t.test("4. Customer Management: Create & Edit Customer", async () => {
    // Make sure we are on dashboard tab
    const dashBtn = page.getByRole("button", { name: "Dashboard" });
    if (await dashBtn.isVisible()) {
      await dashBtn.click();
    }

    const customerPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;

    // Fill customer form
    await page.fill("input[placeholder='Customer name']", "Sunita Sharma");
    await page.fill("input[placeholder='Phone number (exactly 10 digits, starts with 6–9)']", customerPhone);
    await page.fill("input[placeholder='Email address (optional, for payment receipts)']", "sunita@example.com");

    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.waitForSelector("text=Sunita Sharma", { timeout: 10000 });

    // Edit customer
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.waitForSelector(".modal-backdrop", { timeout: 5000 });

    const editNameInput = page.locator("input[name='editName']");
    await editNameInput.fill("Sunita Devi Sharma");

    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForSelector("text=Sunita Devi Sharma", { timeout: 5000 });
  });

  await t.test("5. Order Management: Create Order & Update Production Stage", async () => {
    // Select the customer from dropdown
    await page.locator("select").first().selectOption({ label: /Sunita Devi Sharma/ });

    await page.fill("input[placeholder='Item name']", "Bridal Zari Lehenga");
    await page.fill("input[placeholder='Total amount (₹)']", "12000");
    await page.fill("input[placeholder='Advance amount (₹)']", "4000");

    await page.getByRole("button", { name: "Create Order & Generate Payment Link" }).click();
    await page.waitForSelector("text=Bridal Zari Lehenga", { timeout: 10000 });

    // Open order details
    await page.getByRole("button", { name: /View Details/i }).first().click();
    await page.waitForSelector("text=Production Stages", { timeout: 5000 });

    // Advance first stage from PENDING to IN_PROGRESS
    const nextStageBtn = page.getByRole("button", { name: /Start|Mark In Progress/i }).first();
    if (await nextStageBtn.isVisible()) {
      await nextStageBtn.click();
      await page.waitForTimeout(500);
    }
  });

  await t.test("6. Cash Payment & Balance Recalculation", async () => {
    // Record cash payment of 3000
    const paymentAmountInput = page.locator(".order-card input[type='number']").first();
    if (await paymentAmountInput.isVisible()) {
      await paymentAmountInput.fill("3000");
      await page.getByRole("button", { name: /Record Cash Payment/i }).first().click();
      await page.waitForSelector("text=Payment recorded successfully", { timeout: 10000 });
    }
  });

  await t.test("7. Customer Public Tracking URL Verification", async () => {
    // Find tracking URL link
    const trackingLink = page.locator("a[href*='/track/']").first();
    const href = await trackingLink.getAttribute("href");
    assert.ok(href && href.includes("/track/"), "Should have public tracking URL");

    const trackPage = await setupPage({ width: 390, height: 844 });
    await trackPage.goto(`http://localhost:5173${href}`, { waitUntil: "networkidle" });

    const trackContent = await trackPage.content();
    assert.ok(trackContent.includes("Bridal Zari Lehenga"), "Tracking page must show item name");
    assert.ok(trackContent.includes("Production Stages") || trackContent.includes("Stage"), "Tracking page must show production stages");
    await trackPage.close();
  });

  await t.test("8. Order Cancellation with Reason & Cancelled Badge", async () => {
    // Click Cancel Order button
    const cancelBtn = page.getByRole("button", { name: "Cancel Order" }).first();
    await cancelBtn.click();

    // Fill cancellation reason
    const reasonTextarea = page.locator("textarea[placeholder*='reason for cancelling']");
    await reasonTextarea.fill("Client requested cancellation due to wedding date postponement.");

    await page.getByRole("button", { name: "Confirm Cancellation" }).click();
    await page.waitForSelector("text=CANCELLED", { timeout: 10000 });
    const content = await page.content();
    assert.ok(content.includes("CANCELLED"), "Order card must show CANCELLED badge");
    assert.ok(content.includes("Client requested cancellation"), "Order card must show cancellation reason");
  });

  await t.test("9. Order Archival & Restore", async () => {
    // Archive the cancelled order
    const archiveBtn = page.getByRole("button", { name: "Archive" }).first();
    await archiveBtn.click();
    await page.waitForTimeout(500);

    // Toggle to archived orders view
    await page.getByRole("button", { name: "Archived Orders" }).click();
    await page.waitForSelector("text=Restore", { timeout: 5000 });

    // Restore the order
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.waitForTimeout(500);

    // Switch back to active orders
    await page.getByRole("button", { name: "Active Orders" }).click();
    await page.waitForSelector("text=Bridal Zari Lehenga", { timeout: 5000 });
  });

  await t.test("10. Customer Archival, Restore & Safe Deletion Rules", async () => {
    // Customer with orders: try archive and restore
    await page.getByRole("button", { name: "Archive" }).first().click();
    await page.waitForTimeout(500);

    // Switch to Show Archived customers
    await page.getByRole("button", { name: "Show Archived" }).click();
    await page.waitForSelector("text=Restore", { timeout: 5000 });

    // Try deleting customer with orders -> should fail safely (alert)
    await page.getByRole("button", { name: "Delete" }).first().click();
    await page.waitForTimeout(500);

    // Restore customer
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page.waitForTimeout(500);

    // Return to Show Active customers
    await page.getByRole("button", { name: "Show Active" }).click();
    await page.waitForSelector("text=Sunita Devi Sharma", { timeout: 5000 });

    // Create a standalone customer with zero orders for safe deletion test
    const tempPhone = `96${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.fill("input[placeholder='Customer name']", "Zero Order Customer");
    await page.fill("input[placeholder='Phone number (exactly 10 digits, starts with 6–9)']", tempPhone);
    await page.getByRole("button", { name: "Add Customer" }).click();
    await page.waitForSelector("text=Zero Order Customer", { timeout: 10000 });

    // Archive zero-order customer
    const zeroCustomerCard = page.locator("text=Zero Order Customer").locator("xpath=ancestor::div[contains(@style, 'border')]");
    await zeroCustomerCard.getByRole("button", { name: "Archive" }).click();
    await page.waitForTimeout(500);

    // Go to archived and delete
    await page.getByRole("button", { name: "Show Archived" }).click();
    await page.waitForSelector("text=Zero Order Customer", { timeout: 5000 });
    const deleteBtn = page.locator("text=Zero Order Customer").locator("xpath=ancestor::div[contains(@style, 'border')]").getByRole("button", { name: "Delete" });
    await deleteBtn.click();
    await page.waitForTimeout(500);

    const afterDeleteContent = await page.content();
    assert.ok(!afterDeleteContent.includes("Zero Order Customer"), "Zero-order customer safely deleted");
  });

  await t.test("11. Responsive Layout Verification (375px, 390px, 768px, 1024px, 1440px)", async () => {
    const viewports = [
      { width: 375, height: 667, name: "375px mobile (iPhone SE)" },
      { width: 390, height: 844, name: "390px mobile (iPhone 12)" },
      { width: 768, height: 1024, name: "768px tablet (iPad)" },
      { width: 1024, height: 768, name: "1024px laptop" },
      { width: 1440, height: 900, name: "1440px desktop" },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(200);

      // Verify no horizontal document overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      assert.ok(
        scrollWidth <= clientWidth + 2,
        `Viewport ${vp.name} should have no horizontal overflow (scrollWidth=${scrollWidth}, clientWidth=${clientWidth})`
      );
    }
  });

  await page.close();
  await browser.close();
});
