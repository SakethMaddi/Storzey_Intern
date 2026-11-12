import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateEnv } from "./lib/env.js";
import Fastify, { type FastifyInstance } from "fastify";
import { publicRoutes } from "./modules/public/public.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";

describe("Production Environment Validation (Task 2)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const validProdEnv = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:password@neon.tech:5432/advancepay?sslmode=require",
    JWT_SECRET: "a_very_long_secure_jwt_secret_for_production_2026_at_least_32_chars",
    FRONTEND_URL: "https://advancepay.example.com",
    RAZORPAY_KEY_ID: "rzp_test_1234567890abcdef",
    RAZORPAY_KEY_SECRET: "sec_live_abcdef1234567890",
    RAZORPAY_WEBHOOK_SECRET: "whsec_abcdef1234567890",
    PORT: "5001",
    DEMO_PAYMENTS_ENABLED: "false",
  };

  it("1. Missing production DATABASE_URL throws descriptive error", () => {
    process.env = { ...validProdEnv, DATABASE_URL: "" };
    expect(() => validateEnv(true)).toThrowError(/DATABASE_URL is required/i);
  });

  it("2. Invalid PostgreSQL URL throws descriptive error", () => {
    process.env = { ...validProdEnv, DATABASE_URL: "https://not-postgres.com" };
    expect(() => validateEnv(true)).toThrowError(/DATABASE_URL must have postgres: or postgresql: protocol/i);

    process.env = { ...validProdEnv, DATABASE_URL: "not_a_valid_url" };
    expect(() => validateEnv(true)).toThrowError(/DATABASE_URL is not a valid PostgreSQL connection URL/i);
  });

  it("3. Missing or weak JWT_SECRET fails in production", () => {
    process.env = { ...validProdEnv, JWT_SECRET: "" };
    expect(() => validateEnv(true)).toThrowError(/JWT_SECRET environment variable is missing/i);

    process.env = { ...validProdEnv, JWT_SECRET: "short_secret" };
    expect(() => validateEnv(true)).toThrowError(/JWT_SECRET must be at least 32 characters/i);

    process.env = { ...validProdEnv, JWT_SECRET: "advance_pay_super_secret_jwt_key_2026_change_in_production" };
    expect(() => validateEnv(true)).toThrowError(/JWT_SECRET is set to an insecure default/i);
  });

  it("4. Missing FRONTEND_URL fails in production", () => {
    process.env = { ...validProdEnv, FRONTEND_URL: "" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL is required in production/i);
  });

  it("5. HTTP FRONTEND_URL in production is rejected", () => {
    process.env = { ...validProdEnv, FRONTEND_URL: "http://advancepay.example.com" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL must use https: protocol in production/i);
  });

  it("6. Malformed FRONTEND_URL is rejected", () => {
    process.env = { ...validProdEnv, FRONTEND_URL: "not-a-valid-url" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL is not a valid absolute URL/i);
  });

  it("7. FRONTEND_URL with credentials, path, query, or fragment is rejected", () => {
    // Credentials
    process.env = { ...validProdEnv, FRONTEND_URL: "https://user:pass@advancepay.example.com" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL must not contain embedded username or password/i);

    // Path
    process.env = { ...validProdEnv, FRONTEND_URL: "https://advancepay.example.com/app" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL must not contain a path/i);

    // Query string
    process.env = { ...validProdEnv, FRONTEND_URL: "https://advancepay.example.com?foo=bar" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL must not contain a query string/i);

    // Fragment
    process.env = { ...validProdEnv, FRONTEND_URL: "https://advancepay.example.com#section" };
    expect(() => validateEnv(true)).toThrowError(/FRONTEND_URL must not contain a fragment/i);
  });

  it("8. Valid FRONTEND_URL returns normalized origin", () => {
    process.env = { ...validProdEnv, FRONTEND_URL: "https://advancepay.example.com/" };
    const validated = validateEnv(true);
    expect(validated.CORS_ORIGIN).toBe("https://advancepay.example.com");
  });

  it("9. Missing Razorpay credentials fail in production", () => {
    process.env = { ...validProdEnv, RAZORPAY_KEY_ID: "" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_KEY_ID is required in production/i);

    process.env = { ...validProdEnv, RAZORPAY_KEY_SECRET: "" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_KEY_SECRET is required in production/i);

    process.env = { ...validProdEnv, RAZORPAY_WEBHOOK_SECRET: "" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_WEBHOOK_SECRET is required in production/i);
  });

  it("10b. Live Razorpay keys are rejected in production", () => {
    process.env = { ...validProdEnv, RAZORPAY_KEY_ID: "rzp_live_1234567890abcdef" };
    expect(() => validateEnv(true)).toThrowError(/must be a Razorpay test-mode key/i);
  });

  it("10. Placeholder Razorpay credentials fail in production", () => {
    process.env = { ...validProdEnv, RAZORPAY_KEY_ID: "your_key_id" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_KEY_ID cannot be a placeholder/i);

    process.env = { ...validProdEnv, RAZORPAY_KEY_SECRET: "your_secret_key" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_KEY_SECRET cannot be a placeholder/i);

    process.env = { ...validProdEnv, RAZORPAY_WEBHOOK_SECRET: "your_webhook_secret" };
    expect(() => validateEnv(true)).toThrowError(/RAZORPAY_WEBHOOK_SECRET cannot be a placeholder/i);
  });

  it("11. DEMO_PAYMENTS_ENABLED=true fails in production startup", () => {
    process.env = { ...validProdEnv, DEMO_PAYMENTS_ENABLED: "true" };
    expect(() => validateEnv(true)).toThrowError(/DEMO_PAYMENTS_ENABLED must not be enabled in production/i);
  });

  it("12. Invalid PORT throws descriptive error", () => {
    process.env = { ...validProdEnv, PORT: "invalid-port" };
    expect(() => validateEnv(true)).toThrowError(/PORT must be an integer between 1 and 65535/i);

    process.env = { ...validProdEnv, PORT: "70000" };
    expect(() => validateEnv(true)).toThrowError(/PORT must be an integer between 1 and 65535/i);

    process.env = { ...validProdEnv, PORT: "0" };
    expect(() => validateEnv(true)).toThrowError(/PORT must be an integer between 1 and 65535/i);
  });

  it("13. Development mode succeeds without Razorpay credentials", () => {
    process.env = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@localhost:5432/devdb",
      JWT_SECRET: "dev_secret",
      PORT: "5001",
    };
    // Delete Razorpay credentials and FRONTEND_URL
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.FRONTEND_URL;

    const validated = validateEnv(false);
    expect(validated.isProduction).toBe(false);
    expect(validated.PORT).toBe(5001);
    expect(validated.RAZORPAY_KEY_ID).toBeUndefined();
    expect(validated.SMTP_HOST).toBeUndefined();
  });

  it("13b. Production boots without SMTP so mail stays disabled until configured", () => {
    process.env = { ...validProdEnv };
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
    const validated = validateEnv(true);
    expect(validated.SMTP_HOST).toBeUndefined();
    expect(validated.SMTP_PASS).toBeUndefined();
    expect(validated.PORT).toBe(5001);
  });

  it("14. Demo payment endpoints reject requests in production even if DEMO_PAYMENTS_ENABLED=true", async () => {
    // Spin up lightweight Fastify instance to test routes
    process.env.NODE_ENV = "production";
    process.env.DEMO_PAYMENTS_ENABLED = "true";

    const testApp: FastifyInstance = Fastify();
    testApp.decorate("authenticateOwner", async (request: any) => {
      request.user = { id: 1, role: "owner" };
    });

    await testApp.register(publicRoutes);
    await testApp.register(paymentRoutes);

    // Test public demo payment
    const publicRes = await testApp.inject({
      method: "POST",
      url: "/api/public/orders/tok_test123/demo-payment",
      payload: { amount: 500 },
    });
    expect(publicRes.statusCode).toBe(403);
    expect(publicRes.json().message).toBe("Demo payments are disabled");

    // Test owner demo payment
    const ownerRes = await testApp.inject({
      method: "POST",
      url: "/orders/1/demo-payment",
      payload: { amount: 500 },
    });
    expect(ownerRes.statusCode).toBe(403);
    expect(ownerRes.json().message).toBe("Demo payments are disabled");
  });

  it("15. Invalid production configuration prevents application server bootstrap", async () => {
    // Missing JWT_SECRET
    process.env = { ...validProdEnv, JWT_SECRET: "" };
    const { bootstrap } = await import("./server.js");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(bootstrap(false)).rejects.toThrowError(/JWT_SECRET environment variable is missing/i);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/JWT_SECRET environment variable is missing/i)
    );

    consoleErrorSpy.mockRestore();
  });

  it("16. Missing FRONTEND_URL prevents application server bootstrap", async () => {
    process.env = { ...validProdEnv, FRONTEND_URL: "" };
    const { bootstrap } = await import("./server.js");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(bootstrap(false)).rejects.toThrowError(/FRONTEND_URL is required in production/i);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/FRONTEND_URL is required in production/i)
    );

    consoleErrorSpy.mockRestore();
  });

  it("17. Missing Razorpay credentials prevent application server bootstrap", async () => {
    process.env = { ...validProdEnv, RAZORPAY_KEY_ID: "" };
    const { bootstrap } = await import("./server.js");
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(bootstrap(false)).rejects.toThrowError(/RAZORPAY_KEY_ID is required in production/i);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/RAZORPAY_KEY_ID is required in production/i)
    );

    consoleErrorSpy.mockRestore();
  });

  describe("Task 4: Graceful Shutdown Logic", () => {
    it("18. Shutdown sequence: Fastify closes before Prisma disconnects", async () => {
      const { setupGracefulShutdown } = await import("./server.js");
      const order: string[] = [];

      const mockApp = {
        close: vi.fn(async () => {
          order.push("app.close");
        }),
      } as any;

      const mockPrisma = {
        $disconnect: vi.fn(async () => {
          order.push("prisma.$disconnect");
        }),
      };

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { handleShutdown, removeListeners } = setupGracefulShutdown(mockApp, mockPrisma, {
        exitProcess: false,
      });

      try {
        await handleShutdown("SIGTERM");

        expect(order).toEqual(["app.close", "prisma.$disconnect"]);
        expect(mockApp.close).toHaveBeenCalledTimes(1);
        expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
        expect(process.exitCode).toBe(0);
      } finally {
        removeListeners();
        consoleLogSpy.mockRestore();
      }
    });

    it("19. Repeated shutdown signals do not trigger duplicate cleanup", async () => {
      const { setupGracefulShutdown } = await import("./server.js");

      const mockApp = {
        close: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10));
        }),
      } as any;

      const mockPrisma = {
        $disconnect: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 10));
        }),
      };

      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { handleShutdown, removeListeners } = setupGracefulShutdown(mockApp, mockPrisma, {
        exitProcess: false,
      });

      try {
        // Fire concurrent / repeated shutdown triggers
        await Promise.all([
          handleShutdown("SIGTERM"),
          handleShutdown("SIGTERM"),
          handleShutdown("SIGINT"),
        ]);

        expect(mockApp.close).toHaveBeenCalledTimes(1);
        expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
        expect(process.exitCode).toBe(0);
      } finally {
        removeListeners();
        consoleLogSpy.mockRestore();
      }
    });

    it("20. Cleanup failures produce a non-zero exit code and sanitized error", async () => {
      const { setupGracefulShutdown } = await import("./server.js");

      const mockApp = {
        close: vi.fn(async () => {
          throw new Error("Failed to close socket with connection postgres://user:secretpass@db.com:5432/app");
        }),
      } as any;

      const mockPrisma = {
        $disconnect: vi.fn(async () => {}),
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { handleShutdown, removeListeners } = setupGracefulShutdown(mockApp, mockPrisma, {
        exitProcess: false,
      });

      try {
        await expect(handleShutdown("SIGTERM")).rejects.toThrowError(
          /Failed to close socket with connection postgres:\/\/\[REDACTED\]@db\.com:5432\/app/
        );
        expect(process.exitCode).toBe(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error during graceful shutdown:",
          expect.stringContaining("postgres://[REDACTED]@")
        );
      } finally {
        removeListeners();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
      }
    });

    it("21. Timeout behavior when cleanup hangs triggers timeout error and non-zero exit code", async () => {
      const { setupGracefulShutdown } = await import("./server.js");

      // Mock Fastify close hanging indefinitely
      const mockApp = {
        close: vi.fn(async () => {
          await new Promise(() => {}); // never resolves
        }),
      } as any;

      const mockPrisma = {
        $disconnect: vi.fn(async () => {}),
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { handleShutdown, removeListeners } = setupGracefulShutdown(mockApp, mockPrisma, {
        timeoutMs: 50, // Short timeout for test
        exitProcess: false,
      });

      try {
        await expect(handleShutdown("SIGTERM")).rejects.toThrowError(/Shutdown timed out after 50ms/);
        expect(process.exitCode).toBe(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error during graceful shutdown:",
          expect.stringContaining("Shutdown timed out after 50ms")
        );
      } finally {
        removeListeners();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
      }
    });

    it("22. Signal listeners are cleaned up properly", async () => {
      const { setupGracefulShutdown } = await import("./server.js");

      const mockApp = { close: vi.fn(async () => {}) } as any;
      const mockPrisma = { $disconnect: vi.fn(async () => {}) };

      const termListenersBefore = process.listenerCount("SIGTERM");
      const intListenersBefore = process.listenerCount("SIGINT");

      const { removeListeners } = setupGracefulShutdown(mockApp, mockPrisma, {
        exitProcess: false,
      });

      expect(process.listenerCount("SIGTERM")).toBe(termListenersBefore + 1);
      expect(process.listenerCount("SIGINT")).toBe(intListenersBefore + 1);

      removeListeners();

      expect(process.listenerCount("SIGTERM")).toBe(termListenersBefore);
      expect(process.listenerCount("SIGINT")).toBe(intListenersBefore);
    });
  });
});
