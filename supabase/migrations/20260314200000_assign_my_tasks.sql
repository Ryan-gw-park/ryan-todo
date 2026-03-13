-- 오늘할일/다음할일 카테고리에 있는 팀 tasks를 생성자에게 자동 배정
-- scope='team'이지만 category가 today/next인 tasks → scope='assigned', assignee_id=created_by

CREATE OR REPLACE FUNCTION assign_my_category_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE tasks
  SET
    scope = 'assigned',
    assignee_id = created_by,
    updated_at = now()
  WHERE team_id IS NOT NULL
    AND scope = 'team'
    AND assignee_id IS NULL
    AND created_by IS NOT NULL
    AND category IN ('today', 'next');

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
