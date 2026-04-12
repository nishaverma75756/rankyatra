import React, { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const CONTENT_TYPES = [
  "Education / Study Tips",
  "Current Affairs / News",
  "Exam Preparation",
  "Motivational / Inspiration",
  "Entertainment",
  "Other",
];

type ApplicationStatus = "pending" | "approved" | "rejected" | null;

interface Application {
  id: number;
  status: ApplicationStatus;
  adminNote?: string | null;
  instagramHandle?: string | null;
  youtubeChannel?: string | null;
  facebookHandle?: string | null;
  twitterHandle?: string | null;
  contentType?: string | null;
  reason: string;
  createdAt: string;
}

export default function ApplyForReelsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const [application, setApplication] = useState<Application | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);

  const [instagramHandle, setInstagramHandle] = useState("");
  const [youtubeChannel, setYoutubeChannel] = useState("");
  const [facebookHandle, setFacebookHandle] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [contentType, setContentType] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchApplication();
  }, []);

  const fetchApplication = async () => {
    setLoadingApp(true);
    try {
      const res = await fetch(`${BASE_URL}/api/reels/my-application`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.application) {
          setApplication(data.application);
          setInstagramHandle(data.application.instagramHandle ?? "");
          setYoutubeChannel(data.application.youtubeChannel ?? "");
          setFacebookHandle(data.application.facebookHandle ?? "");
          setTwitterHandle(data.application.twitterHandle ?? "");
          setContentType(data.application.contentType ?? "");
          setReason(data.application.reason ?? "");
        }
      }
    } catch {}
    setLoadingApp(false);
  };

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      showError("Please write a reason with at least 10 characters explaining why you want to post reels.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/reels/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instagramHandle: instagramHandle.trim() || null,
          youtubeChannel: youtubeChannel.trim() || null,
          facebookHandle: facebookHandle.trim() || null,
          twitterHandle: twitterHandle.trim() || null,
          contentType: contentType || null,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error ?? "Failed to submit application");
        return;
      }
      setApplication(data.application);
      showSuccess("Application submitted! We will review it soon.");
    } catch {
      showError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const statusColor = (status: ApplicationStatus) => {
    if (status === "approved") return "#22c55e";
    if (status === "rejected") return "#ef4444";
    return "#f59e0b";
  };
  const statusIcon = (status: ApplicationStatus) => {
    if (status === "approved") return "check-circle";
    if (status === "rejected") return "x-circle";
    return "clock";
  };
  const statusLabel = (status: ApplicationStatus) => {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Under Review";
  };

  if (loadingApp) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.navBar, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.foreground }]}>Apply for Reels</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={[styles.heroCard, { backgroundColor: "#a855f715", borderColor: "#a855f730" }]}>
          <View style={[styles.heroIcon, { backgroundColor: "#a855f720" }]}>
            <Feather name="film" size={28} color="#a855f7" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Reel Creator Program</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Not everyone can post reels — it's exclusive. Apply to join our creator program and showcase your content to the RankYatra community.
          </Text>
        </View>

        {/* Application Status Banner */}
        {application && (
          <View style={[
            styles.statusBanner,
            { backgroundColor: statusColor(application.status) + "18", borderColor: statusColor(application.status) + "50" },
          ]}>
            <Feather name={statusIcon(application.status) as any} size={20} color={statusColor(application.status)} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusLabel, { color: statusColor(application.status) }]}>
                {statusLabel(application.status)}
              </Text>
              {application.status === "pending" && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Your application is being reviewed. We'll notify you once a decision is made.
                </Text>
              )}
              {application.status === "approved" && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  You are now authorized to post reels on RankYatra!
                </Text>
              )}
              {application.status === "rejected" && (
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  {application.adminNote
                    ? `Reason: ${application.adminNote}`
                    : "Your application was not approved at this time. You may reapply below."}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* If approved, show success state */}
        {application?.status === "approved" ? (
          <View style={[styles.approvedBox, { backgroundColor: "#22c55e15", borderColor: "#22c55e40" }]}>
            <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>🎉</Text>
            <Text style={[styles.approvedTitle, { color: "#22c55e" }]}>You're a Reel Creator!</Text>
            <Text style={[styles.approvedSub, { color: colors.mutedForeground }]}>
              Go to the Moments tab → tap the + button → Create Reel to start posting.
            </Text>
            <TouchableOpacity
              style={[styles.goBtn, { backgroundColor: "#a855f7" }]}
              onPress={() => router.replace("/(tabs)/moments" as any)}
            >
              <Feather name="film" size={18} color="#fff" />
              <Text style={styles.goBtnText}>Go to Moments</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Form */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {application?.status === "rejected" ? "Re-apply" : "Your Application"}
            </Text>

            {/* Auto-filled user info */}
            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Name</Text>
              <Text style={[styles.infoVal, { color: colors.foreground }]}>{user?.name}</Text>
            </View>
            <View style={[styles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="mail" size={16} color={colors.mutedForeground} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Email</Text>
              <Text style={[styles.infoVal, { color: colors.foreground }]}>{user?.email}</Text>
            </View>

            {/* Social handles */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Instagram Handle (optional)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.atSign, { color: colors.mutedForeground }]}>@</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="your_instagram"
                placeholderTextColor={colors.mutedForeground}
                value={instagramHandle}
                onChangeText={setInstagramHandle}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>YouTube Channel Name (optional)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="youtube" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="Your Channel Name"
                placeholderTextColor={colors.mutedForeground}
                value={youtubeChannel}
                onChangeText={setYoutubeChannel}
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Facebook Profile (optional)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="facebook" size={16} color={colors.mutedForeground} style={{ marginRight: 6 }} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="facebook.com/yourprofile"
                placeholderTextColor={colors.mutedForeground}
                value={facebookHandle}
                onChangeText={setFacebookHandle}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Twitter / X Handle (optional)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.atSign, { color: colors.mutedForeground }]}>@</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="your_twitter"
                placeholderTextColor={colors.mutedForeground}
                value={twitterHandle}
                onChangeText={setTwitterHandle}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Content type */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Content Type</Text>
            <View style={styles.contentTypeGrid}>
              {CONTENT_TYPES.map((type) => {
                const isSelected = contentType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.contentTypeChip,
                      {
                        backgroundColor: isSelected ? colors.primary + "20" : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setContentType(isSelected ? "" : type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.contentTypeText, { color: isSelected ? colors.primary : colors.mutedForeground }]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Reason */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Why do you want to post reels? <Text style={{ color: "#ef4444" }}>*</Text>
            </Text>
            <View style={[styles.reasonBox, { backgroundColor: colors.card, borderColor: reason.trim().length > 0 ? colors.primary : colors.border }]}>
              <TextInput
                style={[styles.reasonInput, { color: colors.foreground }]}
                placeholder="Tell us about your content, audience, and why you'd be a great RankYatra creator..."
                placeholderTextColor={colors.mutedForeground}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                {reason.length}/500
              </Text>
            </View>

            {/* Note */}
            <View style={[styles.noteBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Applications are reviewed by our admin team. You'll be notified once your request is approved or rejected. This usually takes 1-3 days.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: reason.trim().length >= 10 ? "#a855f7" : colors.muted },
              ]}
              onPress={handleSubmit}
              disabled={submitting || reason.trim().length < 10}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="send" size={18} color={reason.trim().length >= 10 ? "#fff" : colors.mutedForeground} />}
              <Text style={[
                styles.submitBtnText,
                { color: reason.trim().length >= 10 ? "#fff" : colors.mutedForeground },
              ]}>
                {submitting ? "Submitting..." : application?.status === "rejected" ? "Re-Submit Application" : "Submit Application"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 6 },
  navTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },

  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  heroTitle: { fontSize: 20, fontWeight: "800", textAlign: "center" },
  heroSub: { fontSize: 13, lineHeight: 20, textAlign: "center" },

  statusBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  statusLabel: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  statusSub: { fontSize: 13, lineHeight: 18 },

  approvedBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  approvedTitle: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  approvedSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  goBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  goBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 14 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  infoLabel: { fontSize: 13, fontWeight: "600", width: 50 },
  infoVal: { fontSize: 13, fontWeight: "500", flex: 1 },

  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 4,
  },
  atSign: { fontSize: 16, fontWeight: "600", marginRight: 4 },
  input: { flex: 1, fontSize: 14, paddingVertical: 10 },

  contentTypeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  contentTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  contentTypeText: { fontSize: 12, fontWeight: "600" },

  reasonBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 4,
  },
  reasonInput: { fontSize: 14, lineHeight: 21, minHeight: 100, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },

  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 20,
    marginTop: 8,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18 },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
  },
  submitBtnText: { fontSize: 16, fontWeight: "700" },
});
