-- Loop 41-1: MS parent_id 평탄화
-- 기존 L2+ MS를 L1으로 승격. parent_id 컬럼 유지, 값만 NULL.
--
-- Rollback: 실행 전 자동 생성된 backup 테이블 (key_milestones_backup_loop41)에서 복원
-- 또는 Supabase Dashboard CSV export 복원
--
-- 사전 검증: SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL;
-- 사후 검증: 위 쿼리 결과 = 0

BEGIN;

-- 0. Inline backup (in-DB archive)
-- 같은 DB 내에 스냅샷 유지 → Supabase CSV export 백업과 병행
DROP TABLE IF EXISTS key_milestones_backup_loop41;
CREATE TABLE key_milestones_backup_loop41 AS
SELECT *, NOW() AS backed_up_at FROM key_milestones;

-- 영향 규모 로깅
DO $$
DECLARE
  cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM key_milestones WHERE parent_id IS NOT NULL;
  RAISE NOTICE '[Loop41-1] parent_id NOT NULL 레코드 수: %', cnt;
END $$;

-- 평탄화 (parent_id + depth 동시 리셋)
UPDATE key_milestones
SET parent_id = NULL,
    depth = 0,
    updated_at = NOW()
WHERE parent_id IS NOT NULL;

COMMIT;
