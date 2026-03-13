-- user_task_settings: 개인별 할일 설정 (강조 색상 등)
-- 팀 모드에서 highlight_color를 사용자별로 독립 관리

CREATE TABLE IF NOT EXISTS user_task_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  task_id         text NOT NULL,
  highlight_color text DEFAULT NULL,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE(user_id, task_id)
);

ALTER TABLE user_task_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_task_settings_owner" ON user_task_settings FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_user_task_settings_user ON user_task_settings(user_id);
CREATE INDEX idx_user_task_settings_task ON user_task_settings(task_id);
CREATE INDEX idx_user_task_settings_updated ON user_task_settings(updated_at);
