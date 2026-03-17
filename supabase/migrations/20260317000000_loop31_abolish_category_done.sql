-- Loop-31: category:'done' 폐지 — done 필드가 완료의 유일한 기준
-- category='done'인 행의 category를 이전 값(prev_category)으로 복원

UPDATE tasks
SET category = CASE
  WHEN prev_category IS NOT NULL AND prev_category != '' AND prev_category != 'done'
    THEN prev_category
  ELSE 'backlog'
END,
updated_at = now()
WHERE category = 'done';

-- 확인: category='done'인 행이 0건이어야 함
-- SELECT count(*) FROM tasks WHERE category = 'done';
