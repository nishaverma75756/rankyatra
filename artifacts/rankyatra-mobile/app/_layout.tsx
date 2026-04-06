import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import React, { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AppAlert from "@/components/AppAlert";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

// Show notifications when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync();

let _onUnauthorized: (() => void) | null = null;
let _isLoggedIn = false;

export function setOnUnauthorized(fn: () => void) {
  _onUnauthorized = fn;
}

export function setIsLoggedIn(value: boolean) {
  _isLoggedIn = value;
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: any) => {
      // Only redirect to login if there's actually a logged-in user whose session expired.
      // Guests will always get 401s from protected endpoints — ignore those.
      if (_isLoggedIn && (error?.response?.status === 401 || error?.status === 401)) {
        _onUnauthorized?.();
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
    });
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "bbb5d5c2-3437-47d7-b53b-9d438e859888",
  });
  return tokenData.data;
}

function PushNotificationSetup() {
  const { user, token } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!user || !token) return;

    registerForPushNotifications().then((pushToken) => {
      if (!pushToken) return;
      fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/users/push-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token: pushToken }),
      }).catch(() => {});
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === "follow") {
        router.push("/(tabs)/notifications" as any);
      } else if (data?.postId) {
        router.push(`/post-comments?postId=${data.postId}` as any);
      }
    });

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, [user, token]);

  return null;
}

function GlobalHeartbeat() {
  const { user, token } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    const beat = () => {
      fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/me/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };
    beat();
    intervalRef.current = setInterval(beat, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user, token]);

  return null;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Keep the module-level flag in sync so the QueryCache 401 handler
  // knows whether to redirect (session expiry) or ignore (guest 401s).
  useEffect(() => {
    setIsLoggedIn(!!user);
  }, [user]);

  useEffect(() => {
    setOnUnauthorized(async () => {
      await logout();
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please log in again.",
        [{ text: "OK" }]
      );
      router.replace("/(auth)/login");
    });
  }, [logout, router]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      router.replace("/(tabs)/");
    }
  }, [user, isLoading, segments]);

  return <><GlobalHeartbeat /><PushNotificationSetup />{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
              <AuthProvider>
                <AuthGuard>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="exam/[id]" options={{ presentation: "card" }} />
                    <Stack.Screen name="exam/[id]/take" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
                    <Stack.Screen name="exam/[id]/results" options={{ presentation: "card" }} />
                    <Stack.Screen name="exam/[id]/answer-sheet" options={{ presentation: "card" }} />
                    <Stack.Screen name="change-credentials" options={{ presentation: "card" }} />
                    <Stack.Screen name="verify" options={{ presentation: "card" }} />
                    <Stack.Screen name="wallet/deposit" options={{ presentation: "card" }} />
                    <Stack.Screen name="wallet/withdraw" options={{ presentation: "card" }} />
                  </Stack>
                  <AppAlert />
                </AuthGuard>
              </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
