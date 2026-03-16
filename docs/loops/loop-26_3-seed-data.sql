-- ═══════════════════════════════════════════════════════════════════════════
-- Loop-26.3 Reference 탭 Seed 데이터
-- Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- STEP 1: 첫 번째 프로젝트 ID 가져오기
-- ───────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_project_id UUID;
  v_reference_id UUID;
  v_milestone_1 UUID;
  v_milestone_2 UUID;
  v_milestone_3 UUID;
BEGIN
  -- 첫 번째 프로젝트 선택
  SELECT id INTO v_project_id FROM projects LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE NOTICE '프로젝트가 없습니다. 먼저 프로젝트를 생성하세요.';
    RETURN;
  END IF;

  RAISE NOTICE '프로젝트 ID: %', v_project_id;

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 2: project_references 생성 (이미 있으면 기존 것 사용)
  -- ───────────────────────────────────────────────────────────────────────────

  SELECT id INTO v_reference_id FROM project_references WHERE project_id = v_project_id;

  IF v_reference_id IS NULL THEN
    INSERT INTO project_references (project_id)
    VALUES (v_project_id)
    RETURNING id INTO v_reference_id;
    RAISE NOTICE 'project_references 생성됨: %', v_reference_id;
  ELSE
    RAISE NOTICE '기존 project_references 사용: %', v_reference_id;
  END IF;

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 3: 마일스톤 생성
  -- ───────────────────────────────────────────────────────────────────────────

  INSERT INTO ref_milestones (reference_id, project_id, title, description, start_date, end_date, color, sort_order)
  VALUES (
    v_reference_id, v_project_id,
    '킥오프 미팅',
    '프로젝트 시작 회의 및 역할 분담',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '7 days',
    '#1D9E75',
    0
  )
  RETURNING id INTO v_milestone_1;

  INSERT INTO ref_milestones (reference_id, project_id, title, description, start_date, end_date, color, sort_order)
  VALUES (
    v_reference_id, v_project_id,
    '1차 개발 완료',
    '핵심 기능 개발 및 내부 테스트',
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '30 days',
    '#5b8fd4',
    1
  )
  RETURNING id INTO v_milestone_2;

  INSERT INTO ref_milestones (reference_id, project_id, title, description, start_date, end_date, color, sort_order)
  VALUES (
    v_reference_id, v_project_id,
    '최종 배포',
    '프로덕션 배포 및 모니터링',
    CURRENT_DATE + INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '45 days',
    '#d48a3f',
    2
  )
  RETURNING id INTO v_milestone_3;

  RAISE NOTICE '마일스톤 3개 생성됨';

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 4: 결과물 생성
  -- ───────────────────────────────────────────────────────────────────────────

  -- 킥오프 마일스톤의 결과물
  INSERT INTO ref_deliverables (reference_id, project_id, milestone_id, title, description, sort_order)
  VALUES
    (v_reference_id, v_project_id, v_milestone_1, '프로젝트 계획서', 'WBS 및 일정표 포함', 0),
    (v_reference_id, v_project_id, v_milestone_1, '역할 분담표', '팀원별 담당 영역 정의', 1);

  -- 1차 개발 마일스톤의 결과물
  INSERT INTO ref_deliverables (reference_id, project_id, milestone_id, title, description, tag_label, tag_bg, tag_text_color, sort_order)
  VALUES
    (v_reference_id, v_project_id, v_milestone_2, 'API 설계 문서', 'REST API 엔드포인트 명세', '진행중', '#d4edda', '#155724', 0),
    (v_reference_id, v_project_id, v_milestone_2, 'DB 스키마', 'ERD 및 테이블 정의서', '완료', '#d4edda', '#155724', 1),
    (v_reference_id, v_project_id, v_milestone_2, '테스트 시나리오', 'QA 테스트 케이스', NULL, NULL, NULL, 2);

  -- 최종 배포 마일스톤의 결과물
  INSERT INTO ref_deliverables (reference_id, project_id, milestone_id, title, description, tag_label, tag_bg, tag_text_color, sort_order)
  VALUES
    (v_reference_id, v_project_id, v_milestone_3, '배포 체크리스트', '프로덕션 배포 전 확인 항목', NULL, NULL, NULL, 0),
    (v_reference_id, v_project_id, v_milestone_3, '운영 매뉴얼', '장애 대응 및 모니터링 가이드', '대기', '#fff3cd', '#856404', 1);

  RAISE NOTICE '결과물 7개 생성됨';

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 5: 참조 문서 생성
  -- ───────────────────────────────────────────────────────────────────────────

  INSERT INTO ref_links (reference_id, project_id, title, url, sort_order)
  VALUES
    (v_reference_id, v_project_id, 'Figma 디자인', 'https://figma.com/example', 0),
    (v_reference_id, v_project_id, 'GitHub 저장소', 'https://github.com/example/repo', 1),
    (v_reference_id, v_project_id, '기술 스펙 문서', 'https://notion.so/tech-spec', 2);

  RAISE NOTICE '참조 문서 3개 생성됨';

  -- ───────────────────────────────────────────────────────────────────────────
  -- STEP 6: 합의된 정책 생성
  -- ───────────────────────────────────────────────────────────────────────────

  INSERT INTO ref_policies (reference_id, project_id, title, description, sort_order)
  VALUES
    (v_reference_id, v_project_id, '코드 리뷰 필수', '모든 PR은 최소 1명의 리뷰어 승인 필요', 0),
    (v_reference_id, v_project_id, '일일 스탠드업', '매일 오전 10시 15분 진행', 1),
    (v_reference_id, v_project_id, '브랜치 전략', 'main → develop → feature/* 구조 사용', 2);

  RAISE NOTICE '합의된 정책 3개 생성됨';

  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'Seed 데이터 생성 완료!';
  RAISE NOTICE '프로젝트: % 에 Reference 데이터가 추가되었습니다.', v_project_id;
  RAISE NOTICE '════════════════════════════════════════';

END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 확인 쿼리
-- ───────────────────────────────────────────────────────────────────────────

SELECT 'project_references' as table_name, COUNT(*) as count FROM project_references
UNION ALL
SELECT 'ref_milestones', COUNT(*) FROM ref_milestones
UNION ALL
SELECT 'ref_deliverables', COUNT(*) FROM ref_deliverables
UNION ALL
SELECT 'ref_links', COUNT(*) FROM ref_links
UNION ALL
SELECT 'ref_policies', COUNT(*) FROM ref_policies;
