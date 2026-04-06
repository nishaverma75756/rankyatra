#!/bin/bash
set -e

echo "=== RankYatra Deploy Script ==="

# 1. Pull latest code
echo "[1/8] Pulling latest code..."
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
"

echo "    Database schema synced."

# 4. Build API
echo "[4/8] Building API server..."
pnpm --filter @workspace/api-server build

# 5. Build Web
echo "[5/8] Building web app..."
pnpm --filter @workspace/rankyatra build

# 6. Copy web files
echo "[6/8] Copying web files..."
sudo cp -r artifacts/rankyatra/dist/public/* /var/www/rankyatra/public/

# 7. Nginx WebSocket config (only if not already added)
NGINX_CONF="/etc/nginx/sites-available/rankyatra"
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
  sudo nginx -t && sudo systemctl reload nginx
  echo "    WebSocket config added and Nginx reloaded."
else
  echo "[7/8] Nginx WebSocket config already present. Skipping."
fi

# 8. Restart pm2
echo "[8/8] Restarting services..."
pm2 restart all

echo ""
echo "=== Deploy complete! RankYatra is live ==="
