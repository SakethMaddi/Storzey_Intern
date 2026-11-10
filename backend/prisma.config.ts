import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Neon CLI writes service variables to the workspace root. Load them first so
// local backend-only values in backend/.env remain available without replacing
// the deployed database connection.
config({ path: "../.env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma migrations require a direct connection rather than PgBouncer.
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
