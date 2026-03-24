// 브라우저 콘솔에서 실행 (앱에 로그인된 상태에서)
// 1. 앱 열기 (https://ryan-todo-master.vercel.app)
// 2. 개발자 도구 → 콘솔 탭
// 3. 이 코드 전체를 복사하여 붙여넣기 → Enter

(async function() {
  // Zustand store 접근
  const store = window.__ZUSTAND_STORE__ || (() => {
    // React DevTools 없이 store 접근하기 위해 import 시도
    console.log('Store에 직접 접근을 시도합니다...')
    return null
  })()

  // Supabase 클라이언트 가져오기 (앱에서 이미 초기화된 것)
  const getDb = () => {
    // localStorage에서 Supabase 설정 가져오기
    const url = localStorage.getItem('supabase_url') || 'https://gnqbjxuuzvppupispvpf.supabase.co'
    const key = localStorage.getItem('supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImducWJqeHV1enZwcHVwaXNwdnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjM3MjAsImV4cCI6MjA4ODU5OTcyMH0.2bh71qyJLWf9kqqr9xHYY4HcfKk79FxoM48rG5GvbdM'
    return window.supabase?.createClient?.(url, key) || null
  }

  // 간트차트에서 추출한 마일스톤 데이터
  const MILESTONES = [
    { sort_order: 2,  title: '주주분류 + 1% 이상 개별 연락',           start_date: '2026-03-09', end_date: '2026-03-13' },
    { sort_order: 3,  title: '공동행사약정서 (w/ Brandon)',            start_date: '2026-03-09', end_date: '2026-03-13' },
    { sort_order: 4,  title: '소집통지 (1% 이상, 이메일)',             start_date: '2026-03-11', end_date: '2026-03-15' },
    { sort_order: 5,  title: '소집 공고',                              start_date: '2026-03-09', end_date: '2026-03-12' },
    { sort_order: 6,  title: '위임장 발송 + 등기 서류 취함',           start_date: '2026-03-13', end_date: '2026-03-17' },
    { sort_order: 7,  title: '등기 필요 서류 준비 + 취합 (각자)',      start_date: '2026-03-13', end_date: '2026-03-17' },
    { sort_order: 8,  title: '등기',                                   start_date: '2026-03-28', end_date: '2026-03-31' },
    { sort_order: 9,  title: '안건자료 PPT',                           start_date: '2026-03-14', end_date: '2026-03-18' },
    { sort_order: 10, title: '의사록+첨부서류',                        start_date: '2026-03-14', end_date: '2026-03-18' },
    { sort_order: 11, title: '운영 매뉴얼 (스크립트, 배치도 등)',      start_date: '2026-03-17', end_date: '2026-03-21' },
    { sort_order: 12, title: '현장 투표 Dashboard 제작',               start_date: '2026-03-17', end_date: '2026-03-21' },
    { sort_order: 13, title: '현장 준비물 제작 + 식권',                start_date: '2026-03-17', end_date: '2026-03-25' },
    { sort_order: 14, title: '정기주총 개최',                          start_date: '2026-03-28', end_date: '2026-03-29' },
    { sort_order: 15, title: '정기 주총 결과 공시',                    start_date: '2026-03-29', end_date: '2026-03-30' },
    { sort_order: 16, title: '사업보고서 공시',                        start_date: '2026-03-22', end_date: '2026-03-26' },
    { sort_order: 17, title: '감사보고서 공시',                        start_date: '2026-03-22', end_date: '2026-03-26' },
    { sort_order: 18, title: '영업보고서 공시 (사업보고서 첨부)',       start_date: '2026-03-22', end_date: '2026-03-27' },
    { sort_order: 19, title: '정기주총 개최 (본회의)',                  start_date: '2026-04-02', end_date: '2026-04-03' },
  ]

  // Supabase 클라이언트 (앱에서 이미 초기화된 싱글톤 사용)
  // supabase.js의 getDb()와 동일한 인스턴스를 찾아야 함
  let db = null

  // 방법 1: 전역에서 supabase 클라이언트 찾기
  if (window._supabaseClient) {
    db = window._supabaseClient
  }

  if (!db) {
    // 방법 2: import map에서 가져오기 시도 — 앱 번들에서 직접 사용
    console.error('⚠️ Supabase 클라이언트를 찾을 수 없습니다.')
    console.log('아래 방법으로 실행해주세요:')
    console.log('')
    console.log('1. 앱 소스(src/utils/supabase.js)에서 window._supabaseClient = db 추가')
    console.log('2. 또는 아래 SQL을 Supabase Dashboard에서 직접 실행')
    console.log('')

    // SQL 출력 (Supabase Dashboard SQL Editor에서 직접 실행 가능)
    console.log('=== SQL (Supabase Dashboard → SQL Editor에 붙여넣기) ===')
    console.log('')

    const sql = `-- 정기주총 프로젝트의 project_key_milestones id 조회
-- (이미 존재하면 그 id 사용, 없으면 먼저 생성)
DO $$
DECLARE
  v_project_id text;
  v_pkm_id uuid;
BEGIN
  -- 프로젝트 ID 조회
  SELECT id INTO v_project_id FROM projects WHERE name ILIKE '%정기주총%' LIMIT 1;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION '정기주총 프로젝트를 찾을 수 없습니다';
  END IF;

  -- PKM 조회 또는 생성
  SELECT id INTO v_pkm_id FROM project_key_milestones WHERE project_id = v_project_id LIMIT 1;
  IF v_pkm_id IS NULL THEN
    INSERT INTO project_key_milestones (project_id) VALUES (v_project_id) RETURNING id INTO v_pkm_id;
  END IF;

  -- 마일스톤 삽입
  INSERT INTO key_milestones (pkm_id, project_id, title, start_date, end_date, sort_order, color) VALUES
    (v_pkm_id, v_project_id, '주주분류 + 1% 이상 개별 연락',       '2026-03-09', '2026-03-13', 2,  '#1D9E75'),
    (v_pkm_id, v_project_id, '공동행사약정서 (w/ Brandon)',        '2026-03-09', '2026-03-13', 3,  '#1D9E75'),
    (v_pkm_id, v_project_id, '소집통지 (1% 이상, 이메일)',         '2026-03-11', '2026-03-15', 4,  '#1D9E75'),
    (v_pkm_id, v_project_id, '소집 공고',                          '2026-03-09', '2026-03-12', 5,  '#1D9E75'),
    (v_pkm_id, v_project_id, '위임장 발송 + 등기 서류 취함',       '2026-03-13', '2026-03-17', 6,  '#1D9E75'),
    (v_pkm_id, v_project_id, '등기 필요 서류 준비 + 취합 (각자)',  '2026-03-13', '2026-03-17', 7,  '#1D9E75'),
    (v_pkm_id, v_project_id, '등기',                               '2026-03-28', '2026-03-31', 8,  '#1D9E75'),
    (v_pkm_id, v_project_id, '안건자료 PPT',                       '2026-03-14', '2026-03-18', 9,  '#1D9E75'),
    (v_pkm_id, v_project_id, '의사록+첨부서류',                    '2026-03-14', '2026-03-18', 10, '#1D9E75'),
    (v_pkm_id, v_project_id, '운영 매뉴얼 (스크립트, 배치도 등)',  '2026-03-17', '2026-03-21', 11, '#1D9E75'),
    (v_pkm_id, v_project_id, '현장 투표 Dashboard 제작',           '2026-03-17', '2026-03-21', 12, '#1D9E75'),
    (v_pkm_id, v_project_id, '현장 준비물 제작 + 식권',            '2026-03-17', '2026-03-25', 13, '#1D9E75'),
    (v_pkm_id, v_project_id, '정기주총 개최',                      '2026-03-28', '2026-03-29', 14, '#1D9E75'),
    (v_pkm_id, v_project_id, '정기 주총 결과 공시',                '2026-03-29', '2026-03-30', 15, '#1D9E75'),
    (v_pkm_id, v_project_id, '사업보고서 공시',                    '2026-03-22', '2026-03-26', 16, '#1D9E75'),
    (v_pkm_id, v_project_id, '감사보고서 공시',                    '2026-03-22', '2026-03-26', 17, '#1D9E75'),
    (v_pkm_id, v_project_id, '영업보고서 공시 (사업보고서 첨부)',   '2026-03-22', '2026-03-27', 18, '#1D9E75'),
    (v_pkm_id, v_project_id, '정기주총 개최 (본회의)',              '2026-04-02', '2026-04-03', 19, '#1D9E75');

  RAISE NOTICE '✓ 18개 마일스톤 삽입 완료 (프로젝트: %, PKM: %)', v_project_id, v_pkm_id;
END $$;`

    console.log(sql)
    return
  }
})()
