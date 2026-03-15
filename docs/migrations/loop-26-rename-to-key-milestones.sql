-- ═══════════════════════════════════════════════════════════════════════════
-- Loop-26 DB Migration: ref_* → key_* 테이블 리네이밍
-- 실행 전 주의: 기존 데이터가 모두 삭제됩니다 (DROP CASCADE)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ 1. 기존 테이블 삭제 (CASCADE로 의존성 함께) ═══

DROP TABLE IF EXISTS ref_policies CASCADE;
DROP TABLE IF EXISTS ref_links CASCADE;
DROP TABLE IF EXISTS ref_deliverables CASCADE;
DROP TABLE IF EXISTS ref_milestones CASCADE;
DROP TABLE IF EXISTS project_references CASCADE;

-- ═══ 2. 신규 테이블 생성 ═══

-- 프로젝트별 Key Milestone 부모 레코드
CREATE TABLE project_key_milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pkm_project_id ON project_key_milestones(project_id);
ALTER TABLE project_key_milestones ENABLE ROW LEVEL SECURITY;

-- 마일스톤 항목
CREATE TABLE key_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id         uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title          text NOT NULL DEFAULT '',
  description    text,
  start_date     date,
  end_date       date,
  color          text DEFAULT '#1D9E75',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_km_pkm_id ON key_milestones(pkm_id);
CREATE INDEX idx_km_project_id ON key_milestones(project_id);
ALTER TABLE key_milestones ENABLE ROW LEVEL SECURITY;

-- 핵심 결과물
CREATE TABLE key_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id   uuid REFERENCES key_milestones(id) ON DELETE CASCADE,
  pkm_id         uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title          text NOT NULL DEFAULT '',
  description    text,
  assignee_ids   text[],
  tag_label      text,
  tag_bg         text DEFAULT '#E6F1FB',
  tag_text_color text DEFAULT '#185FA5',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_kd_milestone_id ON key_deliverables(milestone_id);
CREATE INDEX idx_kd_pkm_id ON key_deliverables(pkm_id);
CREATE INDEX idx_kd_project_id ON key_deliverables(project_id);
ALTER TABLE key_deliverables ENABLE ROW LEVEL SECURITY;

-- 참조 문서
CREATE TABLE key_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id       uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  url          text,
  description  text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_kl_pkm_id ON key_links(pkm_id);
ALTER TABLE key_links ENABLE ROW LEVEL SECURITY;

-- 합의된 정책
CREATE TABLE key_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id       uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  description  text,
  tag_label    text,
  tag_type     text DEFAULT 'internal',
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_kp_pkm_id ON key_policies(pkm_id);
ALTER TABLE key_policies ENABLE ROW LEVEL SECURITY;

-- ═══ 3. tasks 테이블 컬럼 정리 ═══

-- ref_milestone_id → key_milestone_id 로 변경
ALTER TABLE tasks DROP COLUMN IF EXISTS ref_milestone_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS deliverable_id;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS key_milestone_id uuid REFERENCES key_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_key_milestone_id ON tasks(key_milestone_id);

-- ═══ 4. RLS 정책 (5개 테이블 × 4개 = 20개) ═══

-- ─── project_key_milestones ───
CREATE POLICY "team_select_pkm" ON project_key_milestones FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_pkm" ON project_key_milestones FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_update_pkm" ON project_key_milestones FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_pkm" ON project_key_milestones FOR DELETE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

-- ─── key_milestones ───
CREATE POLICY "team_select_km" ON key_milestones FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_km" ON key_milestones FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_update_km" ON key_milestones FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_km" ON key_milestones FOR DELETE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

-- ─── key_deliverables ───
CREATE POLICY "team_select_kd" ON key_deliverables FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_kd" ON key_deliverables FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_update_kd" ON key_deliverables FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_kd" ON key_deliverables FOR DELETE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

-- ─── key_links ───
CREATE POLICY "team_select_kl" ON key_links FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_kl" ON key_links FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_update_kl" ON key_links FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_kl" ON key_links FOR DELETE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

-- ─── key_policies ───
CREATE POLICY "team_select_kp" ON key_policies FOR SELECT USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_kp" ON key_policies FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_update_kp" ON key_policies FOR UPDATE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_kp" ON key_policies FOR DELETE USING (
  project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid() AND team_id IS NULL
  )
);

-- ═══ 5. 검증 쿼리 ═══
-- 아래 쿼리로 마이그레이션 결과 확인

-- 테이블 존재 확인
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('project_key_milestones','key_milestones','key_deliverables','key_links','key_policies');

-- RLS 정책 확인
-- SELECT tablename, policyname FROM pg_policies
-- WHERE tablename LIKE 'key_%' OR tablename = 'project_key_milestones';

-- tasks.key_milestone_id 확인
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'tasks' AND column_name = 'key_milestone_id';

-- 기존 테이블 삭제 확인 (결과 0건이어야 함)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('project_references','ref_milestones','ref_deliverables','ref_links','ref_policies');
