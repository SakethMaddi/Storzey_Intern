import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { validateEnv, type ValidatedEnv } from "./lib/env.js";

export const LISTEN_HOST = "0.0.0.0";

export interface ShutdownOptions {
  timeoutMs?: number;
  exitProcess?: boolean;
}

/**
 * Creates and registers a graceful shutdown handler for Fastify and Prisma.
 */
export function setupGracefulShutdown(
  app: FastifyInstance,
  prisma: { $disconnect: () => Promise<any> },
  options: ShutdownOptions = {}
) {
  const timeoutMs = options.timeoutMs ?? 10000;
  const exitProcess = options.exitProcess ?? true;

  let isShuttingDown = false;
  let shutdownPromise: Promise<void> | null = null;

  const handleShutdown = async (signal: string): Promise<void> => {
    // 2. Idempotent guard prevents duplicate cleanup runs
    if (isShuttingDown && shutdownPromise) {
      return shutdownPromise;
    }
    isShuttingDown = true;

    // 3. Log the received signal
    console.log(`Received ${signal}. Starting graceful shutdown...`);

    shutdownPromise = (async () => {
      // 5. Add a 10-second shutdown timeout.
      // Keep the timeout referenced; do not call unref().
      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Shutdown timed out after ${timeoutMs}ms. Forcing exit.`));
        }, timeoutMs);
      });

      const cleanupPromise = (async () => {
        // Step 1: Call and await app.close() first
        await app.close();
        console.log("HTTP server closed.");

        // Step 1b: Stop background email outbox worker
        try {
          const { emailService } = await import("./modules/email/email.service.js");
          emailService.stopWorker();
          console.log("Email worker stopped.");
        } catch {}

        // Step 2: Then call and await prisma.$disconnect()
        await prisma.$disconnect();
        console.log("Database connection closed.");
      })();

      try {
        await Promise.race([cleanupPromise, timeoutPromise]);
        // 7. Clear the timeout after cleanup finishes
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Set process.exitCode = 0 after successful cleanup and allow natural Node.js exit
        process.exitCode = 0;
        console.log("Graceful shutdown completed successfully.");
      } catch (err: any) {
        // Clear timeout if still active
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        // Sanitize error message to avoid printing secrets
        const safeMsg = (err?.message || "Unknown shutdown error").replace(
          /postgres(?:ql)?:\/\/[^@]+@/gi,
          "postgres://[REDACTED]@"
        );
        console.error("Error during graceful shutdown:", safeMsg);
        process.exitCode = 1;
        if (exitProcess) {
          process.exit(1);
        }
        throw new Error(safeMsg);
      }
    })();

    return shutdownPromise;
  };

  const onSigTerm = () => {
    handleShutdown("SIGTERM").catch(() => {});
  };
  const onSigInt = () => {
    handleShutdown("SIGINT").catch(() => {});
  };

  process.on("SIGTERM", onSigTerm);
  process.on("SIGINT", onSigInt);

  // Return teardown function for tests to clean up registered signal listeners
  const removeListeners = () => {
    process.removeListener("SIGTERM", onSigTerm);
    process.removeListener("SIGINT", onSigInt);
  };

  return {
    handleShutdown,
    removeListeners,
  };
}

/**
 * Bootstrap sequence:
 * 1. Validate complete environment first.
 *    If invalid, throws error and exits immediately before Fastify or any module importing Prisma is loaded.
 * 2. Dynamically import the application server module only after validation succeeds.
 * 3. Start listening on the validated port.
 * 4. Register graceful shutdown handlers.
 */
export async function bootstrap(exitOnError: boolean = true) {
  try {
    const validatedEnv: ValidatedEnv = validateEnv();

    // Dynamically load server and prisma only after validation passes
    const { createServer } = await import("./app.js");
    const prismaModule = await import("./lib/prisma.js");
    const prisma = prismaModule.default;

    const app = await createServer(validatedEnv);

    // Register graceful shutdown handlers
    setupGracefulShutdown(app, prisma, {
      timeoutMs: 10000,
      exitProcess: true,
    });

    await app.listen({
      port: validatedEnv.PORT,
      host: LISTEN_HOST,
    });
    console.log(`Server running at http://localhost:${validatedEnv.PORT}`);

    // Start durable background email outbox worker (immediate recovery + periodic 30s polling)
    try {
      const { emailService } = await import("./modules/email/email.service.js");
      emailService.startWorker(30000);
      console.log("Email outbox worker started.");
    } catch (e: any) {
      console.error("Failed to start email worker:", e.message);
    }

    return app;
  } catch (error: any) {
    console.error(error.message || error);
    if (exitOnError) {
      process.exit(1);
    }
    throw error;
  }
}

// Start application if directly executed as entrypoint (e.g. node dist/server.js or tsx src/server.ts)
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  bootstrap(true);
}
