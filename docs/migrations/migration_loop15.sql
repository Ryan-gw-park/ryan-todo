-- Loop-15.1: tasks 테이블에 alarm JSONB 컬럼 추가
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS alarm JSONB DEFAULT NULL;

-- 인덱스: alarm이 있는 task만 빠르게 조회 (알람 체크 엔진용)
CREATE INDEX IF NOT EXISTS idx_tasks_alarm ON tasks ((alarm IS NOT NULL)) WHERE alarm IS NOT NULL;
