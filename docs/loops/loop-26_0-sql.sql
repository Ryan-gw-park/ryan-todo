-- ═══════════════════════════════════════════════════════════════════════════
-- Loop-26.0: Reference DB Schema + RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════
-- 실행 방법: Supabase Dashboard > SQL Editor에서 복사-붙여넣기 후 실행
-- 주의: 순서대로 실행해야 합니다 (사전 확인 → 마이그레이션 → 테이블 생성 → RLS)
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: 사전 확인
-- ═══════════════════════════════════════════════════════════════════════════

-- 1-1. tasks.created_by 존재 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'created_by';

-- 1-2. projects.created_by 존재 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'created_by';

-- 1-3. projects.id 타입 확인 (text expected)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'projects' AND column_name = 'id';


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: 마이그레이션 A - tasks.created_by (조건부: 위 확인에서 없으면 실행)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE tasks SET created_by = assignee_id
WHERE created_by IS NULL AND assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

CREATE OR REPLACE FUNCTION set_task_created_by()
RETURNS trigger AS $$
BEGIN
  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_created_by ON tasks;
CREATE TRIGGER trg_tasks_created_by
BEFORE INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION set_task_created_by();


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: 마이그레이션 B - projects.created_by (조건부: 위 확인에서 없으면 실행)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE projects SET created_by = user_id::uuid
WHERE created_by IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

CREATE OR REPLACE FUNCTION set_project_created_by()
RETURNS trigger AS $$
BEGIN
  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_projects_created_by ON projects;
CREATE TRIGGER trg_projects_created_by
BEFORE INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION set_project_created_by();


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: 신규 테이블 생성
-- ═══════════════════════════════════════════════════════════════════════════

-- 4-1. project_references
CREATE TABLE IF NOT EXISTS project_references (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_references_project_id ON project_references(project_id);
ALTER TABLE project_references ENABLE ROW LEVEL SECURITY;

-- 4-2. ref_milestones
CREATE TABLE IF NOT EXISTS ref_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_ref_milestones_reference_id ON ref_milestones(reference_id);
CREATE INDEX IF NOT EXISTS idx_ref_milestones_project_id ON ref_milestones(project_id);
ALTER TABLE ref_milestones ENABLE ROW LEVEL SECURITY;

-- 4-3. ref_deliverables
CREATE TABLE IF NOT EXISTS ref_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  milestone_id   uuid REFERENCES ref_milestones(id) ON DELETE SET NULL,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title          text NOT NULL DEFAULT '',
  description    text,
  assignee_ids   text[],
  due_label      text,
  tag_label      text,
  tag_bg         text DEFAULT '#E6F1FB',
  tag_text_color text DEFAULT '#185FA5',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_reference_id ON ref_deliverables(reference_id);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_milestone_id ON ref_deliverables(milestone_id);
CREATE INDEX IF NOT EXISTS idx_ref_deliverables_project_id ON ref_deliverables(project_id);
ALTER TABLE ref_deliverables ENABLE ROW LEVEL SECURITY;

-- 4-4. ref_links
CREATE TABLE IF NOT EXISTS ref_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  url          text,
  description  text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ref_links_reference_id ON ref_links(reference_id);
ALTER TABLE ref_links ENABLE ROW LEVEL SECURITY;

-- 4-5. ref_policies
CREATE TABLE IF NOT EXISTS ref_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_ref_policies_reference_id ON ref_policies(reference_id);
ALTER TABLE ref_policies ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: tasks 테이블에 deliverable_id 추가
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES ref_deliverables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON tasks(deliverable_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 6: RLS 정책 (6개 테이블 × 4개 = 24개)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── project_references RLS ───
CREATE POLICY "team_select_project_references" ON project_references FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_project_references" ON project_references FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_project_references" ON project_references FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_project_references" ON project_references FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

-- ─── ref_milestones RLS ───
CREATE POLICY "team_select_ref_milestones" ON ref_milestones FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_ref_milestones" ON ref_milestones FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_ref_milestones" ON ref_milestones FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_ref_milestones" ON ref_milestones FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

-- ─── ref_deliverables RLS ───
CREATE POLICY "team_select_ref_deliverables" ON ref_deliverables FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_ref_deliverables" ON ref_deliverables FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_ref_deliverables" ON ref_deliverables FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_ref_deliverables" ON ref_deliverables FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

-- ─── ref_links RLS ───
CREATE POLICY "team_select_ref_links" ON ref_links FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_ref_links" ON ref_links FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_ref_links" ON ref_links FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_ref_links" ON ref_links FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

-- ─── ref_policies RLS ───
CREATE POLICY "team_select_ref_policies" ON ref_policies FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_ref_policies" ON ref_policies FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_ref_policies" ON ref_policies FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_ref_policies" ON ref_policies FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 7: 검증
-- ═══════════════════════════════════════════════════════════════════════════

-- 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('project_references','ref_milestones','ref_deliverables','ref_links','ref_policies');

-- RLS 정책 확인
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'ref_%' OR tablename = 'project_references';

-- tasks.deliverable_id 확인
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'deliverable_id';
