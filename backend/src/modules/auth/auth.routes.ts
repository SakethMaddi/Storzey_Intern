import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import {
  changePasswordSchema,
  loginSchema,
  ownerRegisterSchema,
  profileUpdateSchema,
} from "../../lib/validation.js";
import { authService } from "./auth.service.js";
import { clearSessionCookie, setSessionCookie } from "./session-cookie.js";

export async function authRoutes(app: FastifyInstance) {
  const isProd = (app as any).env?.isProduction ?? (process.env.NODE_ENV === "production");

  // GET /auth/registration-status - Multi-tenant SaaS status
  app.get("/auth/registration-status", async () => {
    const status = await authService.getRegistrationStatus();
    return {
      success: true,
      data: status,
    };
  });

  // POST /auth/register - Multi-tenant boutique owner registration (Rate limit: 10/hour per IP in prod, 100/min in dev/test)
  app.post(
    "/auth/register",
    {
      config: {
        rateLimit: {
          max: isProd ? 10 : 100,
          timeWindow: isProd ? 60 * 60 * 1000 : 60 * 1000,
        },
      },
    },
    async (request, reply) => {
      const parseResult = ownerRegisterSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid registration data",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { name, email, phone, businessName, password } = parseResult.data;

      try {
        const result = await authService.registerOwner({
          name,
          email,
          phone,
          businessName,
          password,
        });

        if (result.status === "EMAIL_EXISTS") {
          return reply.code(409).send({
            success: false,
            message: "An owner with this email already exists.",
          });
        }

        if (result.status === "PHONE_EXISTS") {
          return reply.code(409).send({
            success: false,
            message: "An owner with this phone number already exists.",
          });
        }

        if (!result.owner) {
          const refId = `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
          return reply.code(500).send({
            success: false,
            message: "We couldn't complete your registration right now. Please try again in a few moments. If the issue continues, contact support.",
            refId,
          });
        }

        // Establish authenticated session immediately after registration
        const token = app.jwt.sign(
          {
            ownerId: result.owner.id,
            role: "owner",
            email: result.owner.email,
            name: result.owner.name,
            businessName: result.owner.businessName || null,
          },
          { expiresIn: "7d" }
        );

        setSessionCookie(reply, token, process.env.NODE_ENV === "production");

        return reply.code(201).send({
          success: true,
          message: "Owner account registered and authenticated successfully.",
          data: {
            id: result.owner.id,
            email: result.owner.email,
            name: result.owner.name,
            phone: result.owner.phone ?? null,
            businessName: result.owner.businessName || null,
            role: "owner",
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          const target = Array.isArray(err?.meta?.target)
            ? err.meta.target.join(",")
            : String(err?.meta?.target || "");
          const isPhone = target.includes("phone");
          return reply.code(409).send({
            success: false,
            message: isPhone
              ? "An owner with this phone number already exists."
              : "An owner with this email already exists.",
          });
        }
        const refId = `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        request.log.error(
          { refId, err, endpoint: "/auth/register" },
          "Unexpected error during owner registration"
        );
        return reply.code(500).send({
          success: false,
          message: "We couldn't complete your registration right now. Please try again in a few moments. If the issue continues, contact support.",
          refId,
        });
      }
    }
  );

  // POST /auth/login - Owner login (Rate limit: 5/15min per IP in prod, 100/min in dev/test)
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 15 * 60 * 1000,
        },
      },
    },
    async (request, reply) => {
      const parseResult = loginSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid email or password",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { email, password } = parseResult.data;

      let isAuthenticated = false;
      let ownerId: number | undefined;
      let ownerName = "Owner";
      let businessName: string | null | undefined;

      try {
        const credentials = await authService.verifyOwnerCredentials(email, password);
        isAuthenticated = credentials.isAuthenticated;
        ownerId = credentials.ownerId;
        ownerName = credentials.ownerName;
        businessName = credentials.businessName;
      } catch (err: any) {
        const refId = `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        request.log.error(
          { refId, err, endpoint: "/auth/login" },
          "Unexpected error during owner login"
        );
        return reply.code(500).send({
          success: false,
          message: "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support.",
          refId,
        });
      }

      if (!isAuthenticated || !ownerId) {
        return reply.code(401).send({
          success: false,
          message: "Incorrect email or password. Please try again.",
        });
      }

      const token = app.jwt.sign(
        {
          ownerId,
          role: "owner",
          email,
          name: ownerName,
          businessName: businessName || null,
        },
        { expiresIn: "7d" }
      );

      setSessionCookie(reply, token, process.env.NODE_ENV === "production");

      return reply.send({
        success: true,
        message: "Logged in successfully",
        data: {
          id: ownerId,
          email,
          name: ownerName,
          businessName: businessName || null,
          role: "owner",
        },
      });
    }
  );

  // POST /auth/logout - Clear session
  app.post("/auth/logout", async (_request, reply) => {
    clearSessionCookie(reply, process.env.NODE_ENV === "production");

    return reply.send({
      success: true,
      message: "Logged out successfully",
    });
  });

  // GET /auth/me - Check current owner session (Protected, fresh data from DB)
  app.get(
    "/auth/me",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const user = (request as any).user;
      const ownerId = user?.ownerId;

      if (!ownerId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const owner = await authService.getOwnerProfile(ownerId);
      if (!owner) {
        return reply.code(404).send({
          success: false,
          message: "Owner not found",
        });
      }

      return reply.send({
        success: true,
        data: {
          id: owner.id,
          email: owner.email,
          name: owner.name,
          phone: owner.phone ?? null,
          businessName: owner.businessName || null,
          role: "owner",
        },
      });
    }
  );

  // PATCH /auth/profile - Update owner profile details (Protected)
  app.patch(
    "/auth/profile",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user?.ownerId;
      if (!ownerId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const parseResult = profileUpdateSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid profile data",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { name, phone, businessName } = parseResult.data;

      const result = await authService.updateProfile({
        ownerId,
        name,
        phone,
        businessName,
      });

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Owner not found",
        });
      }

      if (result.status === "PHONE_EXISTS") {
        return reply.code(409).send({
          success: false,
          message: "An owner with this phone number already exists.",
        });
      }

      return reply.send({
        success: true,
        message: "Profile updated successfully",
        data: {
          id: result.owner.id,
          email: result.owner.email,
          name: result.owner.name,
          phone: result.owner.phone ?? null,
          businessName: result.owner.businessName ?? null,
          role: "owner",
        },
      });
    }
  );

  // PATCH /auth/change-password - Change owner password (Protected)
  app.patch(
    "/auth/change-password",
    { preHandler: [(app as any).authenticateOwner] },
    async (request, reply) => {
      const ownerId = (request as any).user?.ownerId;
      if (!ownerId) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized",
        });
      }

      const parseResult = changePasswordSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          success: false,
          message: parseResult.error.issues[0]?.message || "Invalid password data",
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const { currentPassword, newPassword } = parseResult.data;

      const result = await authService.changePassword({
        ownerId,
        currentPassword,
        newPassword,
      });

      if (result.status === "NOT_FOUND") {
        return reply.code(404).send({
          success: false,
          message: "Owner not found",
        });
      }

      if (result.status === "INVALID_CURRENT_PASSWORD") {
        return reply.code(400).send({
          success: false,
          message: "Current password is incorrect",
        });
      }

      clearSessionCookie(reply, process.env.NODE_ENV === "production");

      return reply.send({
        success: true,
        message: "Password changed successfully. Please log in again.",
      });
    }
  );
}
