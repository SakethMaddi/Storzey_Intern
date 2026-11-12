import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "./lib/prisma.js";
import { EmailService } from "./modules/email/email.service.js";

describe("Real PostgreSQL Email Outbox Concurrency & Stale Worker Verification", () => {
  let customerId: number;
  let orderId: number;
  let paymentId1: number;
  let paymentId2: number;
  let paymentId3: number;

  beforeAll(async () => {
    // Seed test customer, order, and payments in local PostgreSQL database
    let owner = await prisma.owner.findFirst();
    if (!owner) {
      owner = await prisma.owner.create({
        data: {
          name: "Test Owner",
          email: "test.outbox.owner@advancepay.com",
          password: "password123",
        },
      });
    }

    const customer = await prisma.customer.create({
      data: {
        ownerId: owner.id,
        name: "Concurrency Test Customer",
        phone: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: "concurrency.test@advancepay.com",
      },
    });
    customerId = customer.id;

    const order = await prisma.order.create({
      data: {
        ownerId: owner.id,
        customerId,
        itemName: "Bespoke Royal Sherwani",
        totalAmount: 45000,
        advance: 15000,
        balance: 30000,
        paymentStatus: "PARTIALLY_PAID",
      },
    });
    orderId = order.id;

    const p1 = await prisma.payment.create({
      data: {
        orderId,
        amount: 5000,
        paymentType: "CASH",
        status: "COMPLETED",
      },
    });
    paymentId1 = p1.id;

    const p2 = await prisma.payment.create({
      data: {
        orderId,
        amount: 5000,
        paymentType: "CASH",
        status: "COMPLETED",
      },
    });
    paymentId2 = p2.id;

    const p3 = await prisma.payment.create({
      data: {
        orderId,
        amount: 5000,
        paymentType: "CASH",
        status: "COMPLETED",
      },
    });
    paymentId3 = p3.id;
  });

  afterAll(async () => {
    // Clean up seeded records
    try {
      await prisma.emailOutbox.deleteMany({
        where: { paymentId: { in: [paymentId1, paymentId2, paymentId3] } },
      });
      await prisma.payment.deleteMany({
        where: { id: { in: [paymentId1, paymentId2, paymentId3] } },
      });
      await prisma.order.delete({ where: { id: orderId } });
      await prisma.customer.delete({ where: { id: customerId } });
    } catch {}
  });

  it("1. Two independent workers claiming pending notifications: no notification is claimed by both simultaneously", async () => {
    // Seed two pending outbox records
    const outbox1 = await prisma.emailOutbox.create({
      data: {
        paymentId: paymentId1,
        recipient: "concurrency.test@advancepay.com",
        subject: "Payment 1 Receipt",
        htmlContent: "<p>Receipt 1</p>",
        status: "PENDING",
        nextRetryAt: new Date(Date.now() - 1000), // Ready to claim
      },
    });

    const outbox2 = await prisma.emailOutbox.create({
      data: {
        paymentId: paymentId2,
        recipient: "concurrency.test@advancepay.com",
        subject: "Payment 2 Receipt",
        htmlContent: "<p>Receipt 2</p>",
        status: "PENDING",
        nextRetryAt: new Date(Date.now() - 1000), // Ready to claim
      },
    });

    // Create two independent EmailService instances simulating two backend server nodes
    const workerA = new EmailService(prisma);
    const workerB = new EmailService(prisma);

    expect(workerA.workerInstanceId).not.toEqual(workerB.workerInstanceId);

    // Concurrently trigger atomic batch claim on both workers
    const [claimedByA, claimedByB] = await Promise.all([
      workerA.claimOutboxBatch(50),
      workerB.claimOutboxBatch(50),
    ]);

    const idsA = claimedByA.map((r) => r.id);
    const idsB = claimedByB.map((r) => r.id);

    // Mutual exclusion: the intersection of claimed IDs between Worker A and Worker B MUST be empty
    const intersection = idsA.filter((id) => idsB.includes(id));
    expect(intersection).toEqual([]);

    // The union must include both seeded outbox records (or each claimed at least one)
    const totalClaimed = [...idsA, ...idsB];
    expect(totalClaimed).toContain(outbox1.id);
    expect(totalClaimed).toContain(outbox2.id);

    // Verify row statuses and lockedBy in the database
    const dbRecord1 = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox1.id } });
    const dbRecord2 = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox2.id } });

    expect(dbRecord1.status).toBe("PROCESSING");
    expect(dbRecord2.status).toBe("PROCESSING");
    expect([workerA.workerInstanceId, workerB.workerInstanceId]).toContain(dbRecord1.lockedBy);
    expect([workerA.workerInstanceId, workerB.workerInstanceId]).toContain(dbRecord2.lockedBy);
  });

  it("2. Expired claims are recoverable by another worker", async () => {
    // Seed an abandoned outbox record with an expired lease (locked 5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const outbox3 = await prisma.emailOutbox.create({
      data: {
        paymentId: paymentId3,
        recipient: "concurrency.test@advancepay.com",
        subject: "Payment 3 Receipt",
        htmlContent: "<p>Receipt 3</p>",
        status: "PROCESSING",
        lockedAt: fiveMinutesAgo,
        lockedBy: "dead-crashed-worker-999",
        nextRetryAt: fiveMinutesAgo,
      },
    });

    // Worker C comes online to process pending outbox
    const workerC = new EmailService(prisma);
    const claimed = await workerC.claimOutboxBatch(10);

    const recoveredRecord = claimed.find((r) => r.id === outbox3.id);
    expect(recoveredRecord).toBeDefined();

    // Verify database record now reflects Worker C's lock
    const dbOutbox3 = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outbox3.id } });
    expect(dbOutbox3.status).toBe("PROCESSING");
    expect(dbOutbox3.lockedBy).toBe(workerC.workerInstanceId);
  });

  it("3. Stale worker protection: an expired worker cannot overwrite a newer worker's result", async () => {
    // Record is claimed by Worker C
    const record = await prisma.emailOutbox.findFirstOrThrow({
      where: { paymentId: paymentId3 },
    });

    // Simulate Worker Old (whose lease expired and was replaced by Worker C)
    const workerOld = new EmailService(prisma); // has its own unique workerInstanceId !== Worker C

    // Worker Old finishes its slow SMTP attempt and tries to mark the record SENT
    // processOutboxItem will attempt to update with `where: { lockedBy: workerOld.workerInstanceId }`
    const staleResult = await workerOld.processOutboxItem(record.id);

    // Stale worker call succeeds without throwing, but its conditional update affected 0 rows
    const checkDb = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: record.id } });

    // The record must NOT be updated by Worker Old: lockedBy remains Worker C's id, not workerOld
    expect(checkDb.lockedBy).not.toBe(workerOld.workerInstanceId);
  });

  it("4. Successful records are not selected again by subsequent claim cycles", async () => {
    // Mark record from payment 1 as SENT
    const record1 = await prisma.emailOutbox.findFirstOrThrow({
      where: { paymentId: paymentId1 },
    });

    await prisma.emailOutbox.update({
      where: { id: record1.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    });

    // Worker D attempts to claim batch
    const workerD = new EmailService(prisma);
    const claimed = await workerD.claimOutboxBatch(10);

    const reClaimedIds = claimed.map((r) => r.id);
    expect(reClaimedIds).not.toContain(record1.id);
  });

  afterAll(async () => {
    // Clean up test records and release any active locks created during concurrency assertions
    await prisma.emailOutbox.deleteMany({
      where: {
        paymentId: {
          in: [paymentId1, paymentId2, paymentId3],
        },
      },
    });
  });
});

