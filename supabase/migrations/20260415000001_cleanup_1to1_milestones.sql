-- Loop 41-2: 1:1 MS+task 자동 정리
-- 무조건 모두 정리 (spec R25: 보존 조건 없음)
--
-- Rollback: tasks_backup_loop41 + key_milestones_backup_loop41 테이블에서 복원
-- (이 마이그레이션은 20260415000000 이후 실행되므로 key_milestones backup은 이미 존재)
--
-- 사전 검증 쿼리:
--   SELECT count(*) FROM (
--     SELECT key_milestone_id FROM tasks
--     WHERE key_milestone_id IS NOT NULL AND deleted_at IS NULL
--     GROUP BY key_milestone_id HAVING count(*) = 1
--   ) sub;
-- 사후 검증: 위 쿼리 결과 = 0

BEGIN;

-- 0. tasks 테이블 backup (key_milestones는 20260415000000에서 이미 backup됨)
DROP TABLE IF EXISTS tasks_backup_loop41;
CREATE TABLE tasks_backup_loop41 AS
SELECT *, NOW() AS backed_up_at FROM tasks;

-- 1. 1:1 MS ID 임시 저장
CREATE TEMP TABLE _1to1_ms_ids ON COMMIT DROP AS
SELECT key_milestone_id AS ms_id
FROM tasks
WHERE key_milestone_id IS NOT NULL
  AND deleted_at IS NULL
GROUP BY key_milestone_id
HAVING COUNT(*) = 1;

-- 로깅
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM _1to1_ms_ids;
  RAISE NOTICE '[Loop41-2] 1:1 정리 대상 MS 수: %', cnt;
END $$;

-- 2. 해당 task의 keyMilestoneId 해제
UPDATE tasks
SET key_milestone_id = NULL,
    updated_at = NOW()
WHERE key_milestone_id IN (SELECT ms_id FROM _1to1_ms_ids);

-- 3. 해당 MS 삭제
DELETE FROM key_milestones
WHERE id IN (SELECT ms_id FROM _1to1_ms_ids);

COMMIT;
