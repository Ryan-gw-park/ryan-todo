-- ============================================================
-- Loop-45: 포커스 패널 + '즉시' 시스템 프로젝트
-- 추가 전용 (ADD COLUMN / CREATE INDEX) — 기존 컬럼/제약 변경 없음
-- ============================================================

-- ─── tasks 확장 ───
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_focus boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS focus_sort_order integer NOT NULL DEFAULT 0;

-- 포커스 카드 조회 (assignee_id 기준)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_focus
  ON tasks(assignee_id, is_focus)
  WHERE is_focus = true AND deleted_at IS NULL;

-- 포커스 카드 정렬 (focus_sort_order ASC)
CREATE INDEX IF NOT EXISTS idx_tasks_focus_sort
  ON tasks(assignee_id, focus_sort_order)
  WHERE is_focus = true AND deleted_at IS NULL;

-- ─── projects 확장 (system project 지원) ───
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS system_key text DEFAULT NULL;

-- 사용자당 system_key 중복 차단 (예: '즉시' 1개만)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_system_key
  ON projects(user_id, system_key) WHERE system_key IS NOT NULL;
