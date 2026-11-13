import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import { getAuthToken, saveAuthToken, clearSecureSession } from "./secure-store";
import { sanitizeErrorMessage } from "../utils/errors";
import type { ApiError } from "../types/api";

/**
 * Resolves the backend base URL for the mobile app.
 * Can be configured via EXPO_PUBLIC_API_URL in .env
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  // Sensible local dev fallback depending on platform
  if (Platform.OS === "android") {
    // Android emulator loops back to host via 10.0.2.2
    return "http://10.0.2.2:5001";
  }

  // iOS simulator, macOS, web
  return "http://localhost:5001";
}

export const API_BASE_URL = getApiBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
  // In React Native / mobile, withCredentials sends cookies if supported
  withCredentials: true,
});

// Listener for session expiration (401)
type SessionExpiredListener = () => void;
let sessionExpiredListener: SessionExpiredListener | null = null;

export function setSessionExpiredListener(listener: SessionExpiredListener | null): void {
  sessionExpiredListener = listener;
}

// Request Interceptor: Attach Bearer token and Cookie header from SecureStore
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        // Also provide standard Cookie header for cookie-based backend middleware compatibility
        config.headers.Cookie = `token=${token}`;
      }
    } catch {
      // SecureStore read failure - proceed without token
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Helper to extract JWT token from Set-Cookie header if present
function extractTokenFromSetCookie(setCookieHeader: string | string[] | undefined): string | null {
  if (!setCookieHeader) return null;
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const header of headers) {
    const match = header.match(/(?:^|;\s*)token=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
}

// Response Interceptor: Capture token, handle 401, normalize errors
apiClient.interceptors.response.use(
  async (response) => {
    // 1. Inspect response body for token (if backend returns it)
    const bodyToken = response.data?.token || response.data?.data?.token;
    if (bodyToken && typeof bodyToken === "string") {
      await saveAuthToken(bodyToken);
    } else {
      // 2. Inspect Set-Cookie header for token
      const cookieHeader =
        response.headers["set-cookie"] || (response.headers as any)["Set-Cookie"];
      const cookieToken = extractTokenFromSetCookie(cookieHeader);
      if (cookieToken) {
        await saveAuthToken(cookieToken);
      }
    }
    return response;
  },
  async (error: AxiosError<any>) => {
    // Handle 401 Unauthorized (Session Expired)
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      // Only trigger session expiration for non-login/non-register requests
      if (!url.includes("/auth/login") && !url.includes("/auth/register")) {
        await clearSecureSession();
        if (sessionExpiredListener) {
          sessionExpiredListener();
        }
      }
    }

    // Normalize error object
    const status = error.response?.status;
    const data = error.response?.data;
    const rawMessage = data?.message || error.message;
    const message = sanitizeErrorMessage(rawMessage);

    const normalizedError: ApiError = {
      message,
      status,
      errors: data?.errors,
      refId: data?.refId,
    };

    return Promise.reject(normalizedError);
  }
);

