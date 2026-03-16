-- Loop-26 테스트 데이터: "개별과제" 프로젝트용
-- Supabase SQL Editor에서 각 STEP을 순서대로 실행

-- ============================================
-- STEP 1: 프로젝트 확인 (먼저 실행)
-- ============================================
SELECT id, user_id, name FROM projects WHERE name LIKE '%개별%';
-- 결과가 없으면 앱에서 "개별과제" 프로젝트 먼저 생성

-- ============================================
-- STEP 2: project_key_milestones 생성
-- ============================================
INSERT INTO project_key_milestones (id, project_id, created_at)
SELECT gen_random_uuid(), id, now()
FROM projects
WHERE name LIKE '%개별%'
  AND NOT EXISTS (
    SELECT 1 FROM project_key_milestones pkm WHERE pkm.project_id = projects.id
  );

-- ============================================
-- STEP 3: 마일스톤 4개 생성
-- ============================================
INSERT INTO key_milestones (id, pkm_id, project_id, title, description, start_date, end_date, color, sort_order, created_at)
SELECT gen_random_uuid(), pkm.id, p.id, m.title, m.description, m.start_date::date, m.end_date::date, m.color, m.sort_order, now()
FROM project_key_milestones pkm
JOIN projects p ON pkm.project_id = p.id
CROSS JOIN (VALUES
  ('주제 선정 및 기획', '연구 주제 확정 및 프로젝트 범위 정의', '2026-03-10', '2026-03-20', '#1D9E75', 0),
  ('자료 조사 및 분석', '관련 문헌 및 자료 수집, 분석 수행', '2026-03-21', '2026-04-05', '#378ADD', 1),
  ('초안 작성', '보고서 초안 작성 및 내부 검토', '2026-04-06', '2026-04-20', '#BA7517', 2),
  ('최종 제출', '최종 수정 및 제출', '2026-04-21', '2026-04-30', '#9B59B6', 3)
) AS m(title, description, start_date, end_date, color, sort_order)
WHERE p.name LIKE '%개별%'
  AND NOT EXISTS (SELECT 1 FROM key_milestones km WHERE km.pkm_id = pkm.id AND km.title = m.title);

-- 생성된 마일스톤 확인
SELECT km.id, km.title, km.sort_order
FROM key_milestones km
JOIN project_key_milestones pkm ON km.pkm_id = pkm.id
JOIN projects p ON pkm.project_id = p.id
WHERE p.name LIKE '%개별%'
ORDER BY km.sort_order;

-- ============================================
-- STEP 4: 결과물 생성
-- ============================================
INSERT INTO key_deliverables (id, pkm_id, project_id, milestone_id, title, tag_label, tag_bg, tag_text_color, sort_order, created_at)
SELECT gen_random_uuid(), km.pkm_id, p.id, km.id, d.title, d.tag_label, d.tag_bg, d.tag_text_color, d.sort_order, now()
FROM key_milestones km
JOIN project_key_milestones pkm ON km.pkm_id = pkm.id
JOIN projects p ON pkm.project_id = p.id
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    -- 주제 선정 및 기획
    (0, '주제 제안서', '완료', '#EAF3DE', '#3B6D11', 0),
    (0, '프로젝트 계획서', '진행중', '#FAEEDA', '#854F0B', 1),
    -- 자료 조사 및 분석
    (1, '문헌 조사 보고서', NULL, NULL, NULL, 0),
    (1, '데이터 분석 결과', NULL, NULL, NULL, 1),
    (1, '인터뷰 정리본', NULL, NULL, NULL, 2),
    -- 초안 작성
    (2, '보고서 초안 v1', NULL, NULL, NULL, 0),
    (2, '발표 자료 초안', NULL, NULL, NULL, 1),
    -- 최종 제출
    (3, '최종 보고서', NULL, NULL, NULL, 0),
    (3, '발표 PPT', NULL, NULL, NULL, 1)
  ) AS v(ms_order, title, tag_label, tag_bg, tag_text_color, sort_order)
  WHERE v.ms_order = km.sort_order
) d
WHERE p.name LIKE '%개별%'
  AND NOT EXISTS (SELECT 1 FROM key_deliverables kd WHERE kd.milestone_id = km.id AND kd.title = d.title);

-- ============================================
-- STEP 5: Task 생성
-- 컬럼: id, text, project_id, category, key_milestone_id, sort_order (tasks에 user_id 없음!)
-- ============================================
INSERT INTO tasks (id, text, project_id, category, key_milestone_id, sort_order, created_at)
SELECT gen_random_uuid(), t.text, p.id, t.category, km.id, t.sort_order, now()
FROM projects p
JOIN project_key_milestones pkm ON pkm.project_id = p.id
JOIN key_milestones km ON km.pkm_id = pkm.id
CROSS JOIN (VALUES
  -- MS1: 주제 선정 및 기획 (sort_order=0)
  (0, '관심 분야 브레인스토밍', 'today', 0),
  (0, '교수님 면담 일정 잡기', 'today', 1),
  (0, '주제 3개 후보 정리', 'today', 2),
  (0, '최종 주제 확정 및 계획서 작성', 'upcoming', 3),
  -- MS2: 자료 조사 및 분석 (sort_order=1)
  (1, '학술 DB 검색 (RISS, Google Scholar)', 'upcoming', 0),
  (1, '핵심 논문 10편 정독', 'upcoming', 1),
  (1, '현장 인터뷰 섭외', 'upcoming', 2),
  (1, '인터뷰 질문지 작성', 'upcoming', 3),
  (1, '데이터 수집 및 정리', 'upcoming', 4),
  -- MS3: 초안 작성 (sort_order=2)
  (2, '서론 작성', 'upcoming', 0),
  (2, '본론 1장 작성', 'upcoming', 1),
  (2, '본론 2장 작성', 'upcoming', 2),
  (2, '결론 및 참고문헌 정리', 'upcoming', 3),
  (2, '동료 피드백 받기', 'upcoming', 4),
  -- MS4: 최종 제출 (sort_order=3)
  (3, '교수님 피드백 반영', 'upcoming', 0),
  (3, '맞춤법 및 형식 검토', 'upcoming', 1),
  (3, '최종 PDF 변환', 'upcoming', 2),
  (3, '제출 완료', 'upcoming', 3)
) AS t(ms_order, text, category, sort_order)
WHERE p.name LIKE '%개별%'
  AND km.sort_order = t.ms_order
  AND NOT EXISTS (SELECT 1 FROM tasks tk WHERE tk.project_id = p.id AND tk.text = t.text);

-- 미연결 Task 추가
INSERT INTO tasks (id, text, project_id, category, key_milestone_id, sort_order, created_at)
SELECT gen_random_uuid(), t.text, p.id, t.category, NULL, t.sort_order, now()
FROM projects p
CROSS JOIN (VALUES
  ('노트북 백업하기', 'today', 100),
  ('참고 도서 도서관에서 대출', 'today', 101)
) AS t(text, category, sort_order)
WHERE p.name LIKE '%개별%'
  AND NOT EXISTS (SELECT 1 FROM tasks tk WHERE tk.project_id = p.id AND tk.text = t.text);

-- ============================================
-- STEP 6: 참조 문서 & 정책 생성
-- ============================================
INSERT INTO key_links (id, pkm_id, project_id, title, url, description, sort_order, created_at)
SELECT gen_random_uuid(), pkm.id, p.id, l.title, l.url, l.description, l.sort_order, now()
FROM project_key_milestones pkm
JOIN projects p ON pkm.project_id = p.id
CROSS JOIN (VALUES
  ('학과 논문 작성 가이드', 'https://example.com/guide', '형식 및 분량 참고', 0),
  ('참고 논문 모음 (Notion)', 'https://notion.so/papers', '핵심 논문 링크 정리', 1),
  ('교수님 피드백 문서', 'https://docs.google.com/feedback', '면담 후 정리', 2)
) AS l(title, url, description, sort_order)
WHERE p.name LIKE '%개별%'
  AND NOT EXISTS (SELECT 1 FROM key_links kl WHERE kl.pkm_id = pkm.id AND kl.title = l.title);

INSERT INTO key_policies (id, pkm_id, project_id, title, description, tag_label, tag_type, sort_order, created_at)
SELECT gen_random_uuid(), pkm.id, p.id, pol.title, pol.description, pol.tag_label, pol.tag_type, pol.sort_order, now()
FROM project_key_milestones pkm
JOIN projects p ON pkm.project_id = p.id
CROSS JOIN (VALUES
  ('제출 기한: 4월 30일 23:59', '연장 불가', '필수', 'external', 0),
  ('분량: A4 15페이지 이상', '참고문헌 제외', '형식', 'internal', 1),
  ('인용 형식: APA 7th', NULL, '형식', 'internal', 2)
) AS pol(title, description, tag_label, tag_type, sort_order)
WHERE p.name LIKE '%개별%'
  AND NOT EXISTS (SELECT 1 FROM key_policies kp WHERE kp.pkm_id = pkm.id AND kp.title = pol.title);

-- ============================================
-- STEP 7: 결과 확인
-- ============================================
SELECT 'milestones' as type, count(*) as cnt FROM key_milestones km
  JOIN project_key_milestones pkm ON km.pkm_id = pkm.id
  JOIN projects p ON pkm.project_id = p.id WHERE p.name LIKE '%개별%'
UNION ALL
SELECT 'deliverables', count(*) FROM key_deliverables kd
  JOIN project_key_milestones pkm ON kd.pkm_id = pkm.id
  JOIN projects p ON pkm.project_id = p.id WHERE p.name LIKE '%개별%'
UNION ALL
SELECT 'tasks', count(*) FROM tasks t
  JOIN projects p ON t.project_id = p.id WHERE p.name LIKE '%개별%'
UNION ALL
SELECT 'links', count(*) FROM key_links kl
  JOIN project_key_milestones pkm ON kl.pkm_id = pkm.id
  JOIN projects p ON pkm.project_id = p.id WHERE p.name LIKE '%개별%'
UNION ALL
SELECT 'policies', count(*) FROM key_policies kp
  JOIN project_key_milestones pkm ON kp.pkm_id = pkm.id
  JOIN projects p ON pkm.project_id = p.id WHERE p.name LIKE '%개별%';
