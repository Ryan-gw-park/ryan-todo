-- Personal Agenda Matrix — Spec r2 C1
-- 행 = key_milestone, 열 = 4 agenda 매트릭스용 N:M agenda 컬럼
-- A안 (text[] 단일 컬럼) — polling sync + updateTask(id, patch) 호환성

BEGIN;

-- 1. agendas 컬럼 추가 (기존 데이터 보호: DEFAULT '{}')
ALTER TABLE tasks
  ADD COLUMN agendas text[] NOT NULL DEFAULT '{}';

-- 2. 값 범위 제약 (4개 고정 아젠다 enum)
ALTER TABLE tasks
  ADD CONSTRAINT valid_agendas CHECK (
    agendas <@ ARRAY[
      'weekly_jason',
      'weekly_planning',
      'decision_needed',
      'personal'
    ]::text[]
  );

-- 3. GIN 인덱스 (셀 필터 쿼리 대비)
CREATE INDEX IF NOT EXISTS tasks_agendas_gin
  ON tasks USING GIN (agendas);

-- 4. RLS 정책 변경 없음 — agendas는 task 본체 컬럼이므로 기존 정책 자동 적용
-- 5. updated_at 트리거는 이미 적용되어 있음 (polling sync 호환)

COMMIT;
