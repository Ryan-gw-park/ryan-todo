-- Weekly Schedule 뷰 — scheduled_date 칼럼 추가
-- tasks와 key_milestones 양쪽에 추가. nullable로 기본값 NULL (= 백로그 풀)
-- 타임라인의 start_date/end_date와 완전 독립한 "이번주 배치 날짜" 필드.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;
ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS scheduled_date date DEFAULT NULL;

-- 기존 RLS 정책은 '*' select 허용이므로 별도 정책 변경 불필요.
-- 기존 start_date / end_date / due_date 칼럼은 절대 변경 없음.
-- 기존 valid_scope CHECK constraint 영향 없음 (scheduled_date는 scope 판정에 미포함).
