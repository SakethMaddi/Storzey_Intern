import prisma from "../../lib/prisma.js";

export const DEFAULT_ORDER_STAGES = [
  "Order Placed",
  "Cutting",
  "Stitching",
  "Finishing",
  "Ready for Delivery",
] as const;

export interface CreateOrderInput {
  ownerId: number;
  itemName: string;
  totalAmount: number;
  advance: number;
  customerId: number;
  promisedDate: string;
  stages?: string[] | undefined;
}

export interface OrderCustomerDetail {
  id: number;
  name: string;
  phone: string;
}

export interface OrderItemResult {
  id: number;
  ownerId: number;
  itemName: string;
  totalAmount: number;
  advance: number;
  balance: number;
  paymentStatus: string;
  status?: string;
  promisedDate: Date | null;
  paymentLinkExpiresAt: Date | null;
  publicToken: string;
  customerId: number;
  createdAt: Date;
  isArchived?: boolean;
  archivedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  customer: OrderCustomerDetail;
}

export type CreateOrderResult =
  | { status: "SUCCESS"; order: OrderItemResult }
  | { status: "CUSTOMER_NOT_FOUND" };

export type CancelOrderResult =
  | { status: "SUCCESS"; order: any }
  | { status: "NOT_FOUND" }
  | { status: "CANNOT_CANCEL"; message: string };

export type ArchiveOrderResult =
  | { status: "SUCCESS"; order: any }
  | { status: "NOT_FOUND" }
  | { status: "CANNOT_ARCHIVE"; message: string };

export type RestoreOrderResult =
  | { status: "SUCCESS"; order: any }
  | { status: "NOT_FOUND" };

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedOrderResult {
  orders: OrderItemResult[];
  pagination: PaginationMeta;
}

export interface ListOrderOptions {
  ownerId: number;
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  status?: string | undefined;
  archived?: string | undefined;
}

export class OrderService {
  /**
   * List orders scoped to the authenticated owner with pagination, search, and status filter.
   */
  async listOrders(options: ListOrderOptions): Promise<PaginatedOrderResult> {
    const { ownerId } = options;
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;
    const search = options.search?.trim();
    const status = options.status?.trim();
    const archived = options.archived ?? "false";

    const whereConditions: any[] = [{ ownerId }];

    if (archived === "true") {
      whereConditions.push({ isArchived: true });
    } else if (archived === "false") {
      whereConditions.push({ isArchived: false });
    } // "all" includes both archived and unarchived

    if (status && status !== "ALL") {
      whereConditions.push({ paymentStatus: status });
    }

    if (search) {
      whereConditions.push({
        OR: [
          { itemName: { contains: search, mode: "insensitive" } },
          { customer: { name: { contains: search, mode: "insensitive" } } },
          { customer: { phone: { contains: search } } },
        ],
      });
    }

    const where = { AND: whereConditions };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        select: {
          id: true,
          ownerId: true,
          itemName: true,
          totalAmount: true,
          advance: true,
          balance: true,
          paymentStatus: true,
          status: true,
          promisedDate: true,
          paymentLinkExpiresAt: true,
          publicToken: true,
          customerId: true,
          createdAt: true,
          isArchived: true,
          archivedAt: true,
          cancelledAt: true,
          cancelledBy: true,
          cancellationReason: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get an order by ID scoped to the authenticated owner.
   */
  async getOrderById(id: number, ownerId: number) {
    return await prisma.order.findFirst({
      where: { id, ownerId },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        stages: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });
  }

  /**
   * Create an order scoped to ownerId with composite customer verification.
   */
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { ownerId, itemName, totalAmount, advance, customerId, promisedDate, stages } = input;

    // Verify customer exists AND belongs to the same owner
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, ownerId },
      select: { id: true, name: true, phone: true },
    });

    if (!customer) {
      return { status: "CUSTOMER_NOT_FOUND" };
    }

    const balance = totalAmount; // In Advance Pay initial order creation, balance starts at totalAmount before payments are captured
    const paymentStatus = "PENDING";

    const defaultStages = [...DEFAULT_ORDER_STAGES];

    const stagesToCreate =
      stages && stages.length > 0
        ? stages.map((name, index) => ({
            name: name.trim(),
            position: index,
            status: "PENDING",
          }))
        : defaultStages.map((name, index) => ({
            name,
            position: index,
            status: "PENDING",
          }));

    const now = new Date();
    const paymentLinkExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          ownerId,
          itemName,
          totalAmount,
          advance,
          balance,
          paymentStatus,
          promisedDate: new Date(`${promisedDate}T00:00:00.000Z`),
          paymentLinkExpiresAt,
          customerId,
          stages: {
            create: stagesToCreate,
          },
        },
        select: {
          id: true,
          ownerId: true,
          itemName: true,
          totalAmount: true,
          advance: true,
          balance: true,
          paymentStatus: true,
          promisedDate: true,
          paymentLinkExpiresAt: true,
          publicToken: true,
          customerId: true,
          createdAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      return created;
    });

    return {
      status: "SUCCESS",
      order,
    };
  }

  /**
   * Cancel an order scoped to authenticated owner.
   * Only cancellable if status !== "CANCELLED" and status !== "ARCHIVED" and not isArchived.
   * Preserves all payment records.
   */
  async cancelOrder(id: number, ownerId: number, reason: string): Promise<CancelOrderResult> {
    const existing = await prisma.order.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    if (existing.status === "CANCELLED") {
      return {
        status: "CANNOT_CANCEL",
        message: "Order is already cancelled",
      };
    }

    if (existing.status === "ARCHIVED" || existing.isArchived) {
      return {
        status: "CANNOT_CANCEL",
        message: "Archived orders cannot be cancelled",
      };
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: "owner",
        cancellationReason: reason,
      },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        stages: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });

    return {
      status: "SUCCESS",
      order: updated,
    };
  }

  /**
   * Archive an order scoped to authenticated owner.
   * Only archive CANCELLED or PAID orders.
   */
  async archiveOrder(id: number, ownerId: number): Promise<ArchiveOrderResult> {
    const existing = await prisma.order.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const isPaid = existing.paymentStatus === "PAID";
    const isCancelled = existing.status === "CANCELLED";

    if (!isPaid && !isCancelled) {
      return {
        status: "CANNOT_ARCHIVE",
        message: "Only CANCELLED or PAID orders can be archived",
      };
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        stages: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });

    return {
      status: "SUCCESS",
      order: updated,
    };
  }

  /**
   * Restore an archived order scoped to authenticated owner.
   */
  async restoreOrder(id: number, ownerId: number): Promise<RestoreOrderResult> {
    const existing = await prisma.order.findFirst({
      where: { id, ownerId },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
      include: {
        customer: true,
        payments: {
          orderBy: { createdAt: "desc" },
        },
        stages: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
        },
      },
    });

    return {
      status: "SUCCESS",
      order: updated,
    };
  }
}

export const orderService = new OrderService();
