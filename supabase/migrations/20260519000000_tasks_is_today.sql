-- 'Today' 마커: 매트릭스 카드 시각 강조용 boolean (hotfix r11)
-- is_focus / category='today' 와 의미 분리 — 사용자의 "오늘 시각 강조" 마커
BEGIN;

ALTER TABLE tasks
  ADD COLUMN is_today boolean NOT NULL DEFAULT false;

-- 부분 인덱스 (is_today=true row만 — today 필터 쿼리 대비)
CREATE INDEX IF NOT EXISTS tasks_is_today_idx
  ON tasks(is_today) WHERE is_today = true;

-- RLS 정책 변경 없음 (tasks 본체 컬럼이라 기존 정책 자동 적용)
-- updated_at 트리거 그대로 — polling delta sync 호환

COMMIT;
