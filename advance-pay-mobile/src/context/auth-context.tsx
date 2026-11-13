import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "../services/auth.service";
import {
  getAuthToken,
  saveAuthToken,
  getStoredUser,
  saveStoredUser,
  clearSecureSession,
} from "../lib/secure-store";
import { setSessionExpiredListener } from "../lib/api-client";
import type { OwnerUser, LoginCredentials, RegisterCredentials } from "../types/auth";

interface AuthContextValue {
  user: OwnerUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionChecked: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OwnerUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionChecked, setSessionChecked] = useState<boolean>(false);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      await clearSecureSession();
      setUser(null);
    }
  }, []);

  const checkSession = useCallback(async () => {
    try {
      setIsLoading(true);
      // 1. Check if token or cached user is in SecureStore
      const token = await getAuthToken();
      const cachedUser = await getStoredUser<OwnerUser>();

      if (cachedUser) {
        setUser(cachedUser);
      }

      // 2. If token exists or cookie is available, verify with backend GET /auth/me
      if (token || cachedUser) {
        try {
          const freshUser = await authService.getMe();
          setUser(freshUser);
          await saveStoredUser(freshUser);
        } catch (err: any) {
          // If server rejects with 401, clear session
          if (err?.status === 401) {
            await clearSecureSession();
            setUser(null);
          }
        }
      }
    } catch {
      // Safe fallback
    } finally {
      setIsLoading(false);
      setSessionChecked(true);
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { user: loggedInUser, token } = await authService.login(credentials);
      if (token) {
        await saveAuthToken(token);
      }
      await saveStoredUser(loggedInUser);
      setUser(loggedInUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    setIsLoading(true);
    try {
      const { user: registeredUser, token } = await authService.register(credentials);
      if (token) {
        await saveAuthToken(token);
      }
      await saveStoredUser(registeredUser);
      setUser(registeredUser);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await authService.getMe();
      setUser(freshUser);
      await saveStoredUser(freshUser);
    } catch (err: any) {
      if (err?.status === 401) {
        await logout();
      }
    }
  }, [logout]);

  useEffect(() => {
    // Register automatic session expiry listener for 401 responses
    setSessionExpiredListener(() => {
      setUser(null);
    });

    checkSession();

    return () => {
      setSessionExpiredListener(null);
    };
  }, [checkSession]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    sessionChecked,
    login,
    register,
    logout,
    checkSession,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}
