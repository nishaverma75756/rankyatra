import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Image, FlatList, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { showError } from "@/utils/alert";

interface MyPost {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

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
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const canPost = (text.trim().length > 0 || !!selectedImage) && !posting;

  useEffect(() => {
    if (!user?.id) return;
    customFetch<{ posts: MyPost[] }>(`/api/posts/user/${user.id}`)
      .then((r) => setMyPosts(r.posts ?? []))
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [user?.id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Permission Denied", "Photo library access is needed to pick images.");
      return;
    }
    setUploadingImage(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.55,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        const asset = result.assets[0];
        if (asset.base64!.length > 1_500_000) {
          showError("Image Too Large", "Please pick a smaller image (under 1MB).");
        } else {
          const mimeType = asset.mimeType ?? "image/jpeg";
          setSelectedImage(`data:${mimeType};base64,${asset.base64}`);
        }
      }
    } catch {
      showError("Error", "Could not load the image. Try again.");
    }
    setUploadingImage(false);
  };

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      await customFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({
          content: text.trim(),
          imageUrl: selectedImage ?? undefined,
        }),
        headers: { "Content-Type": "application/json" },
      });
      router.back();
    } catch {
      showError("Error", "Failed to create post. Please try again.");
    }
    setPosting(false);
  };

  // ─── Composer (used as FlatList header) ───────────────────────────────────
  const ComposerHeader = (
    <View>
      {/* ── Composer Card ── */}
      <View style={[styles.composerCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* User row */}
        <View style={styles.userRow}>
          <Avatar name={user?.name ?? "?"} url={(user as any)?.avatarUrl ?? null} size={44} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.foreground }]}>{user?.name}</Text>
            <View style={[styles.audiencePill, { backgroundColor: colors.muted }]}>
              <Feather name="globe" size={10} color={colors.mutedForeground} />
              <Text style={[styles.audienceText, { color: colors.mutedForeground }]}>Everyone</Text>
            </View>
          </View>
        </View>

        {/* Text input */}
        <TextInput
          ref={inputRef}
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

        {/* Photo preview */}
        {selectedImage && (
          <View style={styles.previewWrap}>
            <Image source={{ uri: selectedImage }} style={styles.previewImg} resizeMode="cover" />
            <TouchableOpacity style={styles.removeBtn} onPress={() => setSelectedImage(null)}>
              <Feather name="x" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Char count bar */}
        <View style={styles.charRow}>
          <View style={[styles.charBar, { backgroundColor: colors.muted }]}>
            <View style={[styles.charFill, {
              width: `${Math.min((text.length / 500) * 100, 100)}%`,
              backgroundColor: text.length > 480 ? "#ef4444" : text.length > 450 ? "#f97316" : colors.primary,
            }]} />
          </View>
          <Text style={[styles.charCount, { color: text.length > 450 ? "#ef4444" : colors.mutedForeground }]}>
            {500 - text.length}
          </Text>
        </View>

        {/* Action bar */}
        <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.actionChip} onPress={pickImage} disabled={uploadingImage}>
            {uploadingImage ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="image" size={17} color={selectedImage ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.actionChipText, { color: selectedImage ? colors.primary : colors.mutedForeground }]}>
                  {selectedImage ? "Change Photo" : "Photo"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Previous posts header ── */}
      <View style={[styles.sectionHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Feather name="clock" size={13} color={colors.mutedForeground} />
        <Text style={[styles.sectionHeaderText, { color: colors.mutedForeground }]}>Your previous posts</Text>
      </View>

      {loadingPosts && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      )}
      {!loadingPosts && myPosts.length === 0 && (
        <View style={{ alignItems: "center", paddingTop: 32, paddingBottom: 20 }}>
          <Feather name="edit-3" size={32} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts yet</Text>
        </View>
      )}
    </View>
  );

  // ─── Mini post card ────────────────────────────────────────────────────────
  const renderPost = ({ item }: { item: MyPost }) => (
    <View style={[styles.miniCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flex: 1, paddingRight: item.imageUrl ? 10 : 0 }}>
        {item.content?.trim().length > 0 && (
          <Text style={[styles.miniContent, { color: colors.foreground }]} numberOfLines={2}>
            {item.content}
          </Text>
        )}
        <View style={styles.miniMeta}>
          <Text style={[styles.miniTime, { color: colors.mutedForeground }]}>{timeAgo(item.createdAt)}</Text>
          <View style={styles.miniStats}>
            <Feather name="heart" size={11} color={colors.mutedForeground} />
            <Text style={[styles.miniStatText, { color: colors.mutedForeground }]}>{item.likeCount ?? 0}</Text>
            <Feather name="message-square" size={11} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
            <Text style={[styles.miniStatText, { color: colors.mutedForeground }]}>{item.commentCount ?? 0}</Text>
          </View>
        </View>
      </View>
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.miniThumb} resizeMode="cover" />
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Create Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: canPost ? colors.primary : colors.muted }]}
          onPress={handlePost}
          disabled={!canPost}
        >
          {posting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[styles.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Post</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Posts list with composer as header */}
      <FlatList
        data={myPosts}
        keyExtractor={(p) => String(p.id)}
        renderItem={renderPost}
        ListHeaderComponent={ComposerHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700" },
  postBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  postBtnText: { fontWeight: "700", fontSize: 14 },

  // Composer
  composerCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
  },
  userRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  userName: { fontWeight: "700", fontSize: 15, marginBottom: 3 },
  audiencePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start",
  },
  audienceText: { fontSize: 11, fontWeight: "600" },
  input: { fontSize: 16, lineHeight: 24, minHeight: 80, maxHeight: 160 },
  previewWrap: { marginTop: 10, borderRadius: 10, overflow: "hidden", position: "relative" },
  previewImg: { width: "100%", height: 180, borderRadius: 10 },
  removeBtn: {
    position: "absolute", top: 7, right: 7,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12, width: 26, height: 26,
    alignItems: "center", justifyContent: "center",
  },
  charRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 2 },
  charBar: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  charFill: { height: "100%", borderRadius: 2 },
  charCount: { fontSize: 11, fontWeight: "600", width: 28, textAlign: "right" },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10 },
  actionChipText: { fontSize: 14, fontWeight: "600" },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3, textTransform: "uppercase" },
  emptyText: { fontSize: 14, marginTop: 8 },

  // Mini post card
  miniCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  miniContent: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  miniMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  miniTime: { fontSize: 11 },
  miniStats: { flexDirection: "row", alignItems: "center", gap: 3 },
  miniStatText: { fontSize: 11, marginRight: 2 },
  miniThumb: { width: 62, height: 62, borderRadius: 8 },
});
