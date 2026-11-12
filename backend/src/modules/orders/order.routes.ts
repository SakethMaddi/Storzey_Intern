import type { FastifyInstance } from "fastify";
import {
  numericIdParamSchema,
  orderCancelSchema,
  orderCreateSchema,
  paginationQuerySchema,
} from "../../lib/validation.js";
import { orderService } from "./order.service.js";

export async function orderRoutes(app: FastifyInstance) {
  // GET /orders - Protected owner endpoint with pagination
  app.get(
    "/orders",
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

      const { page, limit, search, status, archived } = queryResult.data;
      const result = await orderService.listOrders({ ownerId, page, limit, search, status, archived });

      return {
        success: true,
        data: result.orders,
        pagination: result.pagination,
      };
    }
  );

  // POST /orders - Protected owner endpoint
  app.post(
    "/orders",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const parseResult = orderCreateSchema.safeParse(request.body);
      if (!parseResult.success) {
        const firstIssue = parseResult.error.issues[0];
        return reply.code(400).send({
          success: false,
          message:
            firstIssue?.message ||
            "Invalid order details, payment amounts, or promised date",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const {
        itemName,
        totalAmount,
        advance,
        customerId,
        promisedDate,
        stages,
      } = parseResult.data;

      try {
        const result = await orderService.createOrder({
          ownerId,
          itemName,
          totalAmount,
          advance,
          customerId,
          promisedDate,
          stages,
        });

        if (result.status === "CUSTOMER_NOT_FOUND") {
          return reply.code(404).send({
            success: false,
            message: "Customer not found",
          });
        }

        return reply.code(201).send({
          success: true,
          message: "Order created successfully",
          data: result.order,
        });
      } catch (error) {
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to create order",
        });
      }
    }
  );

  // GET /orders/:id - Protected owner endpoint
  app.get(
    "/orders/:id",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const orderId = paramResult.data.id;
      const order = await orderService.getOrderById(orderId, ownerId);

      if (!order) {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      return {
        success: true,
        data: order,
      };
    }
  );

  // PATCH /orders/:id/cancel - Cancel an active order
  app.patch(
    "/orders/:id/cancel",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const orderId = paramResult.data.id;
      const parseResult = orderCancelSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid cancellation data",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { reason } = parseResult.data;
      const result = await orderService.cancelOrder(orderId, ownerId, reason);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      if (result.status === "CANNOT_CANCEL") {
        return reply.code(400).send({
          success: false,
          message: result.message,
        });
      }

      return reply.send({
        success: true,
        message: "Order cancelled successfully",
        data: result.order,
      });
    }
  );

  // PATCH /orders/:id/archive - Archive CANCELLED or PAID orders
  app.patch(
    "/orders/:id/archive",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const orderId = paramResult.data.id;
      const result = await orderService.archiveOrder(orderId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      if (result.status === "CANNOT_ARCHIVE") {
        return reply.code(400).send({
          success: false,
          message: result.message,
        });
      }

      return reply.send({
        success: true,
        message: "Order archived successfully",
        data: result.order,
      });
    }
  );

  // PATCH /orders/:id/restore - Restore an archived order
  app.patch(
    "/orders/:id/restore",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid order ID",
        });
      }

      const orderId = paramResult.data.id;
      const result = await orderService.restoreOrder(orderId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      return reply.send({
        success: true,
        message: "Order restored successfully",
        data: result.order,
      });
    }
  );
}
