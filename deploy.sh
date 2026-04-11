#!/bin/bash
set -e

echo "=== RankYatra Deploy Script ==="

# 1. Pull latest code
echo "[1/8] Pulling latest code..."
git checkout -- .
rm -rf artifacts/rankyatra/dist
git pull origin main

# 2. Install dependencies
echo "[2/8] Installing dependencies..."
pnpm install

# 3. Sync DB schema via direct SQL (DATABASE_URL not available in pm2 env)
echo "[3/8] Syncing database schema..."
DB_CMD="sudo -u postgres psql rankyatradb"

$DB_CMD -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true;"

$DB_CMD -c "CREATE TABLE IF NOT EXISTS user_blocks (
  id serial PRIMARY KEY,
  blocker_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);"

$DB_CMD -c "CREATE TABLE IF NOT EXISTS conversations (
  id serial PRIMARY KEY,
  user1_id integer NOT NULL REFERENCES users(id),
  user2_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);"

$DB_CMD -c "CREATE TABLE IF NOT EXISTS messages (
  id serial PRIMARY KEY,
  conversation_id integer NOT NULL REFERENCES conversations(id),
  sender_id integer NOT NULL REFERENCES users(id),
  content text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);"

$DB_CMD -c "CREATE TABLE IF NOT EXISTS reports (
  id serial PRIMARY KEY,
  reporter_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id integer REFERENCES conversations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);"

$DB_CMD -c "CREATE TABLE IF NOT EXISTS muted_conversations (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);"

# Grant access to all users (API may run as non-postgres user)
$DB_CMD -c "GRANT ALL PRIVILEGES ON TABLE conversations TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE messages TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE conversations_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE messages_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE user_blocks TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE user_blocks_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE reports TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE reports_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE muted_conversations TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE muted_conversations_id_seq TO PUBLIC;"

# Message delete/edit columns (added Apr 2026)
$DB_CMD -c "
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted_for_sender boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted_for_receiver boolean NOT NULL DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted_for_everyone boolean NOT NULL DEFAULT false;
"

# Conversation soft-delete per user (added Apr 2026)
$DB_CMD -c "
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user1 boolean NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_for_user2 boolean NOT NULL DEFAULT false;
"

# Moments / Social feed tables (added Apr 2026)
$DB_CMD -c "
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER,
  comment_id INTEGER,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON TABLE posts TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE posts_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE post_likes TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE post_comments TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE post_comments_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE notifications TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE notifications_id_seq TO PUBLIC;

-- View count on posts (added Apr 2026)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW() NOT NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Post reports (added Apr 2026)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL;

-- Comment likes and replies (added Apr 2026)
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_comment_id INTEGER;
CREATE TABLE IF NOT EXISTS post_comment_likes (
  comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT ALL PRIVILEGES ON TABLE post_comment_likes TO PUBLIC;

-- Exam reminder notification support (added Apr 2026)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS exam_id INTEGER;

-- Push notification tokens (added Apr 2026)
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON TABLE push_tokens TO PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE push_tokens_id_seq TO PUBLIC;

-- Instamojo payment gateway support (added Apr 2026)
ALTER TABLE wallet_deposits ALTER COLUMN utr_number DROP NOT NULL;
ALTER TABLE wallet_deposits ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE wallet_deposits ADD COLUMN IF NOT EXISTS payment_request_id VARCHAR(100);

-- Reels / Moments video system (added Apr 2026)
CREATE TABLE IF NOT EXISTS reels (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT NOT NULL DEFAULT '',
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reel_id, user_id)
);
GRANT ALL PRIVILEGES ON TABLE reels TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE reels_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE reel_likes TO PUBLIC;
"

# Roles & Groups system (added Apr 2026)
$DB_CMD -c "
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  assigned_by INTEGER REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS group_commission_withdrawals (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  upi_id VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE group_commission_withdrawals ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);
ALTER TABLE group_commission_withdrawals ADD COLUMN IF NOT EXISTS utr_number VARCHAR(255);
ALTER TABLE group_commission_withdrawals ALTER COLUMN upi_id DROP NOT NULL;
GRANT ALL PRIVILEGES ON TABLE user_roles TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE user_roles_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE groups TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE groups_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE group_members TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE group_members_id_seq TO PUBLIC;
GRANT ALL PRIVILEGES ON TABLE group_commission_withdrawals TO PUBLIC;
GRANT ALL PRIVILEGES ON SEQUENCE group_commission_withdrawals_id_seq TO PUBLIC;
"

echo "    Database schema synced."

# 3.5 Add swap memory if not present (needed for Vite build on low-RAM EC2)
if [ ! -f /swapfile ]; then
  echo "[3.5/8] Adding 2GB swap memory..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "    Swap added."
else
  echo "[3.5/8] Swap already present. Skipping."
fi

# 4. Build API
echo "[4/8] Building API server..."
pnpm --filter @workspace/api-server build

# 5. Build Web
echo "[5/8] Building web app..."
NODE_OPTIONS="--max-old-space-size=4096" pnpm --filter @workspace/rankyatra build

# 6. Copy web files
echo "[6/8] Copying web files..."
sudo cp -r artifacts/rankyatra/dist/public/* /var/www/rankyatra/public/

# 7. Nginx config for WebSocket + /uploads (video files)
NGINX_CONF="/etc/nginx/sites-available/rankyatra"

# Add WebSocket proxy if not present
if [ -f "$NGINX_CONF" ] && ! grep -q "location /ws" "$NGINX_CONF"; then
  echo "[7/8] Adding WebSocket config to Nginx..."
  sudo sed -i '/location \/api/i\
    location /ws {\
        proxy_pass http://localhost:8080;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "Upgrade";\
        proxy_set_header Host $host;\
        proxy_read_timeout 86400;\
    }\
' "$NGINX_CONF"
  echo "    WebSocket config added."
fi

# Increase nginx body size limit for video uploads (default 1MB is too small)
if [ -f "$NGINX_CONF" ] && ! grep -q "client_max_body_size" "$NGINX_CONF"; then
  echo "[7/8] Setting nginx client_max_body_size to 250m..."
  sudo sed -i '/server {/a\    client_max_body_size 250m;' "$NGINX_CONF"
  echo "    client_max_body_size set."
fi

# Add /uploads proxy (for reel video files stored on disk)
if [ -f "$NGINX_CONF" ] && ! grep -q "location /uploads" "$NGINX_CONF"; then
  echo "[7/8] Adding /uploads proxy to Nginx..."
  sudo sed -i '/location \/api/i\
    location /uploads {\
        proxy_pass http://localhost:8080;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        add_header Cache-Control "public, max-age=31536000";\
    }\
' "$NGINX_CONF"
  echo "    /uploads proxy added."
fi

# Create uploads directory on EC2 (in app dir where PM2 runs)
mkdir -p ~/rankyatra/uploads/videos ~/rankyatra/uploads/thumbnails

sudo nginx -t && sudo systemctl reload nginx
echo "[7/8] Nginx reloaded."

# 8. Restart pm2 using ecosystem config (loads .env via env_file)
echo "[8/8] Restarting services..."
pm2 stop rankyatra-api 2>/dev/null || true
pm2 start ecosystem.config.js --update-env

echo ""
echo "=== Deploy complete! RankYatra is live ==="
