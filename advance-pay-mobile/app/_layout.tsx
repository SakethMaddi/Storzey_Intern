import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/query-client";
import { AuthProvider } from "../src/context/auth-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
            <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
            <Stack.Screen name="customers/new" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="customers/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="orders/new" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="orders/[id]" options={{ animation: "slide_from_right" }} />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

