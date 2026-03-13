-- ============================================================
-- Loop-17 Hotfix: 기존 앱 하위호환 수정
--
-- 문제: RLS 정책이 기존 프론트엔드를 차단
--   1. 기존 프론트엔드는 scope, created_by, user_id를 보내지 않음
--   2. INSERT 시 created_by=NULL → RLS WITH CHECK 실패
--   3. SELECT 시 created_by가 올바르지 않으면 조회 차단
--
-- 해결: 트리거로 자동 채움 + 데이터 재검증
-- ============================================================


-- ============================================================
-- STEP 1: 진단 — 데이터 상태 확인 (결과 확인 후 삭제 가능)
-- ============================================================
-- 아래 쿼리들을 SQL Editor에서 개별 실행하여 확인:
--
-- SELECT id, scope, created_by FROM tasks LIMIT 5;
-- SELECT id, user_id, team_id FROM projects LIMIT 5;
-- SELECT id, user_id FROM memos LIMIT 5;
-- SELECT id, email FROM profiles;
-- SELECT id, email FROM auth.users;


-- ============================================================
-- STEP 2: 데이터 재검증 + 보정
-- ============================================================

-- profiles가 비어있으면 다시 생성
INSERT INTO profiles (id, email, display_name)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- tasks.created_by 재보정
UPDATE tasks SET created_by = (SELECT id FROM auth.users LIMIT 1)
WHERE created_by IS NULL;

-- tasks.scope 재보정 (NULL이면 private으로)
UPDATE tasks SET scope = 'private'
WHERE scope IS NULL;

-- projects.user_id 재보정
UPDATE projects SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL AND team_id IS NULL;

-- memos.user_id 재보정
UPDATE memos SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;


-- ============================================================
-- STEP 3: 트리거 — INSERT 시 자동으로 필수 필드 채움
-- 기존 프론트엔드가 scope, created_by, user_id를 보내지 않아도 동작
-- ============================================================

-- tasks: created_by, scope 자동 채움
CREATE OR REPLACE FUNCTION public.tasks_auto_fill()
RETURNS TRIGGER AS $$
BEGIN
  -- created_by가 없으면 현재 사용자로 설정
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  -- scope가 없으면 private으로 설정
  IF NEW.scope IS NULL THEN
    NEW.scope := 'private';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tasks_auto_fill_trigger ON tasks;
CREATE TRIGGER tasks_auto_fill_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_auto_fill();

-- projects: user_id 자동 채움 (팀 프로젝트가 아닌 경우)
CREATE OR REPLACE FUNCTION public.projects_auto_fill()
RETURNS TRIGGER AS $$
BEGIN
  -- team_id가 없고 user_id도 없으면 현재 사용자로 설정
  IF NEW.team_id IS NULL AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS projects_auto_fill_trigger ON projects;
CREATE TRIGGER projects_auto_fill_trigger
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_auto_fill();

-- memos: user_id 자동 채움
CREATE OR REPLACE FUNCTION public.memos_auto_fill()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS memos_auto_fill_trigger ON memos;
CREATE TRIGGER memos_auto_fill_trigger
  BEFORE INSERT ON memos
  FOR EACH ROW EXECUTE FUNCTION public.memos_auto_fill();


-- ============================================================
-- STEP 4: RLS 정책 수정 — 기존 앱 하위호환
-- ============================================================

-- tasks: 기존 정책 DROP 후 재생성
DROP POLICY IF EXISTS "private_tasks_owner" ON tasks;
DROP POLICY IF EXISTS "team_tasks_select" ON tasks;
DROP POLICY IF EXISTS "team_tasks_insert" ON tasks;
DROP POLICY IF EXISTS "team_tasks_update" ON tasks;
DROP POLICY IF EXISTS "team_tasks_delete" ON tasks;

-- 개인 할일: SELECT/UPDATE/DELETE — created_by 일치
CREATE POLICY "private_tasks_select" ON tasks FOR SELECT
  USING (scope = 'private' AND created_by = auth.uid());

-- 개인 할일: INSERT — 트리거가 created_by를 채우므로 WITH CHECK에서 확인
CREATE POLICY "private_tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    scope = 'private'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

-- 개인 할일: UPDATE
CREATE POLICY "private_tasks_update" ON tasks FOR UPDATE
  USING (scope = 'private' AND created_by = auth.uid());

-- 개인 할일: DELETE
CREATE POLICY "private_tasks_delete" ON tasks FOR DELETE
  USING (scope = 'private' AND created_by = auth.uid());

-- 팀 할일 조회
CREATE POLICY "team_tasks_select" ON tasks FOR SELECT
  USING (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 할일 생성
CREATE POLICY "team_tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 팀 할일 수정
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

-- 팀 할일 삭제
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

-- projects: 기존 정책 DROP 후 재생성
DROP POLICY IF EXISTS "projects_private_owner" ON projects;
DROP POLICY IF EXISTS "projects_team_select" ON projects;
DROP POLICY IF EXISTS "projects_team_insert" ON projects;
DROP POLICY IF EXISTS "projects_team_update" ON projects;
DROP POLICY IF EXISTS "projects_team_delete" ON projects;

-- 개인 프로젝트: SELECT/UPDATE/DELETE
CREATE POLICY "projects_private_select" ON projects FOR SELECT
  USING (team_id IS NULL AND user_id = auth.uid());

CREATE POLICY "projects_private_insert" ON projects FOR INSERT
  WITH CHECK (
    team_id IS NULL
    AND (user_id = auth.uid() OR user_id IS NULL)
  );

CREATE POLICY "projects_private_update" ON projects FOR UPDATE
  USING (team_id IS NULL AND user_id = auth.uid());

CREATE POLICY "projects_private_delete" ON projects FOR DELETE
  USING (team_id IS NULL AND user_id = auth.uid());

-- 팀 프로젝트
CREATE POLICY "projects_team_select" ON projects FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "projects_team_insert" ON projects FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "projects_team_update" ON projects FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "projects_team_delete" ON projects FOR DELETE
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active'
    )
  );

-- memos: 기존 정책 DROP 후 재생성
DROP POLICY IF EXISTS "memos_owner_only" ON memos;

CREATE POLICY "memos_select" ON memos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "memos_insert" ON memos FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "memos_update" ON memos FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "memos_delete" ON memos FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- DONE: Hotfix 완료
-- 기존 프론트엔드가 scope/created_by/user_id 없이 INSERT해도
-- 트리거가 자동으로 채워주므로 RLS 통과
-- ============================================================
