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
import * as WebBrowser from "expo-web-browser";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { login as loginApi } from "@workspace/api-client-react";

const PROD_URL = "https://rankyatra.in";
const OAUTH_SERVER = "https://rankyatra.niskutech.com";
// HTTPS redirect — custom scheme (rankyatra://) not reliable with Chrome Custom Tabs on Android
const MOBILE_OAUTH_REDIRECT = `${OAUTH_SERVER}/mobile-oauth`;

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showError("Missing Fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await loginApi({ email: email.trim().toLowerCase(), password });
      await login(res.token, res.user as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Login Failed", e?.response?.data?.message || e?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Use HTTPS redirect — Chrome Custom Tabs intercepts HTTPS reliably on all Android versions
      // Custom schemes (rankyatra://) get stuck on many Android/Chrome combinations
      const result = await WebBrowser.openAuthSessionAsync(
        `${OAUTH_SERVER}/api/auth/google?mobile=1`,
        MOBILE_OAUTH_REDIRECT,
        { showInRecents: false }
      );

      if (result.type === "cancel" || result.type === "dismiss") {
        return; // User cancelled — no error
      }

      if (result.type === "success" && result.url) {
        const urlObj = new URL(result.url);
        const token = urlObj.searchParams.get("token");
        const error = urlObj.searchParams.get("error");

        if (error) throw new Error(decodeURIComponent(error));
        if (!token) throw new Error("Google login se token nahi mila. Dobara try karo.");

        const userRes = await fetch(`${PROD_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!userRes.ok) throw new Error("User info load nahi ho saka.");
        const user = await userRes.json();

        await login(token, user);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/");
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showError("Google Sign-In Failed", e?.message || "Kuch problem aayi. Dobara try karo.");
    } finally {
      setGoogleLoading(false);
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
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome back</Text>

          {/* Google Sign-In Button */}
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
              {googleLoading ? "Signing in..." : "Continue with Google"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
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
            <Feather name="lock" size={18} color={colors.mutedForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Password"
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
            onPress={handleLogin}
            disabled={loading}
            testID="login-btn"
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              {loading ? "Signing in..." : "Sign In"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={[styles.linkText, { color: colors.primary, fontWeight: "600" }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.push("/(auth)/signup")}
          >
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Don't have an account?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign Up</Text>
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
  googleIconText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4285F4",
  },
  googleBtnText: { fontSize: 15, fontWeight: "700" },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 2,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontWeight: "500" },
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
