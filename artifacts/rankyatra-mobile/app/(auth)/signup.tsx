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
  Image,
} from "react-native";
import { showError } from "@/utils/alert";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { signup as signupApi } from "@workspace/api-client-react";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Native Google Sign-In ──────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      showError("Configuration Error", "Google Sign-In is not configured. Please contact support.");
      return;
    }
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      if (!idToken) throw new Error("Google token nahi mila. Dobara try karo.");

      const serverRes = await fetch(`${BASE_URL}/api/auth/google-native`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const data = await serverRes.json();
      if (!serverRes.ok) throw new Error(data.error || "Google Sign-In failed");

      await login(data.token, data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED) return;
        if (e.code === statusCodes.IN_PROGRESS) return;
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          showError("Google Sign-In", "Google Play Services not available on this device.");
          return;
        }
      }
      showError("Google Sign-In Failed", e?.message || "Kuch problem aayi. Dobara try karo.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      showError("Missing Fields", "Please fill all fields to create your account.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      showError("Invalid Number", "Please enter a valid 10-digit mobile number.");
      return;
    }
    if (password.length < 8) {
      showError("Weak Password", "Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      const res = await signupApi({ name: name.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() }) as any;
      if (res.requiresVerification) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace({ pathname: "/(auth)/verify-email", params: { email: res.email } });
        return;
      }
      if (res.token) await login(res.token, res.user as any);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Sign Up Failed", e?.response?.data?.message || e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Close bar — always above everything */}
      <View style={[styles.closeBar, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 8) }]}>
        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.replace("/(tabs)/")}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoSection}>
          <Image
            source={require("../../assets/images/full-logo.png")}
            style={styles.fullLogo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.form}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Create account</Text>

          {/* Google Sign-Up Button */}
          <TouchableOpacity
            style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: googleLoading ? 0.7 : 1 }]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}
            activeOpacity={0.8}
          >
            <View style={styles.googleIcon}>
              <Text style={styles.googleIconText}>G</Text>
            </View>
            <Text style={[styles.googleBtnText, { color: colors.foreground }]}>
              {googleLoading ? "Signing up..." : "Continue with Google"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or sign up with email</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="user" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              testID="name-input"
            />
          </View>

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
              testID="email-input"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="phone" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Mobile number (10 digits)"
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
              keyboardType="phone-pad"
              maxLength={10}
              testID="phone-input"
            />
          </View>

          <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Password (min 8 chars)"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              testID="password-input"
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)}>
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleSignup}
            disabled={loading}
            testID="signup-btn"
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              {loading ? "Creating account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Already have an account?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, flexGrow: 1 },
  logoSection: { alignItems: "center", marginBottom: 24 },
  fullLogo: { width: 220, height: 180 },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#f97316",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  tagline: { fontSize: 15, marginTop: 4 },
  form: { gap: 14 },
  formTitle: { fontSize: 24, fontWeight: "800", marginBottom: 6 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  input: { flex: 1, fontSize: 16 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
  },
  googleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  googleIconText: { fontSize: 13, fontWeight: "900", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "700" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500" },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "800" },
  linkBtn: { alignItems: "center", marginTop: 4 },
  linkText: { fontSize: 14 },
  closeBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
