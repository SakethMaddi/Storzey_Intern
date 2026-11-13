import Fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import cors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import rawBody from "fastify-raw-body";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { type ValidatedEnv, validateEnv } from "./lib/env.js";
import { isGlobalRateLimitExempt, trustedProxyClientIp } from "./lib/rate-limit.js";

// Feature route modules (imported after Prisma is ready)
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { stageRoutes } from "./modules/stages/stage.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { publicRoutes } from "./modules/public/public.routes.js";
import { webhookRoutes } from "./modules/webhooks/webhook.routes.js";
import { emailRoutes } from "./modules/email/email.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import prisma from "./lib/prisma.js";

function sanitizeSecretStrings(text: string): string {
  return text
    .replace(/postgres(?:ql)?:\/\/([^:]+):([^@]+)@/gi, "postgres://$1:[REDACTED]@")
    .replace(/(Bearer\s+)[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi, "$1[REDACTED]")
    .replace(/(rzp_(?:live|test)_[A-Za-z0-9]+)/gi, "[REDACTED_RAZORPAY_KEY]");
}

const DEVELOPMENT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export async function createServer(customEnv?: ValidatedEnv): Promise<FastifyInstance> {
  const env = customEnv || validateEnv();
  const isProduction = env.isProduction;

  const app = Fastify({
    bodyLimit: 128 * 1024, // 128 KB explicit request payload limit
    // Railway terminates TLS and appends one forwarding hop.
    // Trust only that nearest hop, not addresses a client writes further left.
    trustProxy: isProduction ? (_address: string, hop: number) => hop === 0 : false,
    logger: {
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        'req.headers["x-razorpay-signature"]',
        "req.body.password",
        "req.body.confirmPassword",
        "headers.authorization",
        "headers.cookie",
        'headers["x-razorpay-signature"]',
        "body.password",
        "body.confirmPassword",
        "authorization",
        "cookie",
        "password",
        "confirmPassword",
      ],
    },
  });

  // Production allows only FRONTEND_URL. Localhost stays available in development.
  const allowedOrigins = new Set<string>(isProduction ? [] : DEVELOPMENT_ORIGINS);
  if (env.CORS_ORIGIN) {
    allowedOrigins.add(env.CORS_ORIGIN);
  }

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        return cb(null, true);
      }
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (allowedOrigins.has(normalizedOrigin)) {
        return cb(null, true);
      }
      const corsError = new Error(`Origin ${origin} is not allowed by CORS`) as Error & {
        statusCode: number;
      };
      corsError.statusCode = 403;
      return cb(corsError, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  await app.register(fastifyCookie);

  app.decorate("env", env);
  app.decorate("prisma", prisma);

  // HTTP Security Headers via @fastify/helmet
  await app.register(fastifyHelmet, {
    // Disable CSP on JSON API responses to prevent collision with frontend/Razorpay Checkout
    contentSecurityPolicy: false,
    // Preserve cross-origin resource sharing for separate frontend/backend deployments
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    xFrameOptions: { action: "deny" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: isProduction
      ? {
          maxAge: 31536000, // 1 year
          includeSubDomains: false, // Set to false until every relevant subdomain is confirmed to support HTTPS
        }
      : false,
  });

  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });

  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // Support empty JSON bodies gracefully for PATCH/POST without body
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, defaultDone) => {
      const str = typeof body === "string" ? body : body?.toString() || "";
      if (str.trim() === "") {
        defaultDone(null, {});
        return;
      }
      try {
        defaultDone(null, JSON.parse(str));
      } catch (err: any) {
        defaultDone(err, undefined);
      }
    }
  );

  // Global Rate Limiting: 100 requests per minute per IP default (in-memory store)
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: 60 * 1000,
    keyGenerator: (req) => {
      const proxiedClient = trustedProxyClientIp(
        req.headers,
        process.env.PROXY_SHARED_SECRET
      );
      if (proxiedClient) return proxiedClient;
      // trustProxy derives req.ip from the single Railway hop. Client-supplied
      // X-Real-IP is not used, so a caller cannot pick their own limit bucket.
      return req.ip;
    },
    allowList: (req) => isGlobalRateLimitExempt(req.method, req.url),
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded, retry in ${context.after}`,
      success: false,
    }),
  });

  // Centralized Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    // 1. Zod Validation Errors
    if (error instanceof ZodError) {
      return reply.code(400).send({
        success: false,
        message: error.issues[0]?.message || "Validation failed",
        errors: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
    }

    // 2. Prisma Known Request Errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return reply.code(409).send({
          success: false,
          message: "A record with this unique identifier already exists",
        });
      }
      if (error.code === "P2025") {
        return reply.code(404).send({
          success: false,
          message: "Requested record not found",
        });
      }
    }

    // 3. Fastify HTTP Errors (e.g. 404 Route Not Found, 413 Payload Too Large)
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      const isSensitive = /prisma|sql|table|column|database|select|insert|update|delete|where/i.test(error.message || "");
      return reply.code(error.statusCode).send({
        success: false,
        message: isSensitive ? "Bad Request" : (error.message || "Bad Request"),
      });
    }

    // 4. Unexpected server errors (HTTP 500)
    // Never expose raw backend errors, Prisma messages, SQL queries, column names, file paths, or stack traces
    const refId = `ERR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    // Detailed diagnostic logging on server only
    if (error instanceof Error) {
      const sanitizedMsg = sanitizeSecretStrings(error.message);
      const safeError = new Error(sanitizedMsg);
      safeError.name = sanitizeSecretStrings(error.name || "Error");
      if (error.stack) {
        safeError.stack = sanitizeSecretStrings(error.stack);
      }
      if ((error as any).cause instanceof Error) {
        (safeError as any).cause = new Error(sanitizeSecretStrings((error as any).cause.message));
      }
      request.log.error(
        { refId, err: safeError, url: request.url, method: request.method, code: (error as any).code },
        "Internal server error occurred"
      );
    } else {
      request.log.error(
        { refId, rawError: sanitizeSecretStrings(String(error)), url: request.url, method: request.method },
        "Non-Error value rejected by server"
      );
    }

    const isLoginEndpoint = request.url?.startsWith("/auth/login");
    const safeMessage = isLoginEndpoint
      ? "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
      : "We couldn't complete your request right now. Please try again in a few moments. If the issue continues, contact support.";

    return reply.code(500).send({
      success: false,
      message: safeMessage,
      refId,
    });
  });

  // Authentication hook for protected owner endpoints
  app.decorate("authenticateOwner", async (request: any, reply: any) => {
    try {
      const isCookieAuth = Boolean(request.cookies?.token);
      const token =
        request.cookies?.token ||
        request.headers.authorization?.replace(/^Bearer\s+/, "");

      if (!token) {
        return reply.code(401).send({
          success: false,
          message: "Unauthorized. Authentication is required to access owner features.",
        });
      }
      const decoded = await app.jwt.verify(token);
      request.user = decoded;

      // CSRF Protection for browser cookie-authenticated state-changing requests (POST, PUT, PATCH, DELETE)
      const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
      if (isCookieAuth && stateChangingMethods.has(request.method)) {
        // 1. Origin / Referer Validation: verify request origin matches allowed frontend origins
        const rawOrigin = request.headers.origin || (request.headers.referer ? new URL(request.headers.referer).origin : undefined);
        if (rawOrigin) {
          const normalizedOrigin = String(rawOrigin).replace(/\/+$/, "");
          if (!allowedOrigins.has(normalizedOrigin)) {
            return reply.code(403).send({
              success: false,
              message: "Forbidden: Cross-site request rejected (unapproved Origin).",
            });
          }
        } else if (isProduction) {
          // In production, browser state-changing requests must present an Origin or Referer header
          return reply.code(403).send({
            success: false,
            message: "Forbidden: Missing request origin header.",
          });
        }

        // 2. Custom Request Header Verification:
        // Browsers prevent cross-origin forms from setting custom headers without CORS preflight approval.
        // We require X-Requested-With or X-AdvancePay-CSRF on cookie-authenticated mutations.
        const csrfHeader = request.headers["x-requested-with"] || request.headers["x-advancepay-csrf"];
        if (!csrfHeader) {
          return reply.code(403).send({
            success: false,
            message: "Forbidden: Missing CSRF protection header (X-Requested-With).",
          });
        }
      }
    } catch (err: any) {
      if (err.statusCode === 403) {
        return reply.code(403).send({
          success: false,
          message: err.message,
        });
      }
      return reply.code(401).send({
        success: false,
        message: "Session expired or invalid token. Please log in again.",
      });
    }
  });

  // Register feature route modules
  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(customerRoutes);
  await app.register(orderRoutes);
  await app.register(stageRoutes);
  await app.register(paymentRoutes);
  await app.register(webhookRoutes);
  await app.register(emailRoutes);
  await app.register(dashboardRoutes);

  // Health check endpoints for Railway / deployment platform probes
  app.get("/", async (_request, reply) => {
    return reply.code(200).send({ status: "ok", service: "advance-pay-backend" });
  });

  app.get("/health", async (_request, reply) => {
    return reply.code(200).send({ status: "ok", service: "advance-pay-backend" });
  });

  app.get("/api/health", async (_request, reply) => {
    return reply.code(200).send({ status: "ok", service: "advance-pay-backend" });
  });

  return app;
}

