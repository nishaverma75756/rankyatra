import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { showError, showSuccess } from "@/utils/alert";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type Tab = "chat" | "feedback";
type FeedbackType = "feedback" | "suggestion";

interface Agent {
  id: number;
  name: string;
  avatarUrl: string | null;
}

function SupportChatTab({ agent }: { agent: Agent | null }) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  async function openChat() {
    if (!agent) {
      showError("Support unavailable", "No support agent is currently assigned. Please try again later.");
      return;
    }
    setLoading(true);
    try {
      const r = await customFetch(`${BASE_URL}/api/support/conversation`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed");
      router.push(`/chat/${data.conversationId}`);
    } catch (e: any) {
      showError("Error", e.message || "Could not open chat");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.tabPane, { backgroundColor: colors.background }]}>
      {/* Agent Card */}
      <View style={[styles.agentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.agentAvatarWrap, { backgroundColor: colors.primary + "22" }]}>
          {agent?.avatarUrl ? (
            <Image source={{ uri: agent.avatarUrl }} style={styles.agentAvatar} />
          ) : (
            <Feather name="headphones" size={32} color={colors.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.agentName, { color: colors.foreground }]}>
            {agent?.name ?? "Customer Support"}
          </Text>
          <Text style={[styles.agentSub, { color: colors.mutedForeground }]}>
            RankYatra Support Team
          </Text>
          <View style={styles.onlineDot}>
            <View style={[styles.dot, { backgroundColor: "#22c55e" }]} />
            <Text style={[styles.onlineText, { color: "#22c55e" }]}>Online</Text>
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={[styles.infoBox, { backgroundColor: colors.primary + "11", borderColor: colors.primary + "33" }]}>
        <Feather name="info" size={16} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.foreground }]}>
          Chat directly with our support team. We're here to help with any issues or questions.
        </Text>
      </View>

      {/* Hours */}
      <View style={[styles.hoursCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.hoursTitle, { color: colors.foreground }]}>Support Hours</Text>
        <View style={styles.hoursRow}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.hoursText, { color: colors.mutedForeground }]}>Mon–Sat: 9:00 AM – 8:00 PM</Text>
        </View>
        <View style={styles.hoursRow}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={[styles.hoursText, { color: colors.mutedForeground }]}>Sun: 10:00 AM – 5:00 PM</Text>
        </View>
      </View>

      {/* Open Chat Button */}
      <TouchableOpacity
        style={[styles.chatBtn, { backgroundColor: colors.primary }]}
        onPress={openChat}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.chatBtnText}>Start Support Chat</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function FeedbackTab() {
  const colors = useColors();
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<{ uri: string; base64?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: false,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setImage({ uri: result.assets[0].uri });
    }
  }

  async function submit() {
    if (!message.trim()) { showError("Required", "Please write your message"); return; }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", type);
      formData.append("message", message.trim());
      if (image) {
        const filename = image.uri.split("/").pop() || "image.jpg";
        const ext = filename.split(".").pop() || "jpg";
        (formData as any).append("image", { uri: image.uri, type: `image/${ext}`, name: filename });
      }
      const r = await customFetch(`${BASE_URL}/api/feedback`, {
        method: "POST",
        body: formData,
        headers: {},
      });
      if (!r.ok) throw new Error("Failed");
      showSuccess("Submitted!", "Thank you for your feedback. We'll review it soon.");
      setMessage("");
      setImage(null);
      setType("feedback");
    } catch {
      showError("Error", "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={[styles.tabPane, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Type selector */}
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Type</Text>
        <View style={styles.typeRow}>
          {(["feedback", "suggestion"] as FeedbackType[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, { borderColor: type === t ? colors.primary : colors.border, backgroundColor: type === t ? colors.primary : colors.card }]}
              onPress={() => setType(t)}
            >
              <Feather name={t === "feedback" ? "message-square" : "lightbulb"} size={16} color={type === t ? "#fff" : colors.mutedForeground} />
              <Text style={[styles.typeBtnText, { color: type === t ? "#fff" : colors.mutedForeground }]}>
                {t === "feedback" ? "Feedback" : "Suggestion"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message */}
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
          {type === "feedback" ? "Your Feedback" : "Your Suggestion"} *
        </Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          placeholder={type === "feedback" ? "Tell us what went wrong or what you liked..." : "Share your idea to improve RankYatra..."}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          textAlignVertical="top"
        />

        {/* Image attachment */}
        <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Attach Image (optional)</Text>
        {image ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.removeImg} onPress={() => setImage(null)}>
              <Feather name="x" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.pickImgBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={pickImage}
          >
            <Feather name="image" size={22} color={colors.mutedForeground} />
            <Text style={[styles.pickImgText, { color: colors.mutedForeground }]}>Tap to attach a screenshot</Text>
          </TouchableOpacity>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
          onPress={submit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Submit {type === "feedback" ? "Feedback" : "Suggestion"}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const { data: agentData } = useQuery({
    queryKey: ["support-agent"],
    queryFn: async () => {
      const r = await customFetch(`${BASE_URL}/api/support/agent`);
      return r.json();
    },
    staleTime: 60_000,
  });

  const agent: Agent | null = agentData?.agent ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Feather name="headphones" size={22} color={colors.primary} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Customer Support</Text>
      </View>

      {/* Tab pills */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.pill, activeTab === "chat" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("chat")}
        >
          <Feather name="message-circle" size={16} color={activeTab === "chat" ? "#fff" : colors.mutedForeground} />
          <Text style={[styles.pillText, { color: activeTab === "chat" ? "#fff" : colors.mutedForeground }]}>Live Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, activeTab === "feedback" && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab("feedback")}
        >
          <Feather name="edit-3" size={16} color={activeTab === "feedback" ? "#fff" : colors.mutedForeground} />
          <Text style={[styles.pillText, { color: activeTab === "feedback" ? "#fff" : colors.mutedForeground }]}>Feedback</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === "chat"
        ? <SupportChatTab agent={agent} />
        : <FeedbackTab />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    margin: 16,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  pillText: { fontSize: 14, fontWeight: "700" },
  tabPane: { flex: 1, paddingHorizontal: 16 },
  // Agent card
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  agentAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  agentAvatar: { width: 64, height: 64, borderRadius: 32 },
  agentName: { fontSize: 16, fontWeight: "800" },
  agentSub: { fontSize: 13, marginTop: 2 },
  onlineDot: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: "600" },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  hoursCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    gap: 6,
  },
  hoursTitle: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  hoursRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  hoursText: { fontSize: 13 },
  chatBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
  },
  chatBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  // Feedback
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 4 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typeBtnText: { fontSize: 14, fontWeight: "700" },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 120,
    marginBottom: 16,
    lineHeight: 20,
  },
  pickImgBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
    marginBottom: 24,
  },
  pickImgText: { fontSize: 13 },
  imagePreviewWrap: { position: "relative", marginBottom: 24, borderRadius: 14, overflow: "hidden" },
  imagePreview: { width: "100%", height: 180, borderRadius: 14 },
  removeImg: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#ef4444",
    borderRadius: 20,
    padding: 4,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 20,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
