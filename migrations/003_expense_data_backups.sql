CREATE TABLE expense_data_backups (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  source_updated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)