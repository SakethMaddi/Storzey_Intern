import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  numericIdParamSchema,
  orderStageCreateSchema,
  stageUpdateSchema,
} from "../../lib/validation.js";
export async function stageRoutes(app: FastifyInstance) {
  // GET /orders/:id/stages - Protected owner endpoint
  app.get(
    "/orders/:id/stages",
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

      const order = await prisma.order.findFirst({
        where: { id: orderId, ownerId },
        select: { id: true },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      const stages = await prisma.orderStage.findMany({
        where: { orderId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      return {
        success: true,
        data: stages,
      };
    }
  );

  // POST /orders/:id/stages - Protected owner endpoint
  app.post(
    "/orders/:id/stages",
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

      const bodyResult = orderStageCreateSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message: bodyResult.error.issues[0]?.message || "Invalid stage name",
        });
      }

      const orderId = paramResult.data.id;
      const { name } = bodyResult.data;

      const order = await prisma.order.findFirst({
        where: { id: orderId, ownerId },
        select: { id: true },
      });

      if (!order) {
        return reply.code(404).send({
          success: false,
          message: "Order not found",
        });
      }

      const existingStage = await prisma.orderStage.findFirst({
        where: {
          orderId,
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
        select: { id: true, name: true },
      });

      if (existingStage) {
        return reply.code(409).send({
          success: false,
          message: `A stage named "${existingStage.name}" already exists for this order`,
        });
      }

      try {
        const maxPosition = await prisma.orderStage.aggregate({
          where: { orderId },
          _max: { position: true },
        });
        const nextPosition = (maxPosition._max.position ?? -1) + 1;

        const stage = await prisma.orderStage.create({
          data: {
            name,
            orderId,
            position: nextPosition,
          },
        });

        return reply.code(201).send({
          success: true,
          message: "Stage created successfully",
          data: stage,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return reply.code(409).send({
            success: false,
            message: "Duplicate stage name for this order",
          });
        }
        request.log.error(error);
        return reply.code(500).send({
          success: false,
          message: "Failed to create stage",
        });
      }
    }
  );

  // PATCH /stages/:id - Protected owner endpoint
  app.patch(
    "/stages/:id",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user.ownerId;
      const paramResult = numericIdParamSchema.safeParse(request.params);
      if (!paramResult.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid stage ID",
        });
      }

      const bodyResult = stageUpdateSchema.safeParse(request.body);
      if (!bodyResult.success) {
        return reply.code(400).send({
          success: false,
          message: bodyResult.error.issues[0]?.message || "Invalid stage status",
        });
      }

      const stageId = paramResult.data.id;
      const { status } = bodyResult.data;

      const existingStage = await prisma.orderStage.findFirst({
        where: {
          id: stageId,
          order: { ownerId },
        },
      });

      if (!existingStage) {
        return reply.code(404).send({
          success: false,
          message: "Stage not found",
        });
      }

      const stage = await prisma.orderStage.update({
        where: { id: stageId },
        data: { status },
      });

      return {
        success: true,
        data: stage,
      };
    }
  );
}
