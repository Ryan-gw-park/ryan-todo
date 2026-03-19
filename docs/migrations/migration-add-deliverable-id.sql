-- ============================================================
-- Migration: tasks.deliverable_id 추가
-- 실행 환경: Supabase SQL Editor
-- 전제: key_deliverables 테이블이 이미 존재
-- ============================================================

-- 1. 컬럼 추가
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS deliverable_id uuid
REFERENCES key_deliverables(id) ON DELETE SET NULL;

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id
ON tasks(deliverable_id);

-- 3. 확인 쿼리 — 실행 후 deliverable_id 행이 보이면 성공
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'tasks'
AND column_name = 'deliverable_id';
