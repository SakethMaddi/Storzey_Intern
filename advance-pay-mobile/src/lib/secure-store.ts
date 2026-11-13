import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "advance_pay_auth_token";
const USER_KEY = "advance_pay_auth_user";

/**
 * Expo SecureStore persists encrypted key-value pairs in:
 * - Keychain on iOS
 * - Keystore / EncryptedSharedPreferences on Android
 * On Web fallback, uses in-memory or sessionStorage (never unencrypted AsyncStorage).
 */

const memoryStore: Record<string, string> = {};

export async function saveAuthToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      sessionStorage.setItem(TOKEN_KEY, token);
    } catch {
      memoryStore[TOKEN_KEY] = token;
    }
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || memoryStore[TOKEN_KEY] || null;
    } catch {
      return memoryStore[TOKEN_KEY] || null;
    }
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteAuthToken(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      delete memoryStore[TOKEN_KEY];
    }
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function saveStoredUser(user: any): Promise<void> {
  const serialized = JSON.stringify(user);
  if (Platform.OS === "web") {
    try {
      sessionStorage.setItem(USER_KEY, serialized);
    } catch {
      memoryStore[USER_KEY] = serialized;
    }
    return;
  }
  await SecureStore.setItemAsync(USER_KEY, serialized, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getStoredUser<T>(): Promise<T | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === "web") {
      try {
        raw = sessionStorage.getItem(USER_KEY) || memoryStore[USER_KEY] || null;
      } catch {
        raw = memoryStore[USER_KEY] || null;
      }
    } else {
      raw = await SecureStore.getItemAsync(USER_KEY);
    }
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function deleteStoredUser(): Promise<void> {
  if (Platform.OS === "web") {
    try {
      sessionStorage.removeItem(USER_KEY);
    } catch {
      delete memoryStore[USER_KEY];
    }
    return;
  }
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function clearSecureSession(): Promise<void> {
  await deleteAuthToken();
  await deleteStoredUser();
}

