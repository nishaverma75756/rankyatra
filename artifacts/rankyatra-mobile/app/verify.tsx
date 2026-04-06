import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Platform, Image, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";

interface VerifyStatus {
  verificationStatus: string;
  latestRequest: {
    id: number;
    status: string;
    adminNote?: string;
    createdAt: string;
  } | null;
}

const STATUS_CONFIG = {
  not_submitted: { label: "Not Verified", icon: "alert-circle", color: "#ef4444", bg: "#fef2f2" },
  under_review:  { label: "Under Review", icon: "clock",        color: "#f59e0b", bg: "#fffbeb" },
  verified:      { label: "Verified",      icon: "check-circle", color: "#059669", bg: "#f0fdf4" },
  rejected:      { label: "Rejected",      icon: "x-circle",     color: "#dc2626", bg: "#fef2f2" },
};

export default function VerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser, token } = useAuth();
  const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  const [statusData, setStatusData] = useState<VerifyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [govtId, setGovtId] = useState("");
  const [panCard, setPanCard] = useState<{ base64: string; mimeType: string; uri: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${baseUrl}/api/verify/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStatusData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [token, baseUrl]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const pickPanCard = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showError("Permission needed to select Aadhaar Card or PAN Card image"); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? "image/jpeg";
      if (!asset.base64) { showError("Failed to read image"); return; }
      setPanCard({ base64: asset.base64, mimeType, uri: asset.uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSubmit = async () => {
    if (!govtId.trim()) { showError("Please enter your Govt ID number"); return; }
    if (!panCard) { showError("Please upload your Aadhaar Card or PAN Card image"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/api/verify/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          govtId: govtId.trim(),
          panCardBase64: panCard.base64,
          panCardMimeType: panCard.mimeType,
        }),
      });

      const data = await res.json();
      if (!res.ok) { showError(data.error ?? "Submission failed"); return; }

      updateUser({ verificationStatus: "under_review" } as any);
      setStatusData({ verificationStatus: "under_review", latestRequest: { id: 0, status: "pending", createdAt: new Date().toISOString() } });
      showSuccess("Verification submitted! We'll review it within 24-48 hours.");
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = statusData?.verificationStatus ?? user?.verificationStatus ?? "not_submitted";
  const cfg = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_submitted;

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile Verification</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      ) : (
        <>
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: cfg.color + "18" }]}>
            <View style={[styles.statusIconBox, { backgroundColor: cfg.color + "25" }]}>
              <Feather name={cfg.icon as any} size={28} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
              {statusData?.latestRequest?.adminNote && (
                <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                  Admin note: {statusData.latestRequest.adminNote}
                </Text>
              )}
              {currentStatus === "under_review" && (
                <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                  Your documents are being reviewed. Usually takes 24-48 hours.
                </Text>
              )}
              {currentStatus === "verified" && (
                <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                  Your profile is fully verified. You can withdraw funds.
                </Text>
              )}
              {currentStatus === "not_submitted" && (
                <Text style={[styles.statusNote, { color: colors.mutedForeground }]}>
                  Submit your Govt ID, Aadhaar Card or PAN Card to get verified.
                </Text>
              )}
            </View>
          </View>

          {/* Why verify? */}
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Why verify?</Text>
            {["Unlock withdrawal of winnings", "Comply with KYC regulations", "Protect your account"].map((p, i) => (
              <View key={i} style={styles.bulletRow}>
                <Feather name="check" size={14} color={colors.primary} />
                <Text style={[styles.bulletText, { color: colors.mutedForeground }]}>{p}</Text>
              </View>
            ))}
          </View>

          {/* Form — only if not verified / not under review */}
          {(currentStatus === "not_submitted" || currentStatus === "rejected") && (
            <View style={styles.formSection}>
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Submit Verification</Text>

              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Govt ID Number (Aadhaar / PAN)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={govtId}
                onChangeText={setGovtId}
                placeholder="Enter your Govt ID number"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="characters"
              />

              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Aadhaar Card or PAN Card</Text>
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={pickPanCard}
                activeOpacity={0.8}
              >
                {panCard ? (
                  <View style={styles.previewRow}>
                    <Image source={{ uri: panCard.uri }} style={styles.previewThumb} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.uploadLabel, { color: colors.foreground }]}>Document selected</Text>
                      <Text style={[styles.uploadSub, { color: colors.mutedForeground }]}>Tap to change</Text>
                    </View>
                    <Feather name="check-circle" size={20} color="#059669" />
                  </View>
                ) : (
                  <View style={styles.uploadInner}>
                    <View style={[styles.uploadIcon, { backgroundColor: colors.primary + "18" }]}>
                      <Feather name="upload" size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.uploadLabel, { color: colors.foreground }]}>Upload Aadhaar Card or PAN Card</Text>
                    <Text style={[styles.uploadSub, { color: colors.mutedForeground }]}>JPG or PNG, max 5MB</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: submitting ? colors.muted : colors.primary }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <>
                      <Feather name="send" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Submit for Verification</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  statusBanner: { margin: 20, borderRadius: 18, padding: 20, flexDirection: "row", gap: 16, alignItems: "flex-start" },
  statusIconBox: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  statusNote: { fontSize: 13, lineHeight: 18 },
  infoCard: { marginHorizontal: 20, borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  infoTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  bulletText: { fontSize: 13 },
  formSection: { paddingHorizontal: 20 },
  formTitle: { fontSize: 17, fontWeight: "800", marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  uploadBtn: { borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", overflow: "hidden", marginTop: 4 },
  uploadInner: { alignItems: "center", paddingVertical: 28, gap: 8 },
  uploadIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  uploadLabel: { fontSize: 15, fontWeight: "600" },
  uploadSub: { fontSize: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  previewThumb: { width: 56, height: 56, borderRadius: 10 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 16, marginTop: 24 },
  submitText: { fontSize: 16, fontWeight: "800" },
});
