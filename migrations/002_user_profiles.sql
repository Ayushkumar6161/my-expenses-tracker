CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT NOW()
)