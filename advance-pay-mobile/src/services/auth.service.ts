import { apiClient } from "../lib/api-client";
import type { ApiResponse } from "../types/api";
import type { OwnerUser, LoginCredentials, RegisterCredentials } from "../types/auth";

export const authService = {
  /**
   * Log in an existing boutique owner
   * Endpoint: POST /auth/login
   */
  async login(credentials: LoginCredentials): Promise<{ user: OwnerUser; token?: string }> {
    const res = await apiClient.post<ApiResponse<OwnerUser>>("/auth/login", credentials);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Login failed");
    }
    const token = (res.data as any).token || (res.data.data as any).token;
    return {
      user: res.data.data,
      token,
    };
  },

  /**
   * Register a new boutique owner
   * Endpoint: POST /auth/register
   */
  async register(credentials: RegisterCredentials): Promise<{ user: OwnerUser; token?: string }> {
    const res = await apiClient.post<ApiResponse<OwnerUser>>("/auth/register", credentials);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Registration failed");
    }
    const token = (res.data as any).token || (res.data.data as any).token;
    return {
      user: res.data.data,
      token,
    };
  },

  /**
   * Check registration status
   * Endpoint: GET /auth/registration-status
   */
  async getRegistrationStatus(): Promise<{ registrationOpen: boolean; hasOwner: boolean }> {
    const res = await apiClient.get<ApiResponse<{ registrationOpen: boolean; hasOwner: boolean }>>(
      "/auth/registration-status"
    );
    return res.data.data || { registrationOpen: true, hasOwner: false };
  },

  /**
   * Fetch current authenticated owner profile (DB fresh)
   * Endpoint: GET /auth/me
   */
  async getMe(): Promise<OwnerUser> {
    const res = await apiClient.get<ApiResponse<OwnerUser>>("/auth/me");
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to fetch owner profile");
    }
    return res.data.data;
  },

  /**
   * Clear session on server and client
   * Endpoint: POST /auth/logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post<ApiResponse>("/auth/logout");
    } catch {
      // Proceed even if server is unreachable
    }
  },

  /**
   * Update owner profile details
   * Endpoint: PATCH /auth/profile
   */
  async updateProfile(data: { name?: string; phone?: string; businessName?: string }): Promise<OwnerUser> {
    const res = await apiClient.patch<ApiResponse<OwnerUser>>("/auth/profile", data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to update profile");
    }
    return res.data.data;
  },
};
