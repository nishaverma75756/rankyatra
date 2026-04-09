import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Image, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useReelsUpload } from "@/contexts/ReelsUploadContext";
import { showError } from "@/utils/alert";

const { width: SCREEN_W } = Dimensions.get("window");
const FRAME_COUNT = 8;
const FRAME_H = 70;
const FRAME_W = Math.floor((SCREEN_W - 32 - (FRAME_COUNT - 1) * 6) / FRAME_COUNT);

interface VideoFrame {
  uri: string;      // file URI (native) or data URL (web)
  time: number;     // ms
  b64?: string;     // pre-extracted base64 (web only)
}

// ── Web: HTML5 Canvas frame extraction ────────────────────────────────────────
async function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => resolve();
    video.addEventListener("seeked", handler, { once: true });
    video.currentTime = timeSec;
  });
}

async function extractFramesWeb(blobUrl: string): Promise<VideoFrame[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.src = blobUrl;
    video.muted = true;
    video.playsInline = true;

    video.addEventListener("loadedmetadata", async () => {
      const durMs = video.duration * 1000;
      const step = durMs / (FRAME_COUNT + 1);
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;
      const frames: VideoFrame[] = [];

      for (let i = 1; i <= FRAME_COUNT; i++) {
        const timeSec = (step * i) / 1000;
        try {
          await seekTo(video, timeSec);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
          const b64 = dataUrl.split(",")[1];
          frames.push({ uri: dataUrl, time: step * i, b64 });
        } catch {
          // skip failed frame
        }
      }
      resolve(frames);
    });

    video.addEventListener("error", () => resolve([]));
    video.load();
  });
}

// ── Native: expo-video-thumbnails ──────────────────────────────────────────────
async function extractFramesNative(uri: string, durationMs: number): Promise<VideoFrame[]> {
  const VideoThumbnails = await import("expo-video-thumbnails");
  const FileSystem = await import("expo-file-system");
  const dur = Math.max(durationMs, 1000);
  const step = Math.floor(dur / (FRAME_COUNT + 1));
  const frames: VideoFrame[] = [];
  for (let i = 1; i <= FRAME_COUNT; i++) {
    const time = step * i;
    try {
      const { uri: fUri } = await VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.6 });
      frames.push({ uri: fUri, time });
    } catch {
      // skip
    }
  }
  return frames;
}

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

  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);

  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbBase64, setThumbBase64] = useState<string | null>(null);
  const thumbMime = "image/jpeg";

  const canPost = !!videoBase64 && !!token;

  // ── Extract frames ──────────────────────────────────────────────────────────
  const extractFrames = async (uri: string, durationMs: number) => {
    setLoadingFrames(true);
    setFrames([]);
    setThumbUri(null);
    setThumbBase64(null);
    setSelectedFrameIdx(0);
    try {
      let extracted: VideoFrame[] = [];
      if (Platform.OS === "web") {
        extracted = await extractFramesWeb(uri);
      } else {
        extracted = await extractFramesNative(uri, durationMs);
      }
      setFrames(extracted);
      if (extracted.length > 0) {
        await applyFrame(0, extracted);
      }
    } catch {
      // non-critical
    }
    setLoadingFrames(false);
  };

  const applyFrame = async (idx: number, frameList?: VideoFrame[]) => {
    const list = frameList ?? frames;
    const frame = list[idx];
    if (!frame) return;
    setSelectedFrameIdx(idx);
    setThumbUri(frame.uri);

    if (frame.b64) {
      // web — b64 already extracted from canvas dataURL
      setThumbBase64(frame.b64);
    } else {
      // native — read file as base64
      try {
        const FileSystem = await import("expo-file-system");
        const b64 = await FileSystem.readAsStringAsync(frame.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setThumbBase64(b64);
      } catch {
        setThumbBase64(null);
      }
    }
  };

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
          const dur = asset.duration ? asset.duration * 1000 : 10000;
          setLoadingVideo(false);
          await extractFrames(asset.uri, dur);
          return;
        }
      }
    } catch {
      showError("Error", "Could not load video.");
    }
    setLoadingVideo(false);
  };

  // ── Share ───────────────────────────────────────────────────────────────────
  const handleShare = () => {
    if (!canPost || !videoBase64) return;
    router.back();
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
      {/* Header */}
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
        {/* Video + Cover preview */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            style={[s.videoPicker, { backgroundColor: colors.card, borderColor: videoUri ? "#f97316" : colors.border, flex: 2 }]}
            onPress={pickVideo}
            disabled={loadingVideo || loadingFrames}
            activeOpacity={0.8}
          >
            {loadingVideo ? (
              <View style={s.center}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }}>Loading video...</Text>
              </View>
            ) : loadingFrames && !videoUri ? (
              <View style={s.center}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }}>Extracting frames...</Text>
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

          {/* Cover preview */}
          <View style={[s.videoPicker, { backgroundColor: colors.card, borderColor: thumbUri ? "#f97316" : colors.border, flex: 1, overflow: "hidden" }]}>
            {thumbUri ? (
              <>
                <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                <View style={s.thumbOverlay}>
                  <Feather name="image" size={12} color="#fff" />
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>Cover</Text>
                </View>
              </>
            ) : (
              <View style={s.center}>
                <Feather name="image" size={22} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4, textAlign: "center", opacity: 0.6 }}>
                  {loadingFrames ? "Extracting..." : "Cover preview"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Frame Picker ── */}
        {(loadingFrames || frames.length > 0) && (
          <View style={[s.card, { padding: 0, overflow: "hidden", backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingBottom: 8 }}>
              <Feather name="film" size={14} color="#f97316" />
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Select Cover Frame</Text>
              {loadingFrames && (
                <ActivityIndicator size="small" color="#f97316" style={{ marginLeft: "auto" }} />
              )}
            </View>

            {loadingFrames && frames.length === 0 ? (
              <View style={{ height: FRAME_H + 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Extracting frames from video...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 5, flexDirection: "row" }}
              >
                {frames.map((frame, idx) => {
                  const isSelected = idx === selectedFrameIdx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => applyFrame(idx)}
                      activeOpacity={0.8}
                      style={[
                        s.frameCell,
                        {
                          width: FRAME_W,
                          height: FRAME_H,
                          borderColor: isSelected ? "#f97316" : "transparent",
                          borderWidth: isSelected ? 2.5 : 0,
                        },
                      ]}
                    >
                      <Image
                        source={{ uri: frame.uri }}
                        style={{ width: "100%", height: "100%", borderRadius: 4 }}
                        resizeMode="cover"
                      />
                      {isSelected && (
                        <View style={s.selectedOverlay}>
                          <View style={s.selectedDot}>
                            <Feather name="check" size={9} color="#fff" />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Timeline bar */}
            {frames.length > 0 && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
                  <View
                    style={{
                      height: "100%",
                      width: `${((selectedFrameIdx + 1) / frames.length) * 100}%`,
                      backgroundColor: "#f97316",
                      borderRadius: 2,
                    }}
                  />
                </View>
                <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4, textAlign: "center" }}>
                  Frame {selectedFrameIdx + 1} of {frames.length} · {Math.round((frames[selectedFrameIdx]?.time ?? 0) / 1000)}s
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Caption */}
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

        {/* How it works */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="zap" size={15} color="#f97316" />
            <Text style={[s.cardLabel, { color: colors.foreground, textTransform: "none", marginBottom: 0 }]}>How it works</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  postBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, minWidth: 64, alignItems: "center" },
  postBtnText: { fontWeight: "700", fontSize: 14 },
  body: { padding: 16, gap: 14 },
  videoPicker: { height: 180, borderRadius: 16, borderWidth: 1.5, overflow: "hidden", borderStyle: "dashed" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 8 },
  iconCircle: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  pickTitle: { fontSize: 14, fontWeight: "700", marginTop: 8 },
  pickSub: { fontSize: 11, marginTop: 3 },
  thumbOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 5,
    alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  captionInput: { fontSize: 15, lineHeight: 22, minHeight: 70, textAlignVertical: "top" },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 4 },
  frameCell: { borderRadius: 6, overflow: "hidden" },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(249,115,22,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  selectedDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#f97316",
    alignItems: "center", justifyContent: "center",
  },
});
