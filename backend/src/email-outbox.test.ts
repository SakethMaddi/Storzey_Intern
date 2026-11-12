import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "./modules/email/email.service.js";
import { generatePaymentReceiptHtml } from "./modules/email/email-template.js";

describe("Payment Email Notifications & Outbox Pattern", () => {
  let mockPrisma: any;
  let mockTransporter: any;
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({ messageId: "<receipt-test-123@advancepay.com>" }),
    };

    mockPrisma = {
      emailOutbox: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn(),
      },
    };

    emailService = new EmailService(mockPrisma as any, mockTransporter as any);
  });

  describe("HTML Email Template Rendering", () => {
    it("renders valid luxury boutique email with Burgundy, Ivory, and Champagne Gold styling", () => {
      const html = generatePaymentReceiptHtml({
        customerName: "Aanya Singhania",
        orderId: 101,
        itemName: "Hand-Embroidered Velvet Sherwani",
        amountReceived: 25000,
        totalAmount: 50000,
        remainingBalance: 25000,
        paymentMethod: "Online (Razorpay)",
        paymentDate: "12 Nov 2026, 04:00 PM",
        referenceId: "pay_test_987654321",
      });

      expect(html).toContain("Advance Pay");
      expect(html).toContain("Payment Status: Successful");
      expect(html).toContain("Aanya Singhania");
      expect(html).toContain("Hand-Embroidered Velvet Sherwani");
      expect(html).toContain("25,000");
      expect(html).toContain("50,000");
      expect(html).toContain("#800020"); // Burgundy
      expect(html).toContain("#d4af37"); // Champagne Gold
      expect(html).toContain("#fdfbf7"); // Warm Ivory
      expect(html).toContain("pay_test_987654321");
    });

    it("escapes special characters to prevent HTML injection in receipt emails", () => {
      const html = generatePaymentReceiptHtml({
        customerName: "<script>alert('xss')</script> Priya & Co",
        orderId: 102,
        itemName: "Silk Saree <b>Exclusive</b>",
        amountReceived: 10000,
        totalAmount: 10000,
        remainingBalance: 0,
        paymentMethod: "Online (Razorpay)",
        paymentDate: "12 Nov 2026",
        referenceId: "CASH-102",
      });

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
      expect(html).toContain("&amp; Co");
      expect(html).toContain("Silk Saree &lt;b&gt;Exclusive&lt;/b&gt;");
    });
  });

  describe("Outbox Enqueue Inside Transaction", () => {
    it("enqueues outbox record atomically when customer has valid email", async () => {
      const txMock = {
        emailOutbox: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: 1,
            paymentId: 501,
            recipient: "aanya@example.com",
            status: "PENDING",
            attempts: 0,
            maxAttempts: 5,
          }),
        },
      };

      const result = await emailService.enqueuePaymentReceiptTx(txMock as any, {
        paymentId: 501,
        recipient: "aanya@example.com",
        data: {
          customerName: "Aanya Singhania",
          orderId: 101,
          itemName: "Handmade Saree",
          amountReceived: 5000,
          totalAmount: 15000,
          remainingBalance: 10000,
          paymentMethod: "Online (Razorpay)",
          paymentDate: "12 Nov 2026",
          referenceId: "pay_test_501",
        },
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("ENQUEUED");
      expect(txMock.emailOutbox.create).toHaveBeenCalledTimes(1);
      const createArgs = txMock.emailOutbox.create.mock.calls[0][0];
      expect(createArgs.data.paymentId).toBe(501);
      expect(createArgs.data.recipient).toBe("aanya@example.com");
      expect(createArgs.data.status).toBe("PENDING");
      expect(createArgs.data.htmlContent).toContain("Aanya Singhania");
    });

    it("idempotently ignores duplicate enqueue attempts for same paymentId", async () => {
      const existingOutbox = {
        id: 1,
        paymentId: 501,
        recipient: "aanya@example.com",
        status: "SENT",
      };

      const txMock = {
        emailOutbox: {
          findUnique: vi.fn().mockResolvedValue(existingOutbox),
          create: vi.fn(),
        },
      };

      const result = await emailService.enqueuePaymentReceiptTx(txMock as any, {
        paymentId: 501,
        recipient: "aanya@example.com",
        data: {
          customerName: "Aanya Singhania",
          orderId: 101,
          itemName: "Handmade Saree",
          amountReceived: 5000,
          totalAmount: 15000,
          remainingBalance: 10000,
          paymentMethod: "Online (Razorpay)",
          paymentDate: "12 Nov 2026",
          referenceId: "pay_test_501",
        },
      });

      expect(result.status).toBe("SKIPPED_DUPLICATE");
      expect(txMock.emailOutbox.create).not.toHaveBeenCalled();
    });
  });

  describe("Outbox Dispatch & Delivery", () => {
    it("successfully sends email and transitions status from PENDING to SENT", async () => {
      const mockOutboxItem = {
        id: 1,
        paymentId: 501,
        recipient: "customer@example.com",
        subject: "Advance Pay – Payment Confirmation [Order #101]",
        htmlContent: "<p>Receipt</p>",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(mockOutboxItem);
      mockPrisma.emailOutbox.update.mockResolvedValue({
        ...mockOutboxItem,
        status: "SENT",
        sentAt: new Date(),
        attempts: 1,
      });

      const res = await emailService.processOutboxItem(1);

      expect(res.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: expect.any(String),
        to: "customer@example.com",
        subject: "Advance Pay – Payment Confirmation [Order #101]",
        html: "<p>Receipt</p>",
      });
      expect(mockPrisma.emailOutbox.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 1 }),
        data: expect.objectContaining({
          status: "SENT",
          attempts: { increment: 1 },
          lastError: null,
        }),
      });
    });

    it("handles SMTP failure with retry schedule and exponential backoff", async () => {
      const mockOutboxItem = {
        id: 2,
        paymentId: 502,
        recipient: "customer@example.com",
        subject: "Advance Pay – Payment Confirmation [Order #102]",
        htmlContent: "<p>Receipt</p>",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(mockOutboxItem);
      mockTransporter.sendMail.mockRejectedValue(new Error("SMTP Connection Timeout"));
      mockPrisma.emailOutbox.update.mockResolvedValue({
        ...mockOutboxItem,
        status: "PENDING",
        attempts: 1,
      });

      const res = await emailService.processOutboxItem(2);

      expect(res.success).toBe(false);
      expect(res.error).toBe("SMTP Connection Timeout");
      expect(mockPrisma.emailOutbox.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 2 }),
        data: expect.objectContaining({
          status: "PENDING",
          attempts: { increment: 1 },
          lastError: "SMTP Connection Timeout",
        }),
      });
    });

    it("marks outbox item as FAILED when maxAttempts is reached", async () => {
      const mockOutboxItem = {
        id: 3,
        paymentId: 503,
        recipient: "customer@example.com",
        subject: "Advance Pay – Payment Confirmation [Order #103]",
        htmlContent: "<p>Receipt</p>",
        status: "PENDING",
        attempts: 4,
        maxAttempts: 5,
        lastError: "Previous SMTP Error",
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(mockOutboxItem);
      mockTransporter.sendMail.mockRejectedValue(new Error("Persistent 550 Mailbox Unavailable"));
      mockPrisma.emailOutbox.update.mockResolvedValue({
        ...mockOutboxItem,
        status: "FAILED",
        attempts: 5,
      });

      const res = await emailService.processOutboxItem(3);

      expect(res.success).toBe(false);
      expect(res.error).toBe("Persistent 550 Mailbox Unavailable");
      expect(mockPrisma.emailOutbox.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 3 }),
        data: expect.objectContaining({
          status: "FAILED",
          attempts: { increment: 1 },
          lastError: "Persistent 550 Mailbox Unavailable",
        }),
      });
    });

    it("dispatchForPayment does not throw error if outbox lookup or SMTP fails", async () => {
      mockPrisma.emailOutbox.findUnique.mockRejectedValue(new Error("DB read error"));

      // Should not throw or crash
      await expect(emailService.dispatchForPayment(999)).resolves.not.toThrow();
    });

    it("worker startup and recovery queries pending records with nextRetryAt <= now", async () => {
      mockPrisma.emailOutbox.findMany.mockResolvedValue([
        {
          id: 10,
          paymentId: 610,
          recipient: "recovered@example.com",
          subject: "Receipt",
          htmlContent: "<p>Receipt</p>",
          status: "PENDING",
          attempts: 1,
          maxAttempts: 5,
        },
      ]);

      mockPrisma.emailOutbox.findUnique.mockResolvedValue({
        id: 10,
        paymentId: 610,
        recipient: "recovered@example.com",
        subject: "Receipt",
        htmlContent: "<p>Receipt</p>",
        status: "PENDING",
        attempts: 1,
        maxAttempts: 5,
      });

      const summary = await emailService.processPendingOutbox(10);

      expect(summary.processed).toBe(1);
      expect(summary.sent).toBe(1);
      expect(summary.failed).toBe(0);
      expect(mockPrisma.emailOutbox.findMany).toHaveBeenCalledWith({
        where: {
          status: "PENDING",
          nextRetryAt: { lte: expect.any(Date) },
        },
        take: 10,
        orderBy: { nextRetryAt: "asc" },
      });
    });

    it("sanitizes passwords or connection strings in lastError", async () => {
      const mockOutboxItem = {
        id: 4,
        paymentId: 504,
        recipient: "customer@example.com",
        subject: "Receipt",
        htmlContent: "<p>Receipt</p>",
        status: "PENDING",
        attempts: 0,
        maxAttempts: 5,
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(mockOutboxItem);
      mockTransporter.sendMail.mockRejectedValue(
        new Error("Auth failed: postgres://user:secret123@db.com:5432/db with password: superSecretPassword")
      );

      await emailService.processOutboxItem(4);

      expect(mockPrisma.emailOutbox.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ id: 4 }),
        data: expect.objectContaining({
          status: "PENDING",
          lastError: expect.not.stringContaining("secret123"),
        }),
      });
    });

    it("operational recovery: retries FAILED record and schedules immediate attempt", async () => {
      const failedRecord = {
        id: 5,
        paymentId: 505,
        recipient: "failed@example.com",
        status: "FAILED",
        attempts: 5,
        maxAttempts: 5,
        lastError: "Previous SMTP error",
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(failedRecord);
      mockPrisma.emailOutbox.update.mockResolvedValue({
        ...failedRecord,
        status: "PENDING",
        maxAttempts: 8,
      });

      const res = await emailService.retryFailedOutboxRecord(5);

      expect(res.status).toBe("RETRY_SCHEDULED");
      expect(mockPrisma.emailOutbox.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: expect.objectContaining({
          status: "PENDING",
          maxAttempts: 8,
          lockedAt: null,
          lockedBy: null,
        }),
      });
    });

    it("operational recovery: rejects retrying already SENT notifications", async () => {
      const sentRecord = {
        id: 6,
        paymentId: 506,
        recipient: "sent@example.com",
        status: "SENT",
        attempts: 1,
        maxAttempts: 5,
      };

      mockPrisma.emailOutbox.findUnique.mockResolvedValue(sentRecord);

      const res = await emailService.retryFailedOutboxRecord(6);

      expect(res.status).toBe("ALREADY_SENT");
      expect(mockPrisma.emailOutbox.update).not.toHaveBeenCalled();
    });
  });
});
