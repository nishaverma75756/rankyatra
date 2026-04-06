import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";

export default function ChangeCredentialsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);

  const hasEmailChanged = email.trim() !== (user?.email ?? "");
  const hasPhoneChanged = phone.trim() !== (user?.phone ?? "");
  const hasChanges = hasEmailChanged || hasPhoneChanged;

  const handleSave = async () => {
    const emailTrimmed = email.trim();
    const phoneTrimmed = phone.trim();

    if (hasEmailChanged && !emailTrimmed.includes("@")) {
      showError("Please enter a valid email address");
      return;
    }
    if (hasPhoneChanged && phoneTrimmed.length < 6) {
      showError("Please enter a valid mobile number");
      return;
    }
    if (!hasChanges) return;

    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (hasEmailChanged) body.email = emailTrimmed;
      if (hasPhoneChanged) body.phone = phoneTrimmed;

      const res = await fetch(`${baseUrl}/api/users/profile`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        showError(data.error ?? "Update failed. Please try again.");
        return;
      }

      updateUser({ email: emailTrimmed, phone: phoneTrimmed } as any);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showSuccess("Details updated successfully!");
      router.back();
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Change Email & Mobile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            You can update your registered email ID and mobile number here. Make sure the new details are correct.
          </Text>
        </View>

        {/* Current Details */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CURRENT DETAILS</Text>
        <View style={[styles.currentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.currentRow}>
            <Feather name="mail" size={14} color={colors.mutedForeground} />
            <Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.currentValue, { color: colors.foreground }]} numberOfLines={1}>
              {user?.email ?? "—"}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.currentRow}>
            <Feather name="phone" size={14} color={colors.mutedForeground} />
            <Text style={[styles.currentLabel, { color: colors.mutedForeground }]}>Mobile</Text>
            <Text style={[styles.currentValue, { color: colors.foreground }]}>
              {user?.phone ?? "Not added"}
            </Text>
          </View>
        </View>

        {/* New Details Form */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>NEW DETAILS</Text>

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>New Email ID</Text>
        <View style={[
          styles.inputBox,
          {
            backgroundColor: colors.card,
            borderColor: hasEmailChanged ? colors.primary : colors.border,
          },
        ]}>
          <Feather name="mail" size={17} color={hasEmailChanged ? colors.primary : colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={email}
            onChangeText={setEmail}
            placeholder={user?.email ?? "Enter new email"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hasEmailChanged && (
            <TouchableOpacity onPress={() => setEmail(user?.email ?? "")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>New Mobile Number</Text>
        <View style={[
          styles.inputBox,
          {
            backgroundColor: colors.card,
            borderColor: hasPhoneChanged ? colors.primary : colors.border,
          },
        ]}>
          <Feather name="phone" size={17} color={hasPhoneChanged ? colors.primary : colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={user?.phone ?? "Enter new mobile number"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
          />
          {hasPhoneChanged && (
            <TouchableOpacity onPress={() => setPhone(user?.phone ?? "")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: hasChanges && !saving ? colors.primary : colors.muted },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="check" size={18} color={hasChanges ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.saveBtnText, { color: hasChanges ? colors.primaryForeground : colors.mutedForeground }]}>
                Save Changes
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  body: { paddingHorizontal: 20, paddingTop: 20 },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 4,
  },
  currentCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  currentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  currentLabel: { fontSize: 13, fontWeight: "600", width: 52 },
  currentValue: { flex: 1, fontSize: 14, fontWeight: "500" },
  divider: { height: 1, marginHorizontal: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 16 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
    marginBottom: 4,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 13 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 28,
  },
  saveBtnText: { fontSize: 16, fontWeight: "800" },
  cancelBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  cancelText: { fontSize: 15, fontWeight: "600" },
});
