import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import {
  customerSchema,
  customerUpdateSchema,
  numericIdParamSchema,
  paginationQuerySchema,
} from "../../lib/validation.js";
import { customerService } from "./customer.service.js";

export async function customerRoutes(app: FastifyInstance) {
  // GET /customers - Protected owner endpoint with pagination
  app.get(
    "/customers",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const queryResult = paginationQuerySchema.safeParse(request.query);
      if (!queryResult.success) {
        return reply.code(400).send({
          success: false,
          message: queryResult.error.issues[0]?.message || "Invalid pagination query",
          errors: queryResult.error.flatten().fieldErrors,
        });
      }

      const { page, limit, search, archived } = queryResult.data;
      const result = await customerService.listCustomers({ ownerId, page, limit, search, archived });

      return {
        success: true,
        data: result.customers,
        pagination: result.pagination,
      };
    }
  );

  // POST /customers - Protected owner endpoint
  app.post(
    "/customers",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const parseResult = customerSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        return reply.code(400).send({
          success: false,
          message: firstIssue?.message || "Invalid customer details",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { name, phone, email } = parseResult.data;

      try {
        const result = await customerService.createCustomer({ ownerId, name, phone, email });

        if (result.status === "DUPLICATE_PHONE") {
          return reply.code(409).send({
            success: false,
            message: `A customer with phone number ${phone} already exists (${result.existingName})`,
          });
        }

        return reply.code(201).send({
          success: true,
          message: "Customer created successfully",
          data: result.customer,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.code(409).send({
            success: false,
            message: "A customer with this phone number already exists",
          });
        }
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // PATCH /customers/:id - Protected owner endpoint
  app.patch(
    "/customers/:id",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customerId = paramResult.data.id;

      const parseResult = customerUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        return reply.code(400).send({
          success: false,
          message: firstIssue?.message || "Invalid customer details",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { name, phone, email } = parseResult.data;

      try {
        const result = await customerService.updateCustomer(customerId, ownerId, {
          name,
          phone,
          email,
        });

        if (result.status === "NOT_FOUND") {
          return reply.code(404).send({
            success: false,
            message: "Customer not found",
          });
        }

        if (result.status === "DUPLICATE_PHONE") {
          return reply.code(409).send({
            success: false,
            message: `A customer with phone number ${phone} already exists (${result.existingName})`,
          });
        }

        return {
          success: true,
          message: "Customer updated successfully",
          data: result.customer,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.code(409).send({
            success: false,
            message: "A customer with this phone number already exists",
          });
        }
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Internal server error",
        });
      }
    }
  );

  // PATCH /customers/:id/archive - Soft delete customer
  app.patch(
    "/customers/:id/archive",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customerId = paramResult.data.id;
      const result = await customerService.archiveCustomer(customerId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Customer not found",
        });
      }

      return reply.send({
        success: true,
        message: "Customer archived successfully",
        data: result.customer,
      });
    }
  );

  // PATCH /customers/:id/restore - Restore soft-deleted customer
  app.patch(
    "/customers/:id/restore",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customerId = paramResult.data.id;
      const result = await customerService.restoreCustomer(customerId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Customer not found",
        });
      }

      return reply.send({
        success: true,
        message: "Customer restored successfully",
        data: result.customer,
      });
    }
  );

  // DELETE /customers/:id - Hard delete customer only if zero orders
  app.delete(
    "/customers/:id",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid customer ID",
        });
      }

      const customerId = paramResult.data.id;
      const result = await customerService.deleteCustomer(customerId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Customer not found",
        });
      }

      if (result.status === "HAS_ORDERS") {
        return reply.code(409).send({
          success: false,
          message: "Customer has orders and cannot be deleted. Use archive instead.",
        });
      }

      return reply.send({
        success: true,
        message: "Customer deleted successfully",
      });
    }
  );
}
