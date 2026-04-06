import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image } from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface GuestScreenProps {
  icon?: string;
  title?: string;
  subtitle?: string;
}

export function GuestScreen({
  icon = "lock",
  title = "Login Required",
  subtitle = "Please sign in to access this feature",
}: GuestScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: colors.secondary }]}>
        <Image
          source={require("../assets/images/logo.png")}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.authRow}>
          <TouchableOpacity
            style={[styles.signInBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={[styles.signInText, { color: colors.primaryForeground }]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signUpBtn, { borderColor: colors.primary }]}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={[styles.signUpText, { color: colors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        <Image
          source={require("@/assets/images/full-logo.png")}
          style={styles.fullLogo}
          resizeMode="contain"
        />
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>

        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(auth)/login")}
          activeOpacity={0.85}
        >
          <Feather name="log-in" size={17} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.ctaText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.registerBtn, { borderColor: colors.border }]}
          onPress={() => router.push("/(auth)/signup")}
          activeOpacity={0.85}
        >
          <Text style={[styles.registerText, { color: colors.foreground }]}>Create an Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerLogo: { height: 36, width: 140 },
  authRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  signInBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  signInText: { fontSize: 13, fontWeight: "700" },
  signUpBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  signUpText: { fontSize: 13, fontWeight: "700" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  fullLogo: { width: 200, height: 200, marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 20, marginBottom: 8 },
  ctaBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, width: "100%",
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  registerBtn: {
    paddingVertical: 13, paddingHorizontal: 40, borderRadius: 14,
    width: "100%", alignItems: "center", borderWidth: 1.5,
  },
  registerText: { fontSize: 15, fontWeight: "700" },
});
