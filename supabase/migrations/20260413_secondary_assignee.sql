-- Phase 12d: 정/부 담당자 시스템

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS secondary_assignee_id uuid DEFAULT NULL;

ALTER TABLE key_milestones
  ADD COLUMN IF NOT EXISTS secondary_owner_id uuid DEFAULT NULL
  REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee
  ON tasks(secondary_assignee_id)
  WHERE secondary_assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ms_secondary_owner
  ON key_milestones(secondary_owner_id)
  WHERE secondary_owner_id IS NOT NULL;
