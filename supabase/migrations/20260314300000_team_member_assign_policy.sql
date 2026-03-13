-- ═══ 팀원 배정 권한: 같은 팀 소속이면 팀/배정 할일의 assignee_id 변경 가능 ═══
--
-- 배경: 팀원도 다른 팀원에게 할일을 배정할 수 있어야 함 (권한 매트릭스 변경)
-- 이 정책은 기존 team_tasks_update와 OR 관계로 동작 (permissive)
--
-- 프론트엔드에서 readOnly로 제목/노트/삭제 등은 팀원에게 차단하되,
-- DB 레벨에서는 같은 팀 소속이면 UPDATE를 허용.
-- (Supabase RLS는 컬럼별 UPDATE 제한 불가 — 프론트 권한 체크에 의존)

CREATE POLICY "team_tasks_member_assign" ON tasks FOR UPDATE
  USING (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    scope IN ('team', 'assigned')
    AND team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
