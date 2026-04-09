import { Router, type IRouter } from "express";
import { db, postsTable, postLikesTable, postCommentsTable, postCommentLikesTable, notificationsTable, usersTable, followsTable, reportsTable, submissionsTable } from "@workspace/db";
import { eq, and, desc, lt, count, sql, ilike } from "drizzle-orm";
import { requireAuth, optionalAuth } from "../middlewares/auth";
import { broadcastToUser } from "../lib/ws";
import { sendPushToUser, getDisplayName } from "../lib/pushNotifications";

const router: IRouter = Router();

// Search users by name or UID
router.get("/users/search", optionalAuth, async (req: any, res: any) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json([]);
  try {
    const numQ = Number(q);
    const isNum = !isNaN(numQ) && q.length > 0;
    const users = await db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(isNum ? eq(usersTable.id, numQ) : ilike(usersTable.name, `%${q}%`))
      .limit(15);
    res.json(users);
  } catch {
    res.status(500).json({ message: "Search failed" });
  }
});

// Get feed posts (with top comment)
router.get("/posts", optionalAuth, async (req: any, res: any) => {
  const userId = req.user?.id ?? null;
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;
  const limit = 15;
  try {
    const rows = await db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        imageUrl: postsTable.imageUrl,
        createdAt: postsTable.createdAt,
        userId: postsTable.userId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        viewCount: postsTable.viewCount,
        likeCount: sql<number>`(SELECT COUNT(*) FROM post_likes WHERE post_id = ${postsTable.id})::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_id = ${postsTable.id})::int`,
        isLiked: userId
          ? sql<boolean>`EXISTS(SELECT 1 FROM post_likes WHERE post_id = ${postsTable.id} AND user_id = ${userId})`
          : sql<boolean>`false`,
        isFollowing: userId
          ? sql<boolean>`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${userId} AND following_id = ${postsTable.userId})`
          : sql<boolean>`false`,
        shareCount: postsTable.shareCount,
        updatedAt: postsTable.updatedAt,
        editedAt: postsTable.editedAt,
        verificationStatus: usersTable.verificationStatus,
        rankPoints: sql<number>`(SELECT COALESCE(SUM(score), 0) FROM submissions WHERE user_id = ${postsTable.userId})::int`,
        topCommentContent: sql<string | null>`(SELECT content FROM post_comments WHERE post_id = ${postsTable.id} AND parent_comment_id IS NULL ORDER BY created_at DESC LIMIT 1)`,
        topCommentUser: sql<string | null>`(SELECT u.name FROM post_comments pc JOIN users u ON u.id = pc.user_id WHERE pc.post_id = ${postsTable.id} AND pc.parent_comment_id IS NULL ORDER BY pc.created_at DESC LIMIT 1)`,
        topCommentUserAvatar: sql<string | null>`(SELECT u.avatar_url FROM post_comments pc JOIN users u ON u.id = pc.user_id WHERE pc.post_id = ${postsTable.id} AND pc.parent_comment_id IS NULL ORDER BY pc.created_at DESC LIMIT 1)`,
        topReplyContent: sql<string | null>`(SELECT content FROM post_comments WHERE post_id = ${postsTable.id} AND parent_comment_id IS NOT NULL ORDER BY created_at DESC LIMIT 1)`,
        topReplyUser: sql<string | null>`(SELECT u.name FROM post_comments pc JOIN users u ON u.id = pc.user_id WHERE pc.post_id = ${postsTable.id} AND pc.parent_comment_id IS NOT NULL ORDER BY pc.created_at DESC LIMIT 1)`,
        topReplyUserAvatar: sql<string | null>`(SELECT u.avatar_url FROM post_comments pc JOIN users u ON u.id = pc.user_id WHERE pc.post_id = ${postsTable.id} AND pc.parent_comment_id IS NOT NULL ORDER BY pc.created_at DESC LIMIT 1)`,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(cursor ? lt(postsTable.id, cursor) : undefined)
      .orderBy(desc(postsTable.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit);
    res.json({ posts, hasMore, nextCursor: hasMore ? posts[posts.length - 1].id : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// Get posts by specific user
router.get("/posts/user/:userId", optionalAuth, async (req: any, res: any) => {
  const targetUserId = Number(req.params.userId);
  const viewerId = req.user?.id ?? null;
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;
  const limit = 12;
  try {
    const rows = await db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        imageUrl: postsTable.imageUrl,
        createdAt: postsTable.createdAt,
        userId: postsTable.userId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        likeCount: sql<number>`(SELECT COUNT(*) FROM post_likes WHERE post_id = ${postsTable.id})::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_id = ${postsTable.id})::int`,
        isLiked: viewerId
          ? sql<boolean>`EXISTS(SELECT 1 FROM post_likes WHERE post_id = ${postsTable.id} AND user_id = ${viewerId})`
          : sql<boolean>`false`,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(
        cursor
          ? and(eq(postsTable.userId, targetUserId), lt(postsTable.id, cursor))
          : eq(postsTable.userId, targetUserId)
      )
      .orderBy(desc(postsTable.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit);
    res.json({ posts, hasMore, nextCursor: hasMore ? posts[posts.length - 1].id : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch user posts" });
  }
});

// Get single post
router.get("/posts/:id", optionalAuth, async (req: any, res: any) => {
  const postId = Number(req.params.id);
  const userId = req.user?.id ?? null;
  try {
    const rows = await db
      .select({
        id: postsTable.id,
        content: postsTable.content,
        imageUrl: postsTable.imageUrl,
        createdAt: postsTable.createdAt,
        userId: postsTable.userId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        viewCount: postsTable.viewCount,
        likeCount: sql<number>`(SELECT COUNT(*) FROM post_likes WHERE post_id = ${postsTable.id})::int`,
        commentCount: sql<number>`(SELECT COUNT(*) FROM post_comments WHERE post_id = ${postsTable.id})::int`,
        isLiked: userId
          ? sql<boolean>`EXISTS(SELECT 1 FROM post_likes WHERE post_id = ${postsTable.id} AND user_id = ${userId})`
          : sql<boolean>`false`,
        isFollowing: userId
          ? sql<boolean>`EXISTS(SELECT 1 FROM follows WHERE follower_id = ${userId} AND following_id = ${postsTable.userId})`
          : sql<boolean>`false`,
      })
      .from(postsTable)
      .innerJoin(usersTable, eq(usersTable.id, postsTable.userId))
      .where(eq(postsTable.id, postId))
      .limit(1);
    if (!rows[0]) return res.status(404).json({ message: "Post not found" });
    res.json(rows[0]);
  } catch {
    res.status(500).json({ message: "Failed to fetch post" });
  }
});

// Increment view count
router.post("/posts/:id/view", optionalAuth, async (req: any, res: any) => {
  const postId = Number(req.params.id);
  try {
    await db.update(postsTable)
      .set({ viewCount: sql`${postsTable.viewCount} + 1` })
      .where(eq(postsTable.id, postId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// Increment share count
router.post("/posts/:id/share", optionalAuth, async (req: any, res: any) => {
  const postId = Number(req.params.id);
  try {
    await db.update(postsTable)
      .set({ shareCount: sql`${postsTable.shareCount} + 1` })
      .where(eq(postsTable.id, postId));
    const [row] = await db.select({ shareCount: postsTable.shareCount }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    res.json({ shareCount: row?.shareCount ?? 0 });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// Create post
router.post("/posts", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const { content, imageUrl } = req.body;
  const trimmedContent = content?.trim() ?? "";
  // At least one of content or imageUrl must be present
  if (!trimmedContent && !imageUrl) return res.status(400).json({ message: "Content or image required" });
  try {
    const [post] = await db.insert(postsTable).values({
      userId,
      content: trimmedContent,
      imageUrl: imageUrl ?? null,
    }).returning();
    res.json(post);

    // Notify all followers about the new post (fire and forget)
    getDisplayName(userId).then(async (name) => {
      const followers = await db
        .select({ followerId: followsTable.followerId })
        .from(followsTable)
        .where(eq(followsTable.followingId, userId));
      const previewBase = trimmedContent || (imageUrl ? "📷 Photo" : "");
      const preview = previewBase.length > 60 ? previewBase.slice(0, 57) + "…" : previewBase;
      for (const { followerId } of followers) {
        // Save to notification panel
        await db.insert(notificationsTable).values({ userId: followerId, type: "new_post", fromUserId: userId, postId: post.id }).catch(() => {});
        // Real-time in-app badge update
        broadcastToUser(followerId, JSON.stringify({ type: "notification", notifType: "new_post", fromUserId: userId, postId: post.id }));
        // Push notification
        sendPushToUser(followerId, `${name} ne naya post kiya 📝`, preview, { type: "new_post", postId: post.id });
      }
    }).catch(() => {});
  } catch {
    res.status(500).json({ message: "Failed to create post" });
  }
});

// Edit post (supports both PUT and PATCH)
async function editPostHandler(req: any, res: any) {
  const userId = req.user.id;
  const postId = Number(req.params.id);
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: "Content required" });
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    const [updated] = await db.update(postsTable)
      .set({ content: content.trim(), editedAt: new Date() })
      .where(eq(postsTable.id, postId))
      .returning();
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to edit post" });
  }
}
router.put("/posts/:id", requireAuth, editPostHandler);
router.patch("/posts/:id", requireAuth, editPostHandler);

// Delete post
router.delete("/posts/:id", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const postId = Number(req.params.id);
  try {
    const [post] = await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await db.delete(postsTable).where(eq(postsTable.id, postId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete post" });
  }
});

// Like post
router.post("/posts/:id/like", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const postId = Number(req.params.id);
  try {
    await db.insert(postLikesTable).values({ postId, userId }).onConflictDoNothing();
    const [post] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (post && post.userId !== userId) {
      await db.insert(notificationsTable).values({ userId: post.userId, type: "like", fromUserId: userId, postId });
      broadcastToUser(post.userId, JSON.stringify({ type: "notification", notifType: "like", fromUserId: userId, postId }));
      getDisplayName(userId).then((name) => sendPushToUser(post.userId, "New Like ❤️", `${name} liked your post`, { type: "like", postId }));
    }
    const [{ cnt }] = await db.select({ cnt: count() }).from(postLikesTable).where(eq(postLikesTable.postId, postId));
    res.json({ likeCount: Number(cnt) });
  } catch {
    res.status(500).json({ message: "Failed to like post" });
  }
});

// Unlike post
router.delete("/posts/:id/like", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const postId = Number(req.params.id);
  try {
    await db.delete(postLikesTable).where(and(eq(postLikesTable.postId, postId), eq(postLikesTable.userId, userId)));
    const [{ cnt }] = await db.select({ cnt: count() }).from(postLikesTable).where(eq(postLikesTable.postId, postId));
    res.json({ likeCount: Number(cnt) });
  } catch {
    res.status(500).json({ message: "Failed to unlike post" });
  }
});

// Who liked this post
router.get("/posts/:id/likers", optionalAuth, async (req: any, res: any) => {
  const postId = Number(req.params.id);
  try {
    const likers = await db
      .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
      .from(postLikesTable)
      .innerJoin(usersTable, eq(usersTable.id, postLikesTable.userId))
      .where(eq(postLikesTable.postId, postId))
      .orderBy(desc(postLikesTable.createdAt))
      .limit(100);
    res.json(likers);
  } catch {
    res.status(500).json({ message: "Failed to fetch likers" });
  }
});

// Report a post
router.post("/posts/:id/report", requireAuth, async (req: any, res: any) => {
  const reporterId = req.user.id;
  const postId = Number(req.params.id);
  const { reason, details } = req.body;
  if (!reason) return res.status(400).json({ message: "Reason is required" });
  try {
    const [post] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId === reporterId) return res.status(400).json({ message: "Cannot report your own post" });
    await db.insert(reportsTable).values({
      reporterId,
      reportedUserId: post.userId,
      postId,
      reason,
      details: details ?? null,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to submit report" });
  }
});

// Get comments for a post
router.get("/posts/:id/comments", optionalAuth, async (req: any, res: any) => {
  const postId = Number(req.params.id);
  const userId = req.user?.id ?? null;
  try {
    const comments = await db
      .select({
        id: postCommentsTable.id,
        content: postCommentsTable.content,
        createdAt: postCommentsTable.createdAt,
        userId: postCommentsTable.userId,
        parentCommentId: postCommentsTable.parentCommentId,
        userName: usersTable.name,
        userAvatar: usersTable.avatarUrl,
        likeCount: sql<number>`(SELECT COUNT(*) FROM post_comment_likes WHERE comment_id = ${postCommentsTable.id})::int`,
        isLiked: userId
          ? sql<boolean>`EXISTS(SELECT 1 FROM post_comment_likes WHERE comment_id = ${postCommentsTable.id} AND user_id = ${userId})`
          : sql<boolean>`false`,
      })
      .from(postCommentsTable)
      .innerJoin(usersTable, eq(usersTable.id, postCommentsTable.userId))
      .where(eq(postCommentsTable.postId, postId))
      .orderBy(desc(postCommentsTable.createdAt));
    res.json(comments);
  } catch {
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Add comment
router.post("/posts/:id/comments", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const postId = Number(req.params.id);
  const { content, parentCommentId } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: "Content required" });
  try {
    const [comment] = await db.insert(postCommentsTable).values({
      postId,
      userId,
      content: content.trim(),
      parentCommentId: parentCommentId ?? null,
    }).returning();
    const [user] = await db.select({ name: usersTable.name, avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const [post] = await db.select({ userId: postsTable.userId }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
    const senderName = user?.name ?? "Someone";
    if (post && post.userId !== userId) {
      await db.insert(notificationsTable).values({ userId: post.userId, type: "comment", fromUserId: userId, postId, commentId: comment.id });
      broadcastToUser(post.userId, JSON.stringify({ type: "notification", notifType: "comment", fromUserId: userId, postId }));
      sendPushToUser(post.userId, "New Comment 💬", `${senderName} commented on your post`, { type: "comment", postId });
    }
    if (parentCommentId) {
      const [parentComment] = await db.select({ userId: postCommentsTable.userId }).from(postCommentsTable).where(eq(postCommentsTable.id, parentCommentId)).limit(1);
      if (parentComment && parentComment.userId !== userId && parentComment.userId !== post?.userId) {
        await db.insert(notificationsTable).values({ userId: parentComment.userId, type: "reply", fromUserId: userId, postId, commentId: comment.id });
        broadcastToUser(parentComment.userId, JSON.stringify({ type: "notification", notifType: "reply", fromUserId: userId, postId }));
        sendPushToUser(parentComment.userId, "New Reply 💬", `${senderName} replied to your comment`, { type: "reply", postId });
      }
    }
    res.json({ ...comment, userName: user?.name, userAvatar: user?.avatarUrl ?? null, likeCount: 0, isLiked: false });
  } catch {
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// Delete comment
router.delete("/posts/:postId/comments/:commentId", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const commentId = Number(req.params.commentId);
  try {
    const [comment] = await db.select().from(postCommentsTable).where(eq(postCommentsTable.id, commentId)).limit(1);
    if (!comment) return res.status(404).json({ message: "Not found" });
    if (comment.userId !== userId) return res.status(403).json({ message: "Forbidden" });
    await db.delete(postCommentsTable).where(eq(postCommentsTable.id, commentId));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: "Failed to delete comment" });
  }
});

// Like a comment
router.post("/posts/:postId/comments/:commentId/like", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const commentId = Number(req.params.commentId);
  try {
    await db.insert(postCommentLikesTable).values({ commentId, userId }).onConflictDoNothing();
    const [{ cnt }] = await db.select({ cnt: count() }).from(postCommentLikesTable).where(eq(postCommentLikesTable.commentId, commentId));
    res.json({ likeCount: Number(cnt) });
  } catch {
    res.status(500).json({ message: "Failed to like comment" });
  }
});

// Unlike a comment
router.delete("/posts/:postId/comments/:commentId/like", requireAuth, async (req: any, res: any) => {
  const userId = req.user.id;
  const commentId = Number(req.params.commentId);
  try {
    await db.delete(postCommentLikesTable).where(and(eq(postCommentLikesTable.commentId, commentId), eq(postCommentLikesTable.userId, userId)));
    const [{ cnt }] = await db.select({ cnt: count() }).from(postCommentLikesTable).where(eq(postCommentLikesTable.commentId, commentId));
    res.json({ likeCount: Number(cnt) });
  } catch {
    res.status(500).json({ message: "Failed to unlike comment" });
  }
});

export default router;
