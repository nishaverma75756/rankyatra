import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { showError } from "@/utils/alert";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      showError("Required", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setSent(true);
    } catch (e: any) {
      showError("Error", e?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12, backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="arrow-left" size={18} color={colors.foreground} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.saffron }]}>
            <Feather name={sent ? "check-circle" : "lock"} size={36} color="#0f0e17" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {sent ? "Email Sent!" : "Forgot Password?"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {sent
              ? "If this email is registered, a password reset link has been sent."
              : "Enter your registered email and we will send you a reset link."}
          </Text>
        </View>

        {sent ? (
          <View style={styles.form}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="mail" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  logoSection: { alignItems: "center", marginBottom: 40 },
  logoBox: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    shadowColor: "#f97316", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  title: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 20 },
  form: { gap: 14 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  input: { flex: 1, fontSize: 16 },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 6 },
  primaryBtnText: { fontSize: 16, fontWeight: "800" },
  backBtn: {
    position: "absolute", left: 16, zIndex: 99,
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
});
