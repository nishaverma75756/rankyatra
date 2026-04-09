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
import { useReelsUpload } from "@/contexts/ReelsUploadContext";
import { showError } from "@/utils/alert";

export default function CreateReelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { startUpload } = useReelsUpload();

  const [caption, setCaption] = useState("");

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState("video/mp4");
  const [loadingVideo, setLoadingVideo] = useState(false);

  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbBase64, setThumbBase64] = useState<string | null>(null);
  const [thumbMime, setThumbMime] = useState("image/jpeg");
  const [loadingThumb, setLoadingThumb] = useState(false);

  const canPost = !!videoBase64 && !!token;

  // ── Pick video ──────────────────────────────────────────────────────────────
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Media library access is needed to pick videos.");
      return;
    }
    setLoadingVideo(true);
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
    setLoadingVideo(false);
  };

  // ── Pick thumbnail ──────────────────────────────────────────────────────────
  const pickThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Photo library access is needed.");
      return;
    }
    setLoadingThumb(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        if (asset.base64!.length > 2_000_000) {
          showError("Image Too Large", "Thumbnail should be under 1.5MB.");
        } else {
          setThumbUri(asset.uri);
          setThumbBase64(asset.base64!);
          setThumbMime(asset.mimeType ?? "image/jpeg");
        }
      }
    } catch {
      showError("Error", "Could not load image.");
    }
    setLoadingThumb(false);
  };

  // ── Share — navigate away immediately, upload in background ────────────────
  const handleShare = () => {
    if (!canPost || !videoBase64) return;
    // Navigate back to Moments > Reels tab immediately
    router.back();
    // Start background upload via context
    startUpload({
      videoBase64,
      videoMime,
      caption: caption.trim(),
      thumbnailBase64: thumbBase64 ?? undefined,
      thumbnailMime: thumbMime,
      token: token!,
    });
  };

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[s.title, { color: colors.foreground }]}>Create Reel</Text>
        <TouchableOpacity
          style={[s.postBtn, { backgroundColor: canPost ? "#f97316" : colors.muted }]}
          onPress={handleShare}
          disabled={!canPost}
        >
          <Text style={[s.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Video + Thumbnail row ── */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* Video picker */}
          <TouchableOpacity
            style={[s.videoPicker, { backgroundColor: colors.card, borderColor: colors.border, flex: 2 }]}
            onPress={pickVideo}
            disabled={loadingVideo}
            activeOpacity={0.8}
          >
            {loadingVideo ? (
              <View style={s.center}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }}>Loading...</Text>
              </View>
            ) : videoUri ? (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: "#f9731620" }]}>
                  <Feather name="check-circle" size={28} color="#f97316" />
                </View>
                <Text style={{ color: "#f97316", fontWeight: "700", fontSize: 13, marginTop: 8 }}>Video Selected</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 3 }}>Tap to change</Text>
              </View>
            ) : (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: "#f9731620" }]}>
                  <Feather name="video" size={28} color="#f97316" />
                </View>
                <Text style={[s.pickTitle, { color: colors.foreground }]}>Pick Video</Text>
                <Text style={[s.pickSub, { color: colors.mutedForeground }]}>Max 60 sec</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Thumbnail picker */}
          <TouchableOpacity
            style={[s.videoPicker, { backgroundColor: colors.card, borderColor: thumbUri ? "#a855f7" : colors.border, borderStyle: thumbUri ? "solid" : "dashed", flex: 1 }]}
            onPress={pickThumbnail}
            disabled={loadingThumb}
            activeOpacity={0.8}
          >
            {loadingThumb ? (
              <View style={s.center}>
                <ActivityIndicator color="#a855f7" size="small" />
              </View>
            ) : thumbUri ? (
              <>
                <Image source={{ uri: thumbUri }} style={{ ...StyleSheet.absoluteFillObject, borderRadius: 14 }} resizeMode="cover" />
                <View style={[s.thumbOverlay]}>
                  <Feather name="edit-2" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "600" }}>Change</Text>
                </View>
              </>
            ) : (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: "#a855f720", width: 44, height: 44 }]}>
                  <Feather name="image" size={20} color="#a855f7" />
                </View>
                <Text style={{ color: "#a855f7", fontSize: 11, fontWeight: "700", marginTop: 6 }}>Thumbnail</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 2, textAlign: "center" }}>Optional</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Caption ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>Caption</Text>
          <TextInput
            style={[s.captionInput, { color: colors.foreground }]}
            placeholder="Write a caption..."
            placeholderTextColor={colors.mutedForeground}
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={[s.charCount, { color: colors.mutedForeground }]}>{300 - caption.length}</Text>
        </View>

        {/* ── Upload info ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="zap" size={15} color="#f97316" />
            <Text style={[s.cardLabel, { color: colors.foreground, textTransform: "none" }]}>How it works</Text>
          </View>
          {[
            ["Tap Share", "Upload starts in the background"],
            ["Go to Reels tab", "See live upload progress bar"],
            ["Auto-appears", "Reel shows up when upload is done"],
          ].map(([title, sub], i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 6 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#f9731620", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#f97316", fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
              </View>
              <View>
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>{title}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Tips ── */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>Tips for best reels</Text>
          {["Portrait (9:16) ratio is ideal", "15–60 second clips work best", "Add a thumbnail to get more views", "Write a catchy caption"].map((tip, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <Text style={{ color: "#f97316" }}>•</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>{tip}</Text>
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
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 64, alignItems: "center" },
  postBtnText: { fontWeight: "700", fontSize: 14 },
  body: { padding: 16, gap: 14 },
  videoPicker: { height: 200, borderRadius: 16, borderWidth: 1.5, overflow: "hidden", borderStyle: "dashed" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pickTitle: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  pickSub: { fontSize: 11, marginTop: 3 },
  thumbOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 6,
    alignItems: "center", gap: 2,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 70, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
});
