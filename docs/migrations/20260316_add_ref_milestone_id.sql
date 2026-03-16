-- Loop-26.3 v2: tasks 테이블에 ref_milestone_id 컬럼 추가
-- 마일스톤에 직접 연결된 Task 지원

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS ref_milestone_id uuid REFERENCES ref_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_ref_milestone_id ON tasks(ref_milestone_id);
