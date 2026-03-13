-- 일회성 데이터 마이그레이션: 팀 프로젝트에 소속된 private tasks → team tasks로 전환
-- 팀 프로젝트에 할당되었지만 scope가 여전히 'private'이고 team_id가 NULL인 tasks를 수정

-- RPC 함수로 생성 (anon key로 호출 가능하도록 SECURITY DEFINER)
CREATE OR REPLACE FUNCTION migrate_team_task_scope()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE tasks t
  SET
    scope = 'team',
    team_id = p.team_id,
    updated_at = now()
  FROM projects p
  WHERE t.project_id = p.id
    AND p.team_id IS NOT NULL
    AND t.scope = 'private'
    AND t.team_id IS NULL;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
