import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Image, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { showError } from "@/utils/alert";

function Avatar({ name, url, size = 40, colors }: { name: string; url: string | null; size?: number; colors: any }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>{name?.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

export default function CreatePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await customFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content: text.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      router.back();
    } catch {
      showError("Error", "Failed to create post. Please try again.");
    }
    setPosting(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: !text.trim() || posting ? colors.muted : colors.primary }]}
          onPress={handlePost}
          disabled={!text.trim() || posting}
        >
          <Text style={[styles.postBtnText, { color: !text.trim() || posting ? colors.mutedForeground : "#fff" }]}>
            {posting ? "Posting..." : "Post"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Platform.OS === "ios" ? insets.bottom + 20 : 20 }]} keyboardShouldPersistTaps="handled">
        {/* User info row */}
        <View style={styles.userRow}>
          <Avatar name={user?.name ?? "?"} url={(user as any)?.avatarUrl ?? null} size={46} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
            <View style={[styles.audiencePill, { backgroundColor: colors.muted }]}>
              <Feather name="globe" size={11} color={colors.mutedForeground} />
              <Text style={[styles.audienceText, { color: colors.mutedForeground }]}>Everyone</Text>
            </View>
          </View>
        </View>

        {/* Text input */}
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          autoFocus
          textAlignVertical="top"
        />
      </ScrollView>

      {/* Footer char count */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 8, backgroundColor: colors.background }]}>
        <View style={[styles.charBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.charFill, {
            backgroundColor: text.length > 450 ? (text.length > 480 ? "#ef4444" : "#f97316") : colors.primary,
            width: `${Math.min((text.length / 500) * 100, 100)}%`,
          }]} />
        </View>
        <Text style={[styles.charCount, { color: text.length > 450 ? "#ef4444" : colors.mutedForeground }]}>
          {500 - text.length}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  postBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: { fontWeight: "700", fontSize: 14 },
  body: { paddingHorizontal: 16, paddingTop: 16 },
  userRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  userName: { fontWeight: "700", fontSize: 15, marginBottom: 4 },
  audiencePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  audienceText: { fontSize: 11, fontWeight: "600" },
  input: { fontSize: 17, lineHeight: 26, minHeight: 180 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  charBar: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  charFill: { height: "100%", borderRadius: 2 },
  charCount: { fontSize: 12, fontWeight: "600", width: 30, textAlign: "right" },
});
