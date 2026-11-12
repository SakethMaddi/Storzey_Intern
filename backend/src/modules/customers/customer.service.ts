import prisma from "../../lib/prisma.js";

export interface CreateCustomerInput {
  ownerId: number;
  name: string;
  phone: string;
  email?: string | null | undefined;
}

export interface UpdateCustomerInput {
  name: string;
  phone: string;
  email?: string | null | undefined;
}

export interface CustomerResult {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
  createdAt: Date;
}

export type CreateCustomerResult =
  | { status: "SUCCESS"; customer: CustomerResult }
  | { status: "DUPLICATE_PHONE"; existingName: string };

export type UpdateCustomerResult =
  | { status: "SUCCESS"; customer: CustomerResult }
  | { status: "NOT_FOUND" }
  | { status: "DUPLICATE_PHONE"; existingName: string };

export type CustomerMutationResult =
  | { status: "SUCCESS"; customer: CustomerResult }
  | { status: "NOT_FOUND" };

export type DeleteCustomerResult =
  | { status: "SUCCESS" }
  | { status: "NOT_FOUND" }
  | { status: "HAS_ORDERS" };

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedCustomerResult {
  customers: CustomerResult[];
  pagination: PaginationMeta;
}

export interface ListCustomerOptions {
  ownerId: number;
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  archived?: string | undefined;
}

export class CustomerService {
  /**
   * List customers scoped to the authenticated owner with pagination and search.
   */
  async listCustomers(options: ListCustomerOptions): Promise<PaginatedCustomerResult> {
    const { ownerId } = options;
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const skip = (page - 1) * limit;
    const search = options.search?.trim();
    const archived = options.archived ?? "false";

    const where: any = {
      ownerId,
    };

    if (archived === "true") {
      where.isArchived = true;
    } else if (archived === "false") {
      where.isArchived = false;
    } // "all" includes both archived and non-archived

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          isArchived: true,
          archivedAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      customers,
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
   * Find a customer by ID within the authenticated owner's tenant.
   */
  async getCustomerById(id: number, ownerId: number) {
    return await prisma.customer.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, phone: true, email: true },
    });
  }

  /**
   * Create a new customer scoped to ownerId with tenant-scoped phone uniqueness.
   */
  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const { ownerId, name, phone, email } = input;

    // Verify uniqueness for this specific owner
    const existing = await prisma.customer.findUnique({
      where: {
        ownerId_phone: {
          ownerId,
          phone,
        },
      },
      select: { id: true, name: true, phone: true },
    });

    if (existing) {
      return {
        status: "DUPLICATE_PHONE",
        existingName: existing.name,
      };
    }

    const customer = await prisma.customer.create({
      data: {
        ownerId,
        name,
        phone,
        email: email ?? null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
      },
    });

    return {
      status: "SUCCESS",
      customer,
    };
  }

  /**
   * Update an existing customer scoped to ownerId.
   */
  async updateCustomer(
    id: number,
    ownerId: number,
    input: UpdateCustomerInput
  ): Promise<UpdateCustomerResult> {
    const { name, phone, email } = input;

    const existingCustomer = await prisma.customer.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, phone: true, email: true },
    });

    if (!existingCustomer) {
      return { status: "NOT_FOUND" };
    }

    const duplicateCustomer = await prisma.customer.findFirst({
      where: {
        ownerId,
        phone,
        id: { not: id },
      },
      select: { id: true, name: true, phone: true },
    });

    if (duplicateCustomer) {
      return {
        status: "DUPLICATE_PHONE",
        existingName: duplicateCustomer.name,
      };
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        email: email !== undefined ? email : existingCustomer.email,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isArchived: true,
        archivedAt: true,
        createdAt: true,
      },
    });

    return {
      status: "SUCCESS",
      customer,
    };
  }

  /**
   * Archive a customer (soft delete) scoped to authenticated owner.
   */
  async archiveCustomer(id: number, ownerId: number): Promise<CustomerMutationResult> {
    const existing = await prisma.customer.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isArchived: true,
        archivedAt: true,
        createdAt: true,
      },
    });

    return {
      status: "SUCCESS",
      customer,
    };
  }

  /**
   * Restore an archived customer scoped to authenticated owner.
   */
  async restoreCustomer(id: number, ownerId: number): Promise<CustomerMutationResult> {
    const existing = await prisma.customer.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        isArchived: true,
        archivedAt: true,
        createdAt: true,
      },
    });

    return {
      status: "SUCCESS",
      customer,
    };
  }

  /**
   * Hard delete customer only if customer has zero orders.
   */
  async deleteCustomer(id: number, ownerId: number): Promise<DeleteCustomerResult> {
    const existing = await prisma.customer.findFirst({
      where: { id, ownerId },
      select: { id: true },
    });

    if (!existing) {
      return { status: "NOT_FOUND" };
    }

    const orderCount = await prisma.order.count({
      where: { customerId: id, ownerId },
    });

    if (orderCount > 0) {
      return { status: "HAS_ORDERS" };
    }

    await prisma.customer.delete({
      where: { id },
    });

    return { status: "SUCCESS" };
  }
}

export const customerService = new CustomerService();
