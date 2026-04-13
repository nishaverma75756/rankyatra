import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, Dimensions, StyleSheet,
  ActivityIndicator, Image, Share, Platform, LayoutChangeEvent, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { customFetch } from "@workspace/api-client-react";
import { showError, showConfirm } from "@/utils/alert";
import { useAuth } from "@/contexts/AuthContext";
import { useReelsUpload } from "@/contexts/ReelsUploadContext";

const { width: SCREEN_W } = Dimensions.get("window");

interface Reel {
  id: number;
  userId: number;
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  userName: string;
  userAvatar: string | null;
  verificationStatus: string;
  isLiked: boolean;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function Avatar({ name, url, size = 38 }: { name: string; url: string | null; size?: number }) {
  if (url) return (
    <Image
      source={{ uri: url }}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#fff" }}
    />
  );
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: "#f9731660", alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "#fff",
    }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.35 }}>
        {name?.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function formatUID(id: number) {
  return `RY${String(id).padStart(10, "0")}`;
}

// ─── Single Reel Item ─────────────────────────────────────────────────────────
function ReelItem({ reel, isActive, currentUserId, bottomInset, tabBarHeight, onDelete, itemHeight }: {
  reel: Reel;
  isActive: boolean;
  currentUserId: number | null;
  bottomInset: number;
  tabBarHeight: number;
  onDelete: (id: number) => void;
  itemHeight: number;
}) {
  const [liked, setLiked] = useState(reel.isLiked);
  const [likeCount, setLikeCount] = useState(reel.likeCount);
  const [commentCount, setCommentCount] = useState(reel.commentCount);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const viewTracked = useRef(false);

  // Double-tap to like
  const lastTapRef = useRef<number>(0);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;

  const isOwn = currentUserId === reel.userId;

  useEffect(() => {
    if (isOwn || !currentUserId) return;
    customFetch<{ isFollowing: boolean }>(`/api/users/${reel.userId}/follow-status`)
      .then((d) => setIsFollowing(d.isFollowing ?? false))
      .catch(() => setIsFollowing(false));
  }, [reel.userId, isOwn, currentUserId]);

  const handleFollow = async () => {
    if (isFollowing === null) return;
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      await customFetch(`/api/users/${reel.userId}/follow`, {
        method: next ? "POST" : "DELETE",
      });
    } catch {
      setIsFollowing(!next);
    }
  };

  const player = useVideoPlayer(isActive ? reel.videoUrl : null, (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!player) return;
    if (isActive) {
      try { player.play(); } catch {}
      if (!viewTracked.current) {
        viewTracked.current = true;
        customFetch(`/api/reels/${reel.id}/view`, { method: "POST" }).catch(() => {});
      }
    } else {
      try { player.pause(); } catch {}
    }
  }, [isActive, player, reel.id]);

  const toggleLike = async () => {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((c) => c + (newLiked ? 1 : -1));
    try {
      await customFetch(`/api/reels/${reel.id}/like`, { method: newLiked ? "POST" : "DELETE" });
    } catch {
      setLiked(!newLiked);
      setLikeCount((c) => c + (newLiked ? -1 : 1));
    }
  };

  const showHeartAnimation = () => {
    heartScale.setValue(0);
    heartOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 5 }),
      Animated.delay(400),
      Animated.timing(heartOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      heartScale.setValue(0);
    });
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap detected
      if (!liked) {
        setLiked(true);
        setLikeCount((c) => c + 1);
        customFetch(`/api/reels/${reel.id}/like`, { method: "POST" }).catch(() => {
          setLiked(false);
          setLikeCount((c) => c - 1);
        });
      }
      showHeartAnimation();
    }
    lastTapRef.current = now;
  };

  const handleDelete = () => {
    showConfirm("Delete Reel", "Are you sure you want to delete this reel?", async () => {
      try {
        await customFetch(`/api/reels/${reel.id}`, { method: "DELETE" });
        onDelete(reel.id);
      } catch {
        showError("Error", "Failed to delete reel.");
      }
    });
  };

  const handleShare = async () => {
    try {
      const url = `https://rankyatra.in/reels/${reel.id}`;
      const message = `${reel.userName} posted a reel on RankYatra!\n${reel.caption ? reel.caption + "\n" : ""}${url}`;
      if (Platform.OS === "ios") {
        await Share.share({ message, url, title: "RankYatra Reel" });
      } else {
        await Share.share({ message, title: "RankYatra Reel" });
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (!msg.includes("cancelled") && !msg.includes("User did not share") && !msg.includes("dismissed")) {
        showError("Error", "Could not open share menu.");
      }
    }
  };

  const caption = reel.caption?.trim() ?? "";
  const isLongCaption = caption.length > 60;

  const actionBottom = tabBarHeight + 32;
  const infoBottom = tabBarHeight + 36;

  return (
    <View style={{ width: SCREEN_W, height: itemHeight, backgroundColor: "#000" }}>
      {/* Video or thumbnail */}
      {isActive ? (
        player ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <ActivityIndicator color="#f97316" size="large" />
          </View>
        )
      ) : (
        reel.thumbnailUrl ? (
          <Image source={{ uri: reel.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
        )
      )}

      {/* Transparent tap overlay for double-tap to like */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleDoubleTap}
      />

      {/* Animated heart on double-tap */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
          { opacity: heartOpacity, transform: [{ scale: heartScale }] },
        ]}
      >
        <Feather name="heart" size={100} color="#f97316" style={{ opacity: 0.9 }} />
      </Animated.View>

      {/* Bottom gradient */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
        style={[StyleSheet.absoluteFillObject, { top: "45%" }]}
        pointerEvents="none"
      />

      {/* ── Right action buttons ── */}
      <View style={[s.rightActions, { bottom: actionBottom }]}>
        <TouchableOpacity style={s.actionBtn} onPress={toggleLike} activeOpacity={0.7}>
          <Feather name="heart" size={28} color={liked ? "#f97316" : "#fff"} />
          <Text style={[s.actionLabel, liked && { color: "#f97316" }]}>
            {likeCount > 999 ? `${(likeCount / 1000).toFixed(1)}k` : likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionBtn}
          onPress={() => router.push({ pathname: "/post-comments", params: { reelId: String(reel.id), isReel: "1" } } as any)}
          activeOpacity={0.7}
        >
          <Feather name="message-circle" size={28} color="#fff" />
          <Text style={s.actionLabel}>
            {commentCount > 999 ? `${(commentCount / 1000).toFixed(1)}k` : commentCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={handleShare}>
          <Feather name="send" size={26} color="#fff" />
          <Text style={s.actionLabel}>Share</Text>
        </TouchableOpacity>

        {isOwn && (
          <TouchableOpacity style={s.actionBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Feather name="trash-2" size={24} color="#fff" />
          </TouchableOpacity>
        )}

        <View style={[s.actionBtn, { marginTop: 6 }]}>
          <Feather name="eye" size={20} color="#ffffff99" />
          <Text style={[s.actionLabel, { color: "#ffffff99", fontSize: 11 }]}>{reel.viewCount}</Text>
        </View>
      </View>

      {/* ── Bottom user info + caption ── */}
      <View style={[s.bottomInfo, { bottom: infoBottom, right: 72 }]}>
        {/* User row + Follow button */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            style={[s.userRow, { flex: 1 }]}
            onPress={() => router.push(`/user/${reel.userId}` as any)}
            activeOpacity={0.8}
          >
            <Avatar name={reel.userName} url={reel.userAvatar} size={40} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={s.userName}>{reel.userName}</Text>
                {reel.verificationStatus === "verified" && (
                  <View style={s.kycBadge}>
                    <Text style={s.kycBadgeText}>✓ KYC</Text>
                  </View>
                )}
              </View>
              <Text style={s.uid}>{formatUID(reel.userId)}</Text>
              <Text style={s.timeAgo}>{timeAgo(reel.createdAt)}</Text>
            </View>
          </TouchableOpacity>

          {/* Follow button — only for others, only if not already following */}
          {!isOwn && isFollowing === false && (
            <TouchableOpacity
              onPress={handleFollow}
              activeOpacity={0.8}
              style={s.followBtn}
            >
              <Text style={s.followBtnText}>+ Follow</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Caption with See More */}
        {caption.length > 0 && (
          <TouchableOpacity onPress={() => setCaptionExpanded((e) => !e)} activeOpacity={0.8}>
            <Text style={s.caption} numberOfLines={captionExpanded ? undefined : 2}>
              {captionExpanded || !isLongCaption
                ? caption
                : caption.slice(0, 60).trimEnd()}
              {!captionExpanded && isLongCaption && (
                <Text style={{ color: "#f97316", fontWeight: "700" }}> ...see more</Text>
              )}
              {captionExpanded && isLongCaption && (
                <Text style={{ color: "#f97316", fontWeight: "700" }}> see less</Text>
              )}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Reels Feed ───────────────────────────────────────────────────────────────
export default function ReelsFeed({
  colors,
  tabBarHeight,
  isTabFocused = true,
  onBack,
}: {
  colors: any;
  tabBarHeight: number;
  isTabFocused?: boolean;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const upload = useReelsUpload();

  // Measure actual container height for correct snap
  const [containerH, setContainerH] = useState(Dimensions.get("window").height);

  const [reelsList, setReelsList] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isFetchingRef = useRef(false);

  const fetchReels = useCallback(async (cursor?: number) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const url = cursor ? `/api/reels?cursor=${cursor}` : "/api/reels";
      const data = await customFetch<{ reels: Reel[]; hasMore: boolean; nextCursor: number | null }>(url);
      if (cursor) {
        setReelsList((prev) => [...prev, ...data.reels]);
      } else {
        setReelsList(data.reels ?? []);
      }
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor ?? null);
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => { fetchReels(); }, [fetchReels]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const handleLoadMore = () => {
    if (!hasMore || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    fetchReels(nextCursor);
  };

  useEffect(() => {
    if (upload.done) {
      setTimeout(() => fetchReels(), 500);
    }
  }, [upload.done]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setContainerH(h);
  };

  const UploadBanner = (upload.isUploading || upload.done || upload.error) ? (
    <View style={[s.uploadBanner, { top: insets.top + 60 }]}>
      {upload.error ? (
        <View style={[s.bannerInner, { backgroundColor: "#ef4444ee" }]}>
          <Feather name="alert-circle" size={16} color="#fff" />
          <Text style={s.bannerText} numberOfLines={1}>{upload.error}</Text>
          <TouchableOpacity onPress={upload.reset} style={s.bannerClose}>
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : upload.done ? (
        <View style={[s.bannerInner, { backgroundColor: "#22c55eee" }]}>
          <Feather name="check-circle" size={16} color="#fff" />
          <Text style={s.bannerText}>Reel uploaded! Pull to refresh.</Text>
        </View>
      ) : (
        <View style={[s.bannerInner, { backgroundColor: "#000000cc" }]}>
          <ActivityIndicator size="small" color="#f97316" />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerText}>Uploading reel... {upload.progress}%</Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${upload.progress}%` as any }]} />
            </View>
          </View>
        </View>
      )}
    </View>
  ) : null;

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }} onLayout={onLayout}>
        {UploadBanner}
        <ActivityIndicator color="#f97316" size="large" />
      </View>
    );
  }

  if (reelsList.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000", paddingHorizontal: 32 }} onLayout={onLayout}>
        {UploadBanner}
        {/* Back button */}
        {onBack && (
          <TouchableOpacity style={[s.backBtn, { top: insets.top + 10 }]} onPress={onBack} activeOpacity={0.8}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {/* Header */}
        <View style={[s.topBar, { top: insets.top + 8 }]}>
          <Text style={s.reelsLabel}>Reels</Text>
        </View>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#f9731620", alignItems: "center", justifyContent: "center" }}>
          <Feather name="film" size={36} color="#f97316" />
        </View>
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No Reels Yet</Text>
        <Text style={{ color: "#ffffff80", fontSize: 13, textAlign: "center", marginTop: 6 }}>
          Be the first to share a reel!
        </Text>
        <TouchableOpacity
          style={{ marginTop: 20, backgroundColor: "#f97316", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}
          onPress={() => router.push("/create-reel" as any)}
        >
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Create Reel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }} onLayout={onLayout}>
      {/* Back button — top-left, slightly below status bar */}
      {onBack && (
        <TouchableOpacity
          style={[s.backBtn, { top: insets.top + 36 }]}
          onPress={onBack}
          activeOpacity={0.8}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Reels header — centered */}
      <View style={[s.topBar, { top: insets.top + 38, zIndex: 50 }]} pointerEvents="none">
        <Text style={s.reelsLabel}>Reels</Text>
      </View>

      {UploadBanner}

      <FlatList
        data={reelsList}
        keyExtractor={(r) => String(r.id)}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex && isTabFocused}
            currentUserId={user?.id ?? null}
            bottomInset={insets.bottom}
            tabBarHeight={tabBarHeight}
            onDelete={(id) => setReelsList((prev) => prev.filter((r) => r.id !== id))}
            itemHeight={containerH}
          />
        )}
        pagingEnabled
        snapToInterval={containerH}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        windowSize={3}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        initialNumToRender={1}
        ListFooterComponent={loadingMore ? (
          <View style={{ height: containerH, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#f97316" />
          </View>
        ) : null}
        getItemLayout={(_, index) => ({ length: containerH, offset: containerH * index, index })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  backBtn: {
    position: "absolute",
    left: 14,
    zIndex: 100,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#00000050",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  reelsLabel: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textShadowColor: "#0008",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  rightActions: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    gap: 20,
  },
  actionBtn: { alignItems: "center", gap: 4 },
  actionLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "#0008",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomInfo: {
    position: "absolute",
    left: 12,
    gap: 10,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  userName: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    textShadowColor: "#0008",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  uid: {
    color: "#f97316",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 1,
  },
  timeAgo: { color: "#ffffff99", fontSize: 11, marginTop: 1 },
  kycBadge: {
    backgroundColor: "#d1fae5",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  kycBadgeText: { color: "#065f46", fontSize: 9, fontWeight: "700" },
  caption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: "#0004",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followBtn: {
    backgroundColor: "#f97316",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: "center",
  },
  followBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  uploadBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 999,
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: "hidden",
  },
  bannerText: { color: "#fff", fontSize: 13, fontWeight: "600", flex: 1 },
  bannerClose: { padding: 4 },
  progressTrack: {
    height: 3,
    backgroundColor: "#ffffff30",
    borderRadius: 2,
    marginTop: 5,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#f97316", borderRadius: 2 },
});
