import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, Image, FlatList, ActivityIndicator, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { showError } from "@/utils/alert";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// ─── Types ───────────────────────────────────────────────────────────────────
interface MyPost {
  id: number;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
function formatUID(id: number, customUid?: number | null) {
  return `RY${String(customUid ?? id).padStart(10, "0")}`;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({ name, url, size = 40, colors }: { name: string; url: string | null; size?: number; colors: any }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + "20", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: size * 0.35 }}>{name?.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

// ─── Read-only PostCard (matches moments.tsx style exactly) ──────────────────
const SEE_MORE_LIMIT = 200;

function ReadOnlyPostCard({ post, user, colors }: { post: MyPost; user: any; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (post.content?.trim().length ?? 0) > SEE_MORE_LIMIT;

  return (
    <View style={[pStyles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={pStyles.postHeader}>
        <Avatar name={user?.name ?? "?"} url={(user as any)?.avatarUrl ?? null} size={40} colors={colors} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[pStyles.postName, { color: colors.foreground }]} numberOfLines={1}>{user?.name}</Text>
          <Text style={{ color: colors.primary, fontSize: 9, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 1, marginTop: 1 }}>
            UID-{formatUID(user?.id ?? 0, (user as any)?.customUid)}
          </Text>
          <Text style={[pStyles.postTime, { color: colors.mutedForeground }]}>{timeAgo(post.createdAt)}</Text>
        </View>
      </View>

      {/* Content */}
      {post.content?.trim().length > 0 && (
        <View style={{ marginBottom: post.imageUrl ? 0 : 4 }}>
          <Text style={[pStyles.postContent, { color: colors.foreground }]} numberOfLines={expanded ? undefined : (isLong ? 4 : undefined)}>
            {expanded || !isLong ? post.content : post.content.slice(0, SEE_MORE_LIMIT).trimEnd()}
          </Text>
          {isLong && (
            <TouchableOpacity onPress={() => setExpanded(e => !e)}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", marginTop: 2, paddingHorizontal: 12 }}>
                {expanded ? "See less" : "...See more"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Image */}
      {post.imageUrl && (
        <View style={{ marginTop: 6, marginBottom: 8 }}>
          <Image source={{ uri: post.imageUrl }} style={{ width: "100%", height: 220 }} resizeMode="cover" />
        </View>
      )}

      {/* Action bar */}
      <View style={[pStyles.postActions, { borderTopColor: colors.border }]}>
        <View style={pStyles.actionBtn}>
          <Feather name="heart" size={16} color={colors.mutedForeground} />
          <Text style={[pStyles.actionCount, { color: colors.mutedForeground }]}>{post.likeCount ?? 0}</Text>
        </View>
        <View style={pStyles.actionBtn}>
          <Feather name="message-square" size={16} color={colors.mutedForeground} />
          <Text style={[pStyles.actionCount, { color: colors.mutedForeground }]}>{post.commentCount ?? 0}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreatePostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [myPosts, setMyPosts] = useState<MyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(`${BASE_URL}/api/categories`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat);
      if (prev.length >= 5) return prev;
      return [...prev, cat];
    });
  };

  const canPost = (text.trim().length > 0 || !!selectedImage) && !posting && selectedCategories.length > 0;

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
          setSelectedImage(`data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`);
        }
      }
    } catch {
      showError("Error", "Could not load the image.");
    }
    setUploadingImage(false);
  };

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      await customFetch("/api/posts", {
        method: "POST",
        body: JSON.stringify({ content: text.trim(), imageUrl: selectedImage ?? undefined, categories: selectedCategories }),
        headers: { "Content-Type": "application/json" },
      });
      router.back();
    } catch {
      showError("Error", "Failed to create post. Please try again.");
    }
    setPosting(false);
  };

  // ── Composer header (rendered as FlatList ListHeaderComponent) ─────────────
  const ComposerHeader = (
    <View>
      {/* ── Composer card ── */}
      <View style={[cStyles.composerCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {/* User row */}
        <View style={cStyles.userRow}>
          <Avatar name={user?.name ?? "?"} url={(user as any)?.avatarUrl ?? null} size={46} colors={colors} />
          <View style={{ flex: 1 }}>
            <Text style={[cStyles.userName, { color: colors.foreground }]}>{user?.name}</Text>
            <View style={[cStyles.audiencePill, { backgroundColor: colors.muted }]}>
              <Feather name="globe" size={10} color={colors.mutedForeground} />
              <Text style={[cStyles.audienceText, { color: colors.mutedForeground }]}>Everyone</Text>
            </View>
          </View>
        </View>

        {/* Text input */}
        <TextInput
          style={[cStyles.input, { color: colors.foreground }]}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          autoFocus
          textAlignVertical="top"
        />

        {/* Selected image preview */}
        {selectedImage && (
          <View style={cStyles.previewWrap}>
            <Image source={{ uri: selectedImage }} style={cStyles.previewImg} resizeMode="cover" />
            <TouchableOpacity style={cStyles.removeBtn} onPress={() => setSelectedImage(null)}>
              <Feather name="x" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Char bar */}
        <View style={cStyles.charRow}>
          <View style={[cStyles.charTrack, { backgroundColor: colors.muted }]}>
            <View style={[cStyles.charFill, {
              width: `${Math.min((text.length / 500) * 100, 100)}%`,
              backgroundColor: text.length > 480 ? "#ef4444" : text.length > 450 ? "#f97316" : colors.primary,
            }]} />
          </View>
          <Text style={[cStyles.charCount, { color: text.length > 450 ? "#ef4444" : colors.mutedForeground }]}>
            {500 - text.length}
          </Text>
        </View>

        {/* Action strip */}
        <View style={[cStyles.actionStrip, { borderTopColor: colors.border }]}>
          {/* Photo button — prominent with colored background */}
          <TouchableOpacity
            style={[cStyles.photoBtn, { backgroundColor: selectedImage ? "#f9731620" : "#f9731615" }]}
            onPress={pickImage}
            disabled={uploadingImage}
            activeOpacity={0.7}
          >
            <View style={[cStyles.photoBtnIconWrap, { backgroundColor: selectedImage ? "#f97316" : "#f9731625" }]}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color={selectedImage ? "#fff" : "#f97316"} />
              ) : (
                <Feather name="camera" size={16} color={selectedImage ? "#fff" : "#f97316"} />
              )}
            </View>
            <Text style={[cStyles.photoBtnText, { color: "#f97316" }]}>
              {selectedImage ? "Change Photo" : "Photo / Video"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category picker — mandatory */}
        {categories.length > 0 && (
          <View style={[cStyles.categorySection, { borderTopColor: colors.border }]}>
            <View style={cStyles.categoryHeader}>
              <Feather name="tag" size={13} color={selectedCategories.length === 0 ? "#ef4444" : colors.primary} />
              <Text style={[cStyles.categoryLabel, { color: selectedCategories.length === 0 ? "#ef4444" : colors.foreground }]}>
                Exam category{" "}
                <Text style={{ fontWeight: "400", color: colors.mutedForeground }}>
                  ({selectedCategories.length}/5 selected — required)
                </Text>
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
              {categories.map((cat) => {
                const active = selectedCategories.includes(cat);
                const atMax = !active && selectedCategories.length >= 5;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => !atMax && toggleCategory(cat)}
                    activeOpacity={0.75}
                    style={[
                      cStyles.catChip,
                      {
                        backgroundColor: active ? colors.primary : atMax ? colors.muted + "80" : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                        opacity: atMax ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text style={[cStyles.catChipText, { color: active ? "#fff" : colors.foreground }]}>{cat}</Text>
                    {active && <Feather name="x" size={12} color="#fff" style={{ marginLeft: 2 }} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Thin divider */}
      <View style={{ height: 6, backgroundColor: colors.muted + "50" }} />

      {/* Previous posts loading / empty */}
      {loadingPosts && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 28 }} />
      )}
      {!loadingPosts && myPosts.length === 0 && (
        <View style={{ alignItems: "center", paddingTop: 36 }}>
          <Feather name="edit-3" size={36} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>No posts yet</Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Fixed header */}
      <View style={[cStyles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()} style={cStyles.iconBtn}>
          <Feather name="x" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[cStyles.headerTitle, { color: colors.foreground }]}>Create Post</Text>
        <TouchableOpacity
          style={[cStyles.postBtn, { backgroundColor: canPost ? "#f97316" : colors.muted }]}
          onPress={handlePost}
          disabled={!canPost}
        >
          {posting
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[cStyles.postBtnText, { color: canPost ? "#fff" : colors.mutedForeground }]}>Post</Text>
          }
        </TouchableOpacity>
      </View>

      {/* FlatList: composer header + previous posts */}
      <FlatList
        data={myPosts}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
            <ReadOnlyPostCard post={item} user={user} colors={colors} />
          </View>
        )}
        ListHeaderComponent={ComposerHeader}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Composer styles ──────────────────────────────────────────────────────────
const cStyles = StyleSheet.create({
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
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    minWidth: 64, alignItems: "center", justifyContent: "center",
  },
  postBtnText: { fontWeight: "700", fontSize: 14 },

  composerCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 14 },
  userRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  userName: { fontWeight: "700", fontSize: 15, marginBottom: 3 },
  audiencePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start",
  },
  audienceText: { fontSize: 11, fontWeight: "600" },
  input: { fontSize: 16, lineHeight: 24, minHeight: 80, maxHeight: 160 },
  previewWrap: { marginTop: 10, borderRadius: 10, overflow: "hidden", position: "relative" },
  previewImg: { width: "100%", height: 190, borderRadius: 10 },
  removeBtn: {
    position: "absolute", top: 7, right: 7, backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 13, width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
  charRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 2 },
  charTrack: { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  charFill: { height: "100%", borderRadius: 2 },
  charCount: { fontSize: 11, fontWeight: "600", width: 28, textAlign: "right" },

  actionStrip: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  photoBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12,
    flex: 1,
  },
  photoBtnIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  photoBtnText: { fontSize: 14, fontWeight: "600" },
  categorySection: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  categoryLabel: { fontSize: 12, fontWeight: "600" },
  catChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontWeight: "600" },
});

// ─── PostCard styles (matches moments.tsx) ────────────────────────────────────
const pStyles = StyleSheet.create({
  postCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, paddingBottom: 8 },
  postName: { fontSize: 14, fontWeight: "600" },
  postTime: { fontSize: 11, marginTop: 2 },
  postContent: { fontSize: 14, lineHeight: 20, paddingHorizontal: 12, paddingBottom: 6 },
  postActions: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1,
  },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  actionCount: { fontSize: 13, fontWeight: "500" },
});
