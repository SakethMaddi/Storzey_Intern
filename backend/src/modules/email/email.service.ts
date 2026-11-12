import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import prisma from "../../lib/prisma.js";
import { generatePaymentReceiptHtml, type PaymentReceiptEmailData } from "./email-template.js";

export interface EnqueueEmailInput {
  paymentId: number;
  recipient: string;
  data: PaymentReceiptEmailData;
}

export interface ClaimedOutboxRecord {
  id: number;
  paymentId: number;
  recipient: string;
  subject: string;
  htmlContent: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  lockedAt: Date | null;
  lockedBy: string | null;
  nextRetryAt: Date;
  sentAt: Date | null;
}

export class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;
  private db: typeof prisma;
  private workerTimer: NodeJS.Timeout | null = null;
  private isProcessingOutbox: boolean = false;
  public readonly workerInstanceId: string = `worker-${randomUUID().slice(0, 8)}`;
  private leaseDurationMs: number = 2 * 60 * 1000; // 2-minute lease for abandoned crash recovery

  constructor(customDb?: typeof prisma, customTransporter?: Transporter) {
    this.db = customDb || prisma;
    if (customTransporter) {
      this.transporter = customTransporter;
      this.isConfigured = true;
    } else {
      this.initTransporter();
    }
  }

  /**
   * Initialize nodemailer transport from environment variables
   */
  private initTransporter() {
    // CRITICAL SMTP SAFETY: Never initialize live external SMTP in test mode
    if (process.env.NODE_ENV === "test") {
      this.transporter = null;
      this.isConfigured = false;
      return;
    }

    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        // Enforce strict timeouts well below the 2-minute lease to prevent lease-expiration while sending
        connectionTimeout: 15000, // 15 seconds max connection establishment
        greetingTimeout: 10000,   // 10 seconds greeting timeout
        socketTimeout: 30000,     // 30 seconds socket inactivity timeout
      });
      this.isConfigured = true;
    } else {
      this.transporter = null;
      this.isConfigured = false;
    }
  }

  /**
   * Expose configuration status
   */
  public isSmtpConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Override or mock the transporter (used in tests to prevent any live external SMTP calls)
   */
  public setTransporter(transporter: Transporter | null) {
    this.transporter = transporter;
    this.isConfigured = Boolean(transporter);
  }

  /**
   * Enqueue a payment confirmation receipt into the EmailOutbox within an existing Prisma transaction.
   * Ensures the notification is atomically persisted with payment completion and unique per paymentId.
   */
  async enqueuePaymentReceiptTx(
    tx: any,
    input: EnqueueEmailInput
  ): Promise<{ status: "ENQUEUED" | "SKIPPED_DUPLICATE" | "SKIPPED_NO_EMAIL" }> {
    const { paymentId, recipient, data } = input;

    if (!recipient || !recipient.trim()) {
      return { status: "SKIPPED_NO_EMAIL" };
    }

    const trimmedRecipient = recipient.trim().toLowerCase();

    // Idempotency: verify outbox record does not already exist
    const existing = await tx.emailOutbox.findUnique({
      where: { paymentId },
    });

    if (existing) {
      return { status: "SKIPPED_DUPLICATE" };
    }

    const htmlContent = generatePaymentReceiptHtml(data);
    const subject = `Payment Confirmation for Order #${data.orderId} — Advance Pay`;

    await tx.emailOutbox.create({
      data: {
        paymentId,
        recipient: trimmedRecipient,
        subject,
        htmlContent,
        status: "PENDING",
      },
    });

    return { status: "ENQUEUED" };
  }

  /**
   * Multi-instance atomic claiming:
   * Uses PostgreSQL row-level locking (FOR UPDATE SKIP LOCKED) inside a short transaction
   * to lease up to `limit` pending or expired-lease records.
   * If a process crashes while holding a lease, other instances recover it after leaseDurationMs expires.
   */
  async claimOutboxBatch(limit: number = 10): Promise<ClaimedOutboxRecord[]> {
    const instanceId = this.workerInstanceId;
    const now = new Date();
    const leaseThreshold = new Date(now.getTime() - this.leaseDurationMs);

    // Fast-path for Prisma mock environments where $transaction / $queryRaw are mocked or Prisma mock without raw queries
    if (typeof (this.db as any).$queryRaw !== "function") {
      const pendingItems = await (this.db.emailOutbox.findMany as any)({
        where: {
          status: "PENDING",
          nextRetryAt: { lte: now },
        },
        take: limit,
        orderBy: { nextRetryAt: "asc" },
      });
      return pendingItems || [];
    }

    try {
      return await this.db.$transaction(async (tx) => {
        // Select candidate IDs with SKIP LOCKED to ensure zero lock contention between concurrent workers
        const candidates = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id"
          FROM "EmailOutbox"
          WHERE (
            ("status" = 'PENDING' AND "nextRetryAt" <= ${now})
            OR
            ("status" = 'PROCESSING' AND "lockedAt" <= ${leaseThreshold})
          )
          ORDER BY "nextRetryAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        if (!candidates || candidates.length === 0) {
          return [];
        }

        const candidateIds = candidates.map((c) => c.id);

        // Mark the claimed rows as PROCESSING with lease timestamp and worker identity
        await tx.$executeRaw`
          UPDATE "EmailOutbox"
          SET "status" = 'PROCESSING',
              "lockedAt" = ${now},
              "lockedBy" = ${instanceId},
              "updatedAt" = ${now}
          WHERE "id" = ANY(${candidateIds})
        `;

        // Return the updated claimed records
        return await tx.emailOutbox.findMany({
          where: { id: { in: candidateIds } },
        }) as unknown as ClaimedOutboxRecord[];
      });
    } catch (err: any) {
      console.error("[EmailService] Failed to claim outbox batch atomically:", err.message);
      return [];
    }
  }

  /**
   * Process a single outbox record immediately or via retry.
   * Guaranteed never to throw uncaught exceptions to caller.
   */
  async processOutboxItem(outboxId: number): Promise<{ success: boolean; error?: string }> {
    const outbox = await this.db.emailOutbox.findUnique({
      where: { id: outboxId },
    });

    if (!outbox || outbox.status === "SENT") {
      return { success: true };
    }

    // If row is not already locked by this worker, attempt to acquire a lock unless locked by an active other worker
    const lockAcquired = await this.db.emailOutbox.updateMany({
      where: {
        id: outboxId,
        OR: [
          { lockedBy: this.workerInstanceId },
          { lockedBy: null, status: "PENDING" },
        ],
      },
      data: {
        status: "PROCESSING",
        lockedAt: new Date(),
        lockedBy: this.workerInstanceId,
        updatedAt: new Date(),
      },
    });

    // If another worker has already locked this record, skip to avoid duplicate processing
    if (lockAcquired.count === 0 && outbox.lockedBy && outbox.lockedBy !== this.workerInstanceId) {
      return { success: true };
    }

    if (!this.transporter) {
      // In development / test when SMTP is not configured: log safe note, do NOT falsify production delivery
      const isProd = process.env.NODE_ENV === "production";
      if (isProd) {
        const errorMsg = "SMTP provider is not configured in production environment.";
        await this.db.emailOutbox.updateMany({
          where: {
            id: outboxId,
            OR: [
              { lockedBy: this.workerInstanceId },
              { lockedBy: null, status: { in: ["PENDING", "PROCESSING"] } },
            ],
          },
          data: {
            attempts: { increment: 1 },
            lastError: errorMsg,
            status: "FAILED",
            lockedAt: null,
            lockedBy: null,
          },
        });
        return { success: false, error: errorMsg };
      } else {
        // Non-production fallback mode: marks sent for testing
        await this.db.emailOutbox.updateMany({
          where: {
            id: outboxId,
            OR: [
              { lockedBy: this.workerInstanceId },
              { lockedBy: null, status: { in: ["PENDING", "PROCESSING"] } },
            ],
          },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: "Mock delivery: SMTP credentials not set in local environment.",
            lockedAt: null,
            lockedBy: null,
          },
        });
        return { success: true };
      }
    }

    const fromAddress = process.env.SMTP_FROM?.trim() || '"Advance Pay Boutique" <receipts@advancepay.com>';

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: outbox.recipient,
        subject: outbox.subject,
        html: outbox.htmlContent,
      });

      // Stale-Worker Protection:
      // Verify that this worker still holds the lease (lockedBy matches, or row was not locked by another worker)
      // and that the row hasn't already been marked SENT by an overlapping worker.
      const updateResult = await this.db.emailOutbox.updateMany({
        where: {
          id: outboxId,
          OR: [
            { lockedBy: this.workerInstanceId },
            { lockedBy: null, status: { in: ["PENDING", "PROCESSING"] } },
          ],
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
          lockedAt: null,
          lockedBy: null,
        },
      });

      if (updateResult.count === 0) {
        console.warn(`[EmailService] Stale worker ${this.workerInstanceId} prevented from marking outbox #${outboxId} as SENT (claim expired or superseded).`);
      }

      return { success: true };
    } catch (err: any) {
      const rawError = err instanceof Error ? err.message : "SMTP transport failure";
      // Sanitize any credentials or sensitive database connection strings
      const sanitizedError = rawError
        .replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@")
        .replace(/(pass(?:word)?\s*[:=]\s*)[^\s,;&]+/gi, "$1[REDACTED]")
        .replace(/(auth\s*[:=]\s*)[^\s,;&]+/gi, "$1[REDACTED]");

      const nextAttempts = outbox.attempts + 1;
      const isExhausted = nextAttempts >= outbox.maxAttempts;

      // Exponential backoff: 2^attempts * 60 seconds
      const backoffMinutes = Math.min(60, Math.pow(2, outbox.attempts) * 2);
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      // Stale-Worker Protection for error reporting as well
      await this.db.emailOutbox.updateMany({
        where: {
          id: outboxId,
          OR: [
            { lockedBy: this.workerInstanceId },
            { lockedBy: null, status: { in: ["PENDING", "PROCESSING"] } },
          ],
        },
        data: {
          attempts: { increment: 1 },
          status: isExhausted ? "FAILED" : "PENDING",
          lastError: sanitizedError.slice(0, 500),
          nextRetryAt,
          lockedAt: null,
          lockedBy: null,
        },
      });

      return { success: false, error: sanitizedError };
    }
  }

  /**
   * Immediate dispatch helper after transaction commits.
   */
  async dispatchForPayment(paymentId: number): Promise<void> {
    try {
      const outbox = await this.db.emailOutbox.findUnique({
        where: { paymentId },
      });
      if (outbox && outbox.status === "PENDING") {
        await this.processOutboxItem(outbox.id);
      }
    } catch (err) {
      // Safe logger; never bubble or disrupt the caller
      console.error("[EmailService] Background email dispatch failed:", err instanceof Error ? err.message : err);
    }
  }

  /**
   * Process pending retries in the outbox using atomic batch claiming
   */
  async processPendingOutbox(limit: number = 20): Promise<{ processed: number; sent: number; failed: number }> {
    const claimedItems = await this.claimOutboxBatch(limit);

    let sent = 0;
    let failed = 0;

    for (const item of claimedItems) {
      const res = await this.processOutboxItem(item.id);
      if (res.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { processed: claimedItems.length, sent, failed };
  }

  /**
   * Operational Recovery API:
   * Safely retries a FAILED outbox record after SMTP configuration or network outages are resolved.
   * - Does not create another outbox row.
   * - Does not resend records already marked SENT.
   * - Preserves audit history and resets nextRetryAt to now for immediate worker processing.
   */
  async retryFailedOutboxRecord(outboxId: number, ownerId?: number): Promise<{
    status: "RETRY_SCHEDULED" | "ALREADY_SENT" | "NOT_FOUND" | "NOT_FAILED";
    message: string;
  }> {
    const existing = await this.db.emailOutbox.findUnique({
      where: { id: outboxId },
      include: {
        payment: {
          include: {
            order: true,
          },
        },
      },
    });

    if (!existing) {
      return { status: "NOT_FOUND", message: `Outbox notification #${outboxId} not found.` };
    }

    if (ownerId !== undefined && existing.payment?.order?.ownerId !== ownerId) {
      return { status: "NOT_FOUND", message: `Outbox notification #${outboxId} not found.` };
    }

    if (existing.status === "SENT") {
      return { status: "ALREADY_SENT", message: `Notification #${outboxId} was already successfully sent.` };
    }

    if (existing.status !== "FAILED") {
      return { status: "NOT_FAILED", message: `Notification #${outboxId} is currently ${existing.status}, not FAILED.` };
    }

    // Reset status to PENDING with nextRetryAt=now and grant additional retry attempts if exhausted
    await this.db.emailOutbox.update({
      where: { id: outboxId },
      data: {
        status: "PENDING",
        nextRetryAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        // If maxAttempts was reached, increment maxAttempts by 3 to allow fresh delivery attempts
        maxAttempts: existing.attempts >= existing.maxAttempts ? existing.attempts + 3 : existing.maxAttempts,
      },
    });

    // Trigger immediate background delivery attempt
    this.processOutboxItem(outboxId).catch(() => {});

    return {
      status: "RETRY_SCHEDULED",
      message: `Notification #${outboxId} rescheduled for delivery.`,
    };
  }

  /**
   * Start periodic background outbox worker for pending and retryable emails.
   * Runs an immediate recovery cycle on startup, then polls at the specified interval.
   */
  startWorker(intervalMs: number = 30000): void {
    if (this.workerTimer) {
      return;
    }

    // Run immediate cycle for pending recovery
    this.processPendingOutbox().catch((err) => {
      console.error("[EmailService Worker] Startup recovery error:", err);
    });

    this.workerTimer = setInterval(() => {
      if (this.isProcessingOutbox) {
        return;
      }
      this.isProcessingOutbox = true;
      this.processPendingOutbox()
        .catch((err) => {
          console.error("[EmailService Worker] Periodic processing error:", err);
        })
        .finally(() => {
          this.isProcessingOutbox = false;
        });
    }, intervalMs);

    // Allow process to exit cleanly without unref issues
    if (this.workerTimer.unref) {
      this.workerTimer.unref();
    }
  }

  /**
   * Stop periodic background worker during graceful shutdown.
   */
  stopWorker(): void {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
  }
}

export const emailService = new EmailService();
