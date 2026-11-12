import { resolveApiBaseUrl } from "./api-base";

export const API_BASE_URL: string = resolveApiBaseUrl(
  import.meta.env.PROD,
  import.meta.env.VITE_API_URL
);
