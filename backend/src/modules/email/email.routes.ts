import type { FastifyInstance } from "fastify";
import { numericIdParamSchema } from "../../lib/validation.js";
import { emailService } from "./email.service.js";

export async function emailRoutes(app: FastifyInstance) {
  // POST /admin/email-outbox/:id/retry - Protected Owner Only
  app.post(
    "/admin/email-outbox/:id/retry",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const parsedParams = numericIdParamSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.code(400).send({
          success: false,
          message: "Invalid outbox record ID",
        });
      }

      const outboxId = parsedParams.data.id;
      const ownerId = (request as any).user.ownerId;
      const result = await emailService.retryFailedOutboxRecord(outboxId, ownerId);

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: result.message,
        });
      }

      if (result.status === "ALREADY_SENT" || result.status === "NOT_FAILED") {
        return reply.code(409).send({
          success: false,
          message: result.message,
        });
      }

      return reply.code(200).send({
        success: true,
        message: result.message,
      });
    }
  );
}

