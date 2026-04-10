-- Phase 12b: 사용자별 프로젝트 순서 저장 (개인 전용, 기기 간 동기화)

CREATE TABLE IF NOT EXISTS user_project_order (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,  -- projects.id가 text 타입 (기존 데이터 호환)
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_upo_user ON user_project_order(user_id);

ALTER TABLE user_project_order ENABLE ROW LEVEL SECURITY;

-- RLS: 본인 것만 읽기/쓰기
CREATE POLICY "upo_select_own" ON user_project_order FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "upo_insert_own" ON user_project_order FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "upo_update_own" ON user_project_order FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "upo_delete_own" ON user_project_order FOR DELETE
  USING (user_id = auth.uid());
