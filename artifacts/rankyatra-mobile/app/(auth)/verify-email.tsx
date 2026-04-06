import React, { useState, useRef, useEffect } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpStr = otp.join("");
    if (otpStr.length < 6) {
      showError("Incomplete OTP", "Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpStr }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      await login(json.token, json.user as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Verification Failed", e?.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await fetch(`${BASE_URL}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCountdown(30);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (e: any) {
      showError("Error", e?.message || "Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <View style={[styles.logoBox, { backgroundColor: colors.saffron }]}>
            <Feather name="mail" size={36} color="#0f0e17" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Verify Your Email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            A 6-digit OTP has been sent to{"\n"}<Text style={{ color: colors.primary, fontWeight: "700" }}>{email}</Text>
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                style={[
                  styles.otpBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: digit ? colors.primary : colors.border,
                    color: colors.foreground,
                  },
                ]}
                value={digit}
                onChangeText={val => handleOtpChange(i, val)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleVerify}
            disabled={loading || otp.join("").length < 6}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              {loading ? "Verifying..." : "Verify Email"}
            </Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
                Resend OTP in{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                <Text style={[styles.resendText, { color: colors.primary, fontWeight: "700" }]}>
                  {resending ? "Sending..." : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
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
  title: { fontSize: 26, fontWeight: "900", letterSpacing: -0.5, textAlign: "center" },
  subtitle: { fontSize: 14, marginTop: 8, textAlign: "center", lineHeight: 22 },
  form: { gap: 20 },
  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  otpBox: {
    width: 46, height: 56, borderWidth: 2, borderRadius: 12,
    fontSize: 24, fontWeight: "900",
  },
  primaryBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  primaryBtnText: { fontSize: 16, fontWeight: "800" },
  resendRow: { alignItems: "center" },
  resendText: { fontSize: 14 },
});
