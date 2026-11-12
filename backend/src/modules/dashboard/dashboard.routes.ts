import type { FastifyInstance } from "fastify";
import prisma from "../../lib/prisma.js";

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /dashboard/stats - Owner-scoped aggregated metrics
  app.get(
    "/dashboard/stats",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;

      // Check whether the isArchived column exists on Order (backend-core migration guard)
      let orderHasIsArchived = false;
      let customerHasIsArchived = false;
      try {
        await prisma.$queryRaw`SELECT "isArchived" FROM "Order" LIMIT 0`;
        orderHasIsArchived = true;
      } catch {
        // Column does not exist yet — migration pending
      }
      try {
        await prisma.$queryRaw`SELECT "isArchived" FROM "Customer" LIMIT 0`;
        customerHasIsArchived = true;
      } catch {
        // Column does not exist yet — migration pending
      }

      // Build base where clauses depending on schema state
      // Order: exclude archived and cancelled once columns exist
      const activeOrderWhere: any = { ownerId };
      if (orderHasIsArchived) {
        activeOrderWhere.isArchived = false;
        activeOrderWhere.status = { not: "CANCELLED" };
      }

      // Customer: exclude archived once column exists
      const activeCustomerWhere: any = { ownerId };
      if (customerHasIsArchived) {
        activeCustomerWhere.isArchived = false;
      }

      // Helper: safely run a query, returning fallback on error
      async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
        try {
          return await fn();
        } catch (err) {
          (request as any).log?.warn(err, "dashboard metric query failed, returning fallback");
          return fallback;
        }
      }

      const [
        totalOrders,
        totalCustomers,
        totalOrderValAgg,
        outstandingAgg,
        paymentAgg,
        paidCount,
        partiallyPaidCount,
        pendingCount,
        recentOrders,
        recentPayments,
      ] = await Promise.all([
        // 1. Total non-archived, non-cancelled orders
        safeQuery(
          () => prisma.order.count({ where: activeOrderWhere }),
          0
        ),

        // 2. Total non-archived customers
        safeQuery(
          () => prisma.customer.count({ where: activeCustomerWhere }),
          0
        ),

        // 3a. Total order value (active orders only)
        safeQuery(
          () =>
            prisma.order.aggregate({
              where: activeOrderWhere,
              _sum: {
                totalAmount: true,
              },
            }),
          { _sum: { totalAmount: 0 } }
        ),

        // 3b. Outstanding balance (sum of Order.balance WHERE order not PAID and not CANCELLED and not ARCHIVED)
        safeQuery(
          () =>
            prisma.order.aggregate({
              where: {
                ...activeOrderWhere,
                paymentStatus: { not: "PAID" },
              },
              _sum: {
                balance: true,
              },
            }),
          { _sum: { balance: 0 } }
        ),

        // 4. Actual money collected: COMPLETED/CAPTURED payments on this owner's orders only
        //    (excludes PENDING and FAILED)
        safeQuery(
          () =>
            prisma.payment.aggregate({
              where: {
                order: { ownerId },
                status: { in: ["COMPLETED", "CAPTURED"] },
              },
              _sum: { amount: true },
            }),
          { _sum: { amount: 0 } }
        ),

        // 5. Paid orders count
        safeQuery(
          () =>
            prisma.order.count({
              where: { ...activeOrderWhere, paymentStatus: "PAID" },
            }),
          0
        ),

        // 6. Partially paid orders count
        safeQuery(
          () =>
            prisma.order.count({
              where: { ...activeOrderWhere, paymentStatus: "PARTIALLY_PAID" },
            }),
          0
        ),

        // 7. Pending production orders (payment status PENDING = no payment yet)
        safeQuery(
          () =>
            prisma.order.count({
              where: { ...activeOrderWhere, paymentStatus: "PENDING" },
            }),
          0
        ),

        // 8. Recent orders (last 5)
        safeQuery(
          () =>
            prisma.order.findMany({
              where: activeOrderWhere,
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                itemName: true,
                totalAmount: true,
                balance: true,
                paymentStatus: true,
                createdAt: true,
                customer: { select: { id: true, name: true } },
              },
            }),
          []
        ),

        // 9. Recent payment activity (last 5 COMPLETED/CAPTURED payments for this owner)
        safeQuery(
          () =>
            prisma.payment.findMany({
              where: {
                order: { ownerId },
                status: { in: ["COMPLETED", "CAPTURED"] },
              },
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                amount: true,
                paymentType: true,
                status: true,
                createdAt: true,
                order: {
                  select: {
                    id: true,
                    itemName: true,
                    customer: { select: { id: true, name: true } },
                  },
                },
              },
            }),
          []
        ),
      ]);

      // All monetary values are integers (paisa-free — stored as rupees in DB)
      const totalOrderValue = (totalOrderValAgg._sum.totalAmount ?? 0) as number;
      const totalOutstanding = (outstandingAgg._sum.balance ?? 0) as number;
      const totalCollected = (paymentAgg._sum.amount ?? 0) as number;

      return reply.send({
        success: true,
        data: {
          totalOrders,
          totalCustomers,
          totalOrderValue,
          totalCollected,
          totalOutstanding,
          paidCount,
          partiallyPaidCount,
          pendingCount,
          recentOrders,
          recentPayments,
        },
      });
    }
  );
}
