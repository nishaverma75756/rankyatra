import React, { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { showError } from "@/utils/alert";
import * as Haptics from "expo-haptics";
import { Image } from "react-native";
import * as WebBrowser from "expo-web-browser";

// Required: tells expo-web-browser to close the auth session on this screen
WebBrowser.maybeCompleteAuthSession();

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function OAuthCallbackScreen() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
  const { login } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const handle = async () => {
      try {
        if (error) throw new Error(decodeURIComponent(String(error)));
        if (!token) throw new Error("Google login se token nahi mila. Dobara try karo.");

        const res = await fetch(`${BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("User info load nahi ho saka.");
        const user = await res.json();

        await login(String(token), user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/");
      } catch (e: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        showError("Google Sign-In Failed", e?.message || "Kuch problem aayi. Dobara try karo.");
        router.replace("/(auth)/login");
      }
    };

    handle();
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/full-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color="#f97316" style={styles.spinner} />
      <Text style={styles.text}>Completing sign-in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 32,
  },
  logo: {
    width: 180,
    height: 120,
    marginBottom: 32,
  },
  spinner: {
    marginBottom: 16,
  },
  text: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },
});
