import { config } from "dotenv";

// Neon CLI writes its variables at the workspace root. Do not override values
// already injected by a deployment platform or supplied in backend/.env.
config({ path: new URL("../../../.env.local", import.meta.url), override: false });
config({ override: false });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Run `neon deploy` from the workspace root.");
}
