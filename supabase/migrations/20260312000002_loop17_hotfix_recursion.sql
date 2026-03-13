-- ============================================================
-- Loop-17 Hotfix #2: team_members RLS 무한 재귀 수정
--
-- 문제: team_members의 RLS 정책이 team_members 자신을 SELECT
--       → 무한 재귀 (42P17: infinite recursion)
--       → team_members를 참조하는 모든 테이블 정책도 실패
--
-- 해결: SECURITY DEFINER 함수로 RLS를 우회하여 팀 멤버십 조회
-- ============================================================


-- ============================================================
-- STEP 1: SECURITY DEFINER 헬퍼 함수 생성
-- RLS 우회하여 현재 사용자의 팀 ID 목록 반환
-- ============================================================

-- 내가 active 멤버인 팀 목록
CREATE OR REPLACE FUNCTION public.get_my_team_ids()
RETURNS SETOF uuid AS $$
  SELECT team_id FROM team_members
  WHERE user_id = auth.uid() AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 내가 owner인 팀 목록
CREATE OR REPLACE FUNCTION public.get_my_owner_team_ids()
RETURNS SETOF uuid AS $$
  SELECT team_id FROM team_members
  WHERE user_id = auth.uid() AND role = 'owner' AND status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 같은 팀 소속 유저 ID 목록 (profiles 정책용)
CREATE OR REPLACE FUNCTION public.get_my_team_member_ids()
RETURNS SETOF uuid AS $$
  SELECT DISTINCT tm2.user_id
  FROM team_members tm1
  JOIN team_members tm2 ON tm1.team_id = tm2.team_id
  WHERE tm1.user_id = auth.uid()
    AND tm1.status = 'active'
    AND tm2.status = 'active';
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================
-- STEP 2: team_members 정책 재생성 (자기 참조 제거)
-- ============================================================

DROP POLICY IF EXISTS "team_members_select" ON team_members;
DROP POLICY IF EXISTS "team_members_insert" ON team_members;
DROP POLICY IF EXISTS "team_members_update" ON team_members;
DROP POLICY IF EXISTS "team_members_delete" ON team_members;

-- 같은 팀 소속이면 조회 가능 (헬퍼 함수 사용 → 재귀 없음)
CREATE POLICY "team_members_select" ON team_members FOR SELECT
  USING (team_id IN (SELECT get_my_team_ids()));

-- 팀장만 멤버 추가 가능, 또는 본인이 가입 (초대 수락)
CREATE POLICY "team_members_insert" ON team_members FOR INSERT
  WITH CHECK (
    team_id IN (SELECT get_my_owner_team_ids())
    OR user_id = auth.uid()
  );

-- 팀장만 수정 가능, 또는 본인 레코드
CREATE POLICY "team_members_update" ON team_members FOR UPDATE
  USING (
    team_id IN (SELECT get_my_owner_team_ids())
    OR user_id = auth.uid()
  );

-- 팀장만 삭제 가능, 또는 본인 탈퇴
CREATE POLICY "team_members_delete" ON team_members FOR DELETE
  USING (
    team_id IN (SELECT get_my_owner_team_ids())
    OR user_id = auth.uid()
  );


-- ============================================================
-- STEP 3: tasks 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "private_tasks_owner" ON tasks;
DROP POLICY IF EXISTS "private_tasks_select" ON tasks;
DROP POLICY IF EXISTS "private_tasks_insert" ON tasks;
DROP POLICY IF EXISTS "private_tasks_update" ON tasks;
DROP POLICY IF EXISTS "private_tasks_delete" ON tasks;
DROP POLICY IF EXISTS "team_tasks_select" ON tasks;
DROP POLICY IF EXISTS "team_tasks_insert" ON tasks;
DROP POLICY IF EXISTS "team_tasks_update" ON tasks;
DROP POLICY IF EXISTS "team_tasks_delete" ON tasks;

-- 개인 할일
CREATE POLICY "private_tasks_select" ON tasks FOR SELECT
  USING (scope = 'private' AND created_by = auth.uid());

CREATE POLICY "private_tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    scope = 'private'
    AND (created_by = auth.uid() OR created_by IS NULL)
  );

CREATE POLICY "private_tasks_update" ON tasks FOR UPDATE
  USING (scope = 'private' AND created_by = auth.uid());

CREATE POLICY "private_tasks_delete" ON tasks FOR DELETE
  USING (scope = 'private' AND created_by = auth.uid());

-- 팀 할일
CREATE POLICY "team_tasks_select" ON tasks FOR SELECT
  USING (
    scope IN ('team', 'assigned')
    AND team_id IN (SELECT get_my_team_ids())
  );

CREATE POLICY "team_tasks_insert" ON tasks FOR INSERT
  WITH CHECK (
    scope IN ('team', 'assigned')
    AND team_id IN (SELECT get_my_team_ids())
  );

CREATE POLICY "team_tasks_update" ON tasks FOR UPDATE
  USING (
    scope IN ('team', 'assigned')
    AND (
      team_id IN (SELECT get_my_owner_team_ids())
      OR created_by = auth.uid()
      OR assignee_id = auth.uid()
    )
  );

CREATE POLICY "team_tasks_delete" ON tasks FOR DELETE
  USING (
    scope IN ('team', 'assigned')
    AND (
      team_id IN (SELECT get_my_owner_team_ids())
      OR created_by = auth.uid()
    )
  );


-- ============================================================
-- STEP 4: projects 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "projects_private_owner" ON projects;
DROP POLICY IF EXISTS "projects_private_select" ON projects;
DROP POLICY IF EXISTS "projects_private_insert" ON projects;
DROP POLICY IF EXISTS "projects_private_update" ON projects;
DROP POLICY IF EXISTS "projects_private_delete" ON projects;
DROP POLICY IF EXISTS "projects_team_select" ON projects;
DROP POLICY IF EXISTS "projects_team_insert" ON projects;
DROP POLICY IF EXISTS "projects_team_update" ON projects;
DROP POLICY IF EXISTS "projects_team_delete" ON projects;

-- 개인 프로젝트
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
  USING (team_id IN (SELECT get_my_team_ids()));

CREATE POLICY "projects_team_insert" ON projects FOR INSERT
  WITH CHECK (team_id IN (SELECT get_my_team_ids()));

CREATE POLICY "projects_team_update" ON projects FOR UPDATE
  USING (team_id IN (SELECT get_my_team_ids()));

CREATE POLICY "projects_team_delete" ON projects FOR DELETE
  USING (team_id IN (SELECT get_my_owner_team_ids()));


-- ============================================================
-- STEP 5: memos 정책 재생성
-- ============================================================

DROP POLICY IF EXISTS "memos_owner_only" ON memos;
DROP POLICY IF EXISTS "memos_select" ON memos;
DROP POLICY IF EXISTS "memos_insert" ON memos;
DROP POLICY IF EXISTS "memos_update" ON memos;
DROP POLICY IF EXISTS "memos_delete" ON memos;

CREATE POLICY "memos_select" ON memos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "memos_insert" ON memos FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "memos_update" ON memos FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "memos_delete" ON memos FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- STEP 6: teams 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "teams_select_member" ON teams;
DROP POLICY IF EXISTS "teams_insert" ON teams;
DROP POLICY IF EXISTS "teams_update_owner" ON teams;
DROP POLICY IF EXISTS "teams_delete_owner" ON teams;

CREATE POLICY "teams_select_member" ON teams FOR SELECT
  USING (id IN (SELECT get_my_team_ids()));

CREATE POLICY "teams_insert" ON teams FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "teams_update_owner" ON teams FOR UPDATE
  USING (id IN (SELECT get_my_owner_team_ids()));

CREATE POLICY "teams_delete_owner" ON teams FOR DELETE
  USING (id IN (SELECT get_my_owner_team_ids()));


-- ============================================================
-- STEP 7: comments 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;

CREATE POLICY "comments_select" ON comments FOR SELECT
  USING (
    task_id IN (
      SELECT id FROM tasks WHERE team_id IN (SELECT get_my_team_ids())
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
      WHERE t.id = comments.task_id
        AND t.team_id IN (SELECT get_my_owner_team_ids())
    )
  );


-- ============================================================
-- STEP 8: notifications 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "notifications_select" ON notifications;

CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (
    team_id IN (SELECT get_my_owner_team_ids())
    OR target_user_id = auth.uid()
    OR actor_id = auth.uid()
  );


-- ============================================================
-- STEP 9: profiles 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "profiles_owner" ON profiles;
DROP POLICY IF EXISTS "profiles_team_select" ON profiles;

CREATE POLICY "profiles_owner" ON profiles FOR ALL
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_team_select" ON profiles FOR SELECT
  USING (id IN (SELECT get_my_team_member_ids()));


-- ============================================================
-- STEP 10: team_invitations 정책 재생성 (헬퍼 함수 사용)
-- ============================================================

DROP POLICY IF EXISTS "team_invitations_select" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert" ON team_invitations;
DROP POLICY IF EXISTS "team_invitations_update" ON team_invitations;

CREATE POLICY "team_invitations_select" ON team_invitations FOR SELECT
  USING (
    team_id IN (SELECT get_my_owner_team_ids())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "team_invitations_insert" ON team_invitations FOR INSERT
  WITH CHECK (
    invited_by = auth.uid()
    AND team_id IN (SELECT get_my_owner_team_ids())
  );

CREATE POLICY "team_invitations_update" ON team_invitations FOR UPDATE
  USING (
    team_id IN (SELECT get_my_owner_team_ids())
    OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );


-- ============================================================
-- DONE: 무한 재귀 수정 완료
-- 모든 team_members 직접 참조를 SECURITY DEFINER 함수로 교체
-- ============================================================
