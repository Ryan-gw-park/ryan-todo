-- ============================================================
-- Loop-17: DB 스키마 확장 + RLS + 기존 데이터 마이그레이션
-- Date: 2026-03-12
-- Ref: ryan-todo-team-architecture.md v2.1, loop-17-db-schema-expansion.md
--
-- 원칙:
--   - 기존 테이블명(tasks, memos, projects) 유지
--   - 기존 컬럼명(text, done, category, notes, alarm) 유지
--   - 기존 ID 타입(text) 유지
--   - ALTER TABLE ADD COLUMN만, rename/drop 금지
--   - 프론트엔드 변경 없이 기존 앱 정상 동작
-- ============================================================


-- ============================================================
-- PART 1: 신규 테이블 생성 (FK 의존성 순서)
-- 출처: 아키텍처 v2.1 섹션 8.3
-- ============================================================

-- 1. profiles — auth.users 참조
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id),
  email         text NOT NULL,
  display_name  text NOT NULL,
  avatar_url    text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 2. companies — DB만, UI 미구현
CREATE TABLE IF NOT EXISTS companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  created_by    uuid REFERENCES profiles(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- 3. teams
CREATE TABLE IF NOT EXISTS teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid REFERENCES companies(id),
  name            text NOT NULL,
  description     text,
  invite_code     text UNIQUE,
  auto_approve    boolean DEFAULT true,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 4. team_members
CREATE TABLE IF NOT EXISTS team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id),
  role          text NOT NULL DEFAULT 'member',
  status        text NOT NULL DEFAULT 'pending',
  display_name  text,
  invited_by    uuid REFERENCES profiles(id),
  joined_at     timestamptz,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- 5. team_invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_email   text,
  invited_by      uuid NOT NULL REFERENCES profiles(id),
  status          text NOT NULL DEFAULT 'pending',
  token           text UNIQUE NOT NULL,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(team_id, invited_email)
);

-- 6. comments — task_id는 text (기존 tasks.id가 text)
CREATE TABLE IF NOT EXISTS comments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       text NOT NULL,
  author_id     uuid NOT NULL REFERENCES profiles(id),
  content       text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

-- 7. notifications — task_id는 text
CREATE TABLE IF NOT EXISTS notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  actor_id        uuid NOT NULL REFERENCES profiles(id),
  target_user_id  uuid REFERENCES profiles(id),
  task_id         text,
  event_type      text NOT NULL,
  message         text NOT NULL,
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_notifications_team ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);

-- 8. matrix_row_config
CREATE TABLE IF NOT EXISTS matrix_row_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id),
  team_id         uuid REFERENCES teams(id),
  section         text NOT NULL,
  label           text NOT NULL,
  row_type        text NOT NULL,
  parent_section  text,
  mapped_user_id  uuid REFERENCES profiles(id),
  sort_order      integer DEFAULT 0,
  is_collapsed    boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, team_id, section)
);


-- ============================================================
-- PART 2: 기존 테이블 확장 (ALTER TABLE ADD COLUMN만)
-- 출처: 아키텍처 v2.1 섹션 8.2, Loop-17 섹션 3
-- ============================================================

-- tasks 테이블 확장
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scope text DEFAULT 'private';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS highlight_color text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- tasks: scope 유효성 CHECK (기존 데이터는 모두 scope='private', team_id=NULL, assignee_id=NULL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_scope') THEN
    ALTER TABLE tasks ADD CONSTRAINT valid_scope CHECK (
      (scope = 'private'  AND team_id IS NULL AND assignee_id IS NULL) OR
      (scope = 'team'     AND team_id IS NOT NULL AND assignee_id IS NULL) OR
      (scope = 'assigned' AND team_id IS NOT NULL AND assignee_id IS NOT NULL)
    );
  END IF;
END $$;

-- tasks 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id) WHERE assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks(scope);
CREATE INDEX IF NOT EXISTS idx_tasks_updated ON tasks(updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by) WHERE created_by IS NOT NULL;

-- projects 테이블 확장
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- memos 테이블 확장
ALTER TABLE memos ADD COLUMN IF NOT EXISTS user_id uuid;


-- ============================================================
-- PART 3: RLS 정책
-- 출처: 아키텍처 v2.1 섹션 9.1~9.11
-- ============================================================

-- --- 기존 테이블 RLS 정책 정리 (있으면 DROP) ---

-- tasks: 기존 정책 모두 DROP
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', pol.policyname);
  END LOOP;
END $$;

-- projects: 기존 정책 모두 DROP
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
  END LOOP;
END $$;

-- memos: 기존 정책 모두 DROP
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'memos' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON memos', pol.policyname);
  END LOOP;
END $$;

-- --- 모든 테이블 RLS 활성화 ---
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_row_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

-- ─── 9-1. tasks ───

-- 개인 할일: 본인만 전체 CRUD
CREATE POLICY "private_tasks_owner" ON tasks FOR ALL
  USING (scope = 'private' AND created_by = auth.uid())
  WITH CHECK (scope = 'private' AND created_by = auth.uid());

-- 팀 할일 조회: 같은 팀 소속이면 전체 조회
CREATE POLICY "team_tasks_select" ON tasks FOR SELECT
  USING (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 할일 생성: 팀원 누구나
CREATE POLICY "team_tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 할일 수정: 팀장=전체, 팀원=본인 생성분 또는 본인 배정분
CREATE POLICY "team_tasks_update" ON tasks FOR UPDATE
  USING (
    scope IN ('team', 'assigned')
    AND (
      team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
      )
      OR created_by = auth.uid()
      OR assignee_id = auth.uid()
    )
  );

-- 팀 할일 삭제: 팀장 또는 본인 생성분만
CREATE POLICY "team_tasks_delete" ON tasks FOR DELETE
  USING (
    scope IN ('team', 'assigned')
    AND (
      team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
      )
      OR created_by = auth.uid()
    )
  );

-- ─── 9-2. comments ───

CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE team_id IN (
        SELECT team_id FROM team_members
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "comments_update" ON comments FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "comments_delete" ON comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks t
      JOIN team_members tm ON tm.team_id = t.team_id
      WHERE t.id = comments.task_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'owner'
        AND tm.status = 'active'
    )
  );

-- ─── 9-3. notifications ───

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR target_user_id = auth.uid()
    OR actor_id = auth.uid()
  );

-- ─── 9-4. memos ───

CREATE POLICY "memos_owner_only" ON memos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 9-5. profiles ───

CREATE POLICY "profiles_owner" ON profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_team_select" ON profiles FOR SELECT
  USING (
    id IN (
      SELECT tm2.user_id FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid() AND tm1.status = 'active' AND tm2.status = 'active'
    )
  );

-- ─── 9-6. companies (deny-all: RLS 활성화, 정책 없음) ───
-- 추후 company UI 구현 시 정책 추가

-- ─── 9-7. teams ───

CREATE POLICY "teams_select_member" ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_update_owner" ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

CREATE POLICY "teams_delete_owner" ON teams FOR DELETE
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- ─── 9-8. team_members ───

CREATE POLICY "team_members_select" ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "team_members_insert" ON team_members FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "team_members_update" ON team_members FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "team_members_delete" ON team_members FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR user_id = auth.uid()
  );

-- ─── 9-9. team_invitations ───

CREATE POLICY "team_invitations_select" ON team_invitations FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "team_invitations_insert" ON team_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

CREATE POLICY "team_invitations_update" ON team_invitations FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ─── 9-10. projects ───

-- 개인 프로젝트: 본인만 ALL
CREATE POLICY "projects_private_owner" ON projects FOR ALL
  USING (team_id IS NULL AND user_id = auth.uid())
  WITH CHECK (team_id IS NULL AND user_id = auth.uid());

-- 팀 프로젝트 조회: 같은 팀 소속
CREATE POLICY "projects_team_select" ON projects FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 프로젝트 생성: 팀원 누구나
CREATE POLICY "projects_team_insert" ON projects FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 프로젝트 수정: 팀원 누구나
CREATE POLICY "projects_team_update" ON projects FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 프로젝트 삭제: 팀장만
CREATE POLICY "projects_team_delete" ON projects FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- ─── 9-11. matrix_row_config ───

CREATE POLICY "matrix_row_config_owner" ON matrix_row_config FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================
-- PART 4: 자동 profiles 생성 트리거 (신규 가입 시)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- PART 5: updated_at 자동 갱신 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['profiles', 'companies', 'teams', 'comments', 'matrix_row_config', 'tasks', 'projects']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- PART 6: 기존 데이터 마이그레이션
-- 출처: Loop-17 섹션 5
-- ============================================================

-- 1. 기존 auth.users에서 profiles 레코드 생성
INSERT INTO profiles (id, email, display_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. "Ryan의 팀" 자동 생성
INSERT INTO teams (name, description, created_by, auto_approve)
SELECT 'Ryan의 팀', '기본 팀', id, true
FROM profiles
LIMIT 1;

-- 3. Ryan을 팀장으로 등록
INSERT INTO team_members (team_id, user_id, role, status, display_name, joined_at)
SELECT
  t.id,
  p.id,
  'owner',
  'active',
  'Ryan',
  now()
FROM teams t
CROSS JOIN (SELECT id FROM profiles LIMIT 1) p
WHERE t.name = 'Ryan의 팀'
ON CONFLICT (team_id, user_id) DO NOTHING;

-- 4. 기존 tasks: created_by 채우기
UPDATE tasks SET created_by = (SELECT id FROM profiles LIMIT 1)
WHERE created_by IS NULL;

-- 5. 기존 projects: user_id 채우기 (개인 프로젝트)
UPDATE projects SET user_id = (SELECT id FROM profiles LIMIT 1)
WHERE user_id IS NULL AND team_id IS NULL;

-- 6. 기존 memos: user_id 채우기
UPDATE memos SET user_id = (SELECT id FROM profiles LIMIT 1)
WHERE user_id IS NULL;

-- 7. projects CHECK 제약 추가 (user_id 채운 후)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_ownership') THEN
    ALTER TABLE projects ADD CONSTRAINT project_ownership CHECK (
      (team_id IS NOT NULL AND user_id IS NULL) OR
      (team_id IS NULL AND user_id IS NOT NULL)
    );
  END IF;
END $$;


-- ============================================================
-- DONE: Loop-17 마이그레이션 완료
-- ============================================================
