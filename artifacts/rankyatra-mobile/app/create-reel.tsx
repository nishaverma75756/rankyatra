import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Image, ActivityIndicator, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { showError } from "@/utils/alert";

export default function CreateReelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [caption, setCaption] = useState("");
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState("video/mp4");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const canPost = !!videoBase64 && !posting;

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Media library access is needed to pick videos.");
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (!asset.base64) {
          showError("Error", "Could not read video. Try a shorter clip.");
        } else if (asset.base64.length > 35_000_000) {
          showError("Too Large", "Video is too large. Please pick a clip under 30MB.");
        } else {
          setVideoUri(asset.uri);
          setVideoBase64(asset.base64);
          setVideoMime(asset.mimeType ?? "video/mp4");
        }
      }
    } catch {
      showError("Error", "Could not load video.");
    }
    setUploading(false);
  };

  const handlePost = async () => {
    if (!canPost || !videoBase64) return;
    setPosting(true);
    try {
      const videoUrl = `data:${videoMime};base64,${videoBase64}`;
      await customFetch("/api/reels", {
        method: "POST",
        body: JSON.stringify({ videoUrl, caption: caption.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      router.back();
    } catch {
      showError("Error", "Failed to upload reel. Please try again.");
    }
    setPosting(false);
  };

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Create Reel</Text>
        <TouchableOpacity
          style={[s.postBtn, { backgroundColor: canPost ? "#f97316" : colors.muted }]}
          onPress={handlePost}
          disabled={!canPost}
        >
          {posting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[s.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Share</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        {/* Video picker area */}
        <TouchableOpacity
          style={[s.videoPicker, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={pickVideo}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <View style={s.videoCenter}>
              <ActivityIndicator color="#f97316" size="large" />
              <Text style={{ color: colors.mutedForeground, marginTop: 10, fontSize: 13 }}>Loading video...</Text>
            </View>
          ) : videoUri ? (
            <View style={{ width: "100%", height: "100%" }}>
              {/* Show thumbnail placeholder since we can't render video preview in picker */}
              <View style={[s.videoThumb, { backgroundColor: "#000" }]}>
                <Feather name="film" size={48} color="#f97316" />
                <Text style={{ color: "#fff", marginTop: 8, fontSize: 13, fontWeight: "600" }}>Video Selected ✓</Text>
                <Text style={{ color: "#aaa", fontSize: 11, marginTop: 4 }}>Tap to change</Text>
              </View>
            </View>
          ) : (
            <View style={s.videoCenter}>
              <View style={[s.cameraIconWrap, { backgroundColor: "#f9731620" }]}>
                <Feather name="video" size={36} color="#f97316" />
              </View>
              <Text style={[s.pickTitle, { color: colors.foreground }]}>Pick a Video</Text>
              <Text style={[s.pickSub, { color: colors.mutedForeground }]}>Max 60 seconds • MP4 recommended</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Caption */}
        <View style={[s.captionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.captionLabel, { color: colors.mutedForeground }]}>Caption</Text>
          <TextInput
            style={[s.captionInput, { color: colors.foreground }]}
            placeholder="Write a caption..."
            placeholderTextColor={colors.mutedForeground}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
          />
          <Text style={[s.charCount, { color: colors.mutedForeground }]}>{300 - caption.length}</Text>
        </View>

        {/* Tips */}
        <View style={[s.tipsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.tipsTitle, { color: colors.foreground }]}>Tips for best reels</Text>
          {["Short clips (15–60 sec) work best", "Portrait (9:16) ratio is ideal", "Good lighting = more views", "Add a catchy caption to engage"].map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <Text style={{ color: "#f97316", fontSize: 14 }}>•</Text>
              <Text style={[s.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 64, alignItems: "center", justifyContent: "center" },
  postBtnText: { fontWeight: "700", fontSize: 14 },
  body: { padding: 16, gap: 16 },
  videoPicker: { height: 300, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  videoCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  videoThumb: { flex: 1, alignItems: "center", justifyContent: "center" },
  cameraIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  pickTitle: { fontSize: 17, fontWeight: "700" },
  pickSub: { fontSize: 12 },
  captionCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  captionLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 80, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
  tipsCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  tipsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  tipRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  tipText: { fontSize: 13, flex: 1 },
});
