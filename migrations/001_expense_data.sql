CREATE TABLE expense_data (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{"money":[],"expenses":[],"borrow":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)