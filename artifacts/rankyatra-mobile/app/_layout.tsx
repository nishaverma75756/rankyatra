import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ActivityCountProvider } from "@/contexts/ActivityCountContext";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

async function registerForPushNotifications(): Promise<{ expoToken: string | null; fcmToken: string | null }> {
  const result = { expoToken: null as string | null, fcmToken: null as string | null };
  try {
    if (!Device.isDevice) return result;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return result;
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#f97316",
      });
    }
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "a04e437e-68e7-40e6-871c-15c6a209f2f3",
      });
      result.expoToken = tokenData.data;
    } catch {}
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      if (deviceToken?.data) result.fcmToken = deviceToken.data as string;
    } catch {}
  } catch {}
  return result;
}

function registerToken(authToken: string, pushToken: string) {
  fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/users/push-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ token: pushToken }),
  }).catch(() => {});
}

function PushNotificationSetup() {
  const { user, token } = useAuth();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!user || !token) return;

    registerForPushNotifications().then(({ expoToken, fcmToken }) => {
      if (expoToken) registerToken(token, expoToken);
      if (fcmToken) registerToken(token, fcmToken);
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === "message" && data?.conversationId) {
        router.push(`/chat/${data.conversationId}` as any);
      } else if (data?.type === "follow") {
        router.push("/notifications" as any);
      } else if (data?.postId) {
        router.push(`/post-comments?postId=${data.postId}` as any);
      } else if (data?.type === "new_post" || data?.type === "like" || data?.type === "comment" || data?.type === "reply") {
        router.push("/notifications" as any);
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
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
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
                <ActivityCountProvider>
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
                    <Stack.Screen name="notifications" options={{ presentation: "card" }} />
                    <Stack.Screen name="create-post" options={{ presentation: "card" }} />
                  </Stack>
                  <AppAlert />
                </AuthGuard>
                </ActivityCountProvider>
              </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
