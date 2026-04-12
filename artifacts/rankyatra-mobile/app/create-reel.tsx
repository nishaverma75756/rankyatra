import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Image, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useReelsUpload } from "@/contexts/ReelsUploadContext";
import { showError } from "@/utils/alert";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const { width: SCREEN_W } = Dimensions.get("window");
const FRAME_COUNT = 8;
const FRAME_H = 70;
const FRAME_W = Math.floor((SCREEN_W - 32 - (FRAME_COUNT - 1) * 6) / FRAME_COUNT);

interface VideoFrame {
  uri: string;
  time: number;
}

// ── Extract single thumbnail (fast, before compression) ───────────────────────
async function extractFirstThumb(uri: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const VideoThumbnails = await import("expo-video-thumbnails");
    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: 1000, quality: 0.7 });
    return thumbUri;
  } catch {
    return null;
  }
}

// ── Extract 8 frames for cover picker (native, after compression) ──────────────
async function extractFramesNative(uri: string, durationMs: number): Promise<VideoFrame[]> {
  try {
    const VideoThumbnails = await import("expo-video-thumbnails");
    const dur = Math.max(durationMs, 2000);
    const step = Math.floor(dur / (FRAME_COUNT + 1));
    const frames: VideoFrame[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      try {
        const { uri: fUri } = await VideoThumbnails.getThumbnailAsync(uri, {
          time: step * i,
          quality: 0.5,
        });
        frames.push({ uri: fUri, time: step * i });
      } catch {}
    }
    return frames;
  } catch {
    return [];
  }
}

// ── Compress video (native only, optional) ────────────────────────────────────
async function compressVideo(
  uri: string,
  onProgress: (pct: number) => void
): Promise<{ uri: string; mime: string }> {
  if (Platform.OS === "web") return { uri, mime: "video/mp4" };
  try {
    const { Video } = await import("react-native-compressor");
    const result = await Video.compress(
      uri,
      {
        compressionMethod: "auto",
        maxSize: 1280,
        bitrate: 1_500_000,
        minimumFileSizeForCompress: 20,
      },
      (progress) => {
        onProgress(Math.round(progress * 100));
      }
    );
    return { uri: result, mime: "video/mp4" };
  } catch {
    return { uri, mime: "video/mp4" };
  }
}

export default function CreateReelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const { startUpload } = useReelsUpload();

  useEffect(() => {
    if (user && !user.canPostReels && !user.isAdmin) {
      router.replace("/apply-for-reels" as any);
    }
  }, [user]);

  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const [videoMime, setVideoMime] = useState("video/mp4");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [compressStatus, setCompressStatus] = useState<string | null>(null);

  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  const canPost = Platform.OS === "web"
    ? !!videoFile && !!token && !loadingVideo
    : !!videoUri && !!token && !loadingVideo && !compressStatus;

  // ── Pick cover image from gallery ─────────────────────────────────────────
  const pickThumbnailFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setThumbUri(result.assets[0].uri);
        setFrames([]);
        setSelectedFrameIdx(0);
      }
    } catch {
      showError("Error", "Could not pick image from gallery.");
    }
  };

  const applyFrame = (idx: number) => {
    const frame = frames[idx];
    if (!frame) return;
    setSelectedFrameIdx(idx);
    setThumbUri(frame.uri);
  };

  // ── Pick + compress video ─────────────────────────────────────────────────
  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Media library access is needed to pick videos.");
      return;
    }
    setLoadingVideo(true);
    setCompressStatus(null);
    setFrames([]);
    setThumbUri(null);
    setVideoFile(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets[0]) {
        setLoadingVideo(false);
        return;
      }

      const asset = result.assets[0];
      let uri = asset.uri;
      const dur = asset.duration ? asset.duration * 1000 : 10000;

      // Web: store the browser File object for direct FormData upload
      if (Platform.OS === "web") {
        const fileObj = (asset as any).file as File | undefined;
        if (fileObj) setVideoFile(fileObj);
        setVideoUri(uri);
        setVideoMime(fileObj?.type || "video/mp4");
        setLoadingVideo(false);
        setCompressStatus(null);
        return;
      }

      // Android: copy content:// URI to cache first
      if (Platform.OS === "android" && uri.startsWith("content://")) {
        const FileSystem = await import("expo-file-system");
        const dest = `${FileSystem.cacheDirectory}reel_raw_${Date.now()}.mp4`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      }

      // Step 1: Extract first thumbnail immediately (before compression)
      setLoadingVideo(false);
      setCompressStatus("Getting preview...");
      setThumbError(false);
      const firstThumb = await extractFirstThumb(uri);
      if (firstThumb) setThumbUri(firstThumb);

      // Step 2: Compress the video
      setCompressStatus("Compressing... 0%");
      const { uri: compressedUri, mime } = await compressVideo(uri, (pct) => {
        setCompressStatus(`Compressing... ${pct}%`);
      });
      setCompressStatus(null);
      setVideoUri(compressedUri);
      setVideoMime(mime);

      // Step 3: Extract more frames for picker in background
      setLoadingFrames(true);
      const extracted = await extractFramesNative(compressedUri, dur);
      setLoadingFrames(false);
      setFrames(extracted);
      if (extracted.length > 0) {
        setSelectedFrameIdx(0);
        setThumbUri(extracted[0].uri);
      } else if (!firstThumb) {
        setThumbError(true);
      }

    } catch (e: any) {
      setCompressStatus(null);
      setLoadingFrames(false);
      showError("Error", "Could not load video. Please try a different clip.");
    }
    setLoadingVideo(false);
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = () => {
    if (!canPost || !videoUri) return;
    router.back();
    startUpload({
      videoUri,
      videoMime,
      caption: caption.trim(),
      category: category || undefined,
      thumbnailUri: thumbUri ?? undefined,
      thumbnailMime: "image/jpeg",
      token: token!,
      videoFile: videoFile ?? undefined,
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
        {/* Video + Cover preview row */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* Video picker */}
          <TouchableOpacity
            style={[s.videoPicker, { backgroundColor: colors.card, borderColor: videoUri ? "#f97316" : colors.border, flex: 2 }]}
            onPress={pickVideo}
            disabled={!!loadingVideo || !!compressStatus || loadingFrames}
            activeOpacity={0.8}
          >
            {loadingVideo ? (
              <View style={s.center}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={{ color: colors.mutedForeground, marginTop: 8, fontSize: 12 }}>Loading video...</Text>
              </View>
            ) : compressStatus ? (
              <View style={s.center}>
                <ActivityIndicator color="#f97316" size="large" />
                <Text style={{ color: "#f97316", marginTop: 8, fontSize: 13, fontWeight: "700" }}>{compressStatus}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4 }}>Optimizing for upload...</Text>
              </View>
            ) : videoUri ? (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: "#f9731620" }]}>
                  <Feather name="check-circle" size={28} color="#f97316" />
                </View>
                <Text style={{ color: "#f97316", fontWeight: "700", fontSize: 13, marginTop: 8 }}>Video Ready</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 3 }}>Tap to change</Text>
              </View>
            ) : (
              <View style={s.center}>
                <View style={[s.iconCircle, { backgroundColor: "#f9731620" }]}>
                  <Feather name="video" size={28} color="#f97316" />
                </View>
                <Text style={[s.pickTitle, { color: colors.foreground }]}>Pick Video</Text>
                <Text style={[s.pickSub, { color: colors.mutedForeground }]}>Up to 60 sec · HD quality</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Cover preview + gallery picker */}
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[s.videoPicker, { backgroundColor: colors.card, borderColor: thumbUri ? "#f97316" : thumbError ? "#ef4444" : colors.border, flex: 1, overflow: "hidden" }]}>
              {thumbUri ? (
                <>
                  <Image source={{ uri: thumbUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  <View style={s.thumbOverlay}>
                    <Feather name="image" size={12} color="#fff" />
                    <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>Cover</Text>
                  </View>
                </>
              ) : thumbError ? (
                <View style={s.center}>
                  <Feather name="alert-circle" size={20} color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 9, marginTop: 4, textAlign: "center", fontWeight: "700" }}>
                    Auto extract{"\n"}failed
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 8, textAlign: "center", marginTop: 2 }}>
                    Use Gallery
                  </Text>
                </View>
              ) : (
                <View style={s.center}>
                  <Feather name="image" size={22} color={colors.mutedForeground} style={{ opacity: 0.4 }} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4, textAlign: "center", opacity: 0.6 }}>
                    {loadingFrames || compressStatus ? "Loading..." : "Cover"}
                  </Text>
                </View>
              )}
            </View>
            {/* Gallery thumbnail button */}
            {(videoUri || thumbError) && (
              <TouchableOpacity
                style={[s.galleryBtn, { backgroundColor: colors.card, borderColor: thumbError ? "#ef4444" : colors.border }]}
                onPress={() => { setThumbError(false); pickThumbnailFromGallery(); }}
                activeOpacity={0.8}
              >
                <Feather name="upload" size={13} color={thumbError ? "#ef4444" : "#f97316"} />
                <Text style={{ color: thumbError ? "#ef4444" : "#f97316", fontSize: 10, fontWeight: "700" }}>
                  {thumbError ? "Pick Cover" : "Gallery"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Frame Picker ── */}
        {(loadingFrames || frames.length > 0) && (
          <View style={[s.card, { padding: 0, overflow: "hidden", backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, paddingBottom: 8 }}>
              <Feather name="film" size={14} color="#f97316" />
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "700" }}>Select Cover Frame</Text>
              {loadingFrames && <ActivityIndicator size="small" color="#f97316" style={{ marginLeft: "auto" }} />}
            </View>

            {loadingFrames && frames.length === 0 ? (
              <View style={{ height: FRAME_H + 16, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Extracting frames...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 12, gap: 5, flexDirection: "row" }}
              >
                {frames.map((frame, idx) => {
                  const isSelected = idx === selectedFrameIdx;
                  return (
                    <TouchableOpacity
                      key={idx} onPress={() => applyFrame(idx)} activeOpacity={0.8}
                      style={[s.frameCell, { width: FRAME_W, height: FRAME_H, borderColor: isSelected ? "#f97316" : "transparent", borderWidth: isSelected ? 2.5 : 0 }]}
                    >
                      <Image source={{ uri: frame.uri }} style={{ width: "100%", height: "100%", borderRadius: 4 }} resizeMode="cover" />
                      {isSelected && (
                        <View style={s.selectedOverlay}>
                          <View style={s.selectedDot}><Feather name="check" size={9} color="#fff" /></View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {frames.length > 0 && (
              <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                <View style={{ height: 3, backgroundColor: colors.border, borderRadius: 2 }}>
                  <View style={{ height: "100%", width: `${((selectedFrameIdx + 1) / frames.length) * 100}%`, backgroundColor: "#f97316", borderRadius: 2 }} />
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
            value={caption} onChangeText={setCaption}
            multiline maxLength={300} textAlignVertical="top"
          />
          <Text style={[s.charCount, { color: colors.mutedForeground }]}>{300 - caption.length}</Text>
        </View>

        {/* Category picker */}
        {categories.length > 0 && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <Feather name="tag" size={13} color={colors.mutedForeground} />
              <Text style={[s.cardLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                Category <Text style={{ textTransform: "none", fontWeight: "400" }}>(optional)</Text>
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map((cat) => {
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(active ? null : cat)}
                    activeOpacity={0.75}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 5,
                      paddingHorizontal: 12, paddingVertical: 8,
                      borderRadius: 20, borderWidth: 1.5,
                      backgroundColor: active ? colors.primary : colors.background,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: active ? "#fff" : colors.foreground }}>{cat}</Text>
                    {active && <Feather name="x" size={12} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* How it works */}
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Feather name="zap" size={15} color="#f97316" />
            <Text style={[s.cardLabel, { color: colors.foreground, textTransform: "none", marginBottom: 0 }]}>How it works</Text>
          </View>
          {[
            ["Pick any video", "HD quality, smooth playback"],
            ["Choose cover frame", "Pick any frame or from gallery"],
            ["Tap Share", "Uploads in background — app stays open"],
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
  galleryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, borderRadius: 10, borderWidth: 1, paddingVertical: 8,
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
    backgroundColor: "#f97316", alignItems: "center", justifyContent: "center",
  },
});
