-- Loop-16: UI state persistence (collapse/expand)
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ui_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  collapse_state JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO ui_state (id, collapse_state)
VALUES ('default', '{}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE ui_state ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can read ui_state"
  ON ui_state FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update ui_state"
  ON ui_state FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert ui_state"
  ON ui_state FOR INSERT TO authenticated WITH CHECK (true);
