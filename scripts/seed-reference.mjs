import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

async function seed() {
  console.log('🌱 Reference seed 데이터 생성 시작...\n')

  // 1. 첫 번째 프로젝트 가져오기
  const { data: projects } = await supabase.from('projects').select('id, name').limit(1)
  if (!projects || projects.length === 0) {
    console.error('❌ 프로젝트가 없습니다. 먼저 프로젝트를 생성하세요.')
    process.exit(1)
  }

  const project = projects[0]
  console.log(`📁 프로젝트: ${project.name} (${project.id})`)

  // 2. project_references 생성 또는 조회
  let { data: reference } = await supabase
    .from('project_references')
    .select('*')
    .eq('project_id', project.id)
    .single()

  if (!reference) {
    const { data: created, error: insertErr } = await supabase
      .from('project_references')
      .insert({ project_id: project.id })
      .select()
      .single()

    if (insertErr) {
      console.error('Insert error:', insertErr)
      // 이미 존재할 수 있으므로 다시 조회
      const { data: existing } = await supabase
        .from('project_references')
        .select('*')
        .eq('project_id', project.id)
        .single()
      reference = existing
    } else {
      reference = created
    }
    console.log('✅ project_references 생성됨:', reference?.id)
  } else {
    console.log('ℹ️  기존 project_references 사용:', reference.id)
  }

  if (!reference) {
    console.error('❌ project_references를 가져올 수 없습니다.')
    process.exit(1)
  }

  // 3. 마일스톤 생성
  const today = new Date().toISOString().split('T')[0]
  const addDays = (days) => {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  const milestones = [
    {
      reference_id: reference.id,
      project_id: project.id,
      title: '킥오프 미팅',
      description: '프로젝트 시작 회의 및 역할 분담',
      start_date: today,
      end_date: addDays(7),
      color: '#1D9E75',
      sort_order: 0,
    },
    {
      reference_id: reference.id,
      project_id: project.id,
      title: '1차 개발 완료',
      description: '핵심 기능 개발 및 내부 테스트',
      start_date: addDays(7),
      end_date: addDays(30),
      color: '#5b8fd4',
      sort_order: 1,
    },
    {
      reference_id: reference.id,
      project_id: project.id,
      title: '최종 배포',
      description: '프로덕션 배포 및 모니터링',
      start_date: addDays(30),
      end_date: addDays(45),
      color: '#d48a3f',
      sort_order: 2,
    },
  ]

  const { data: createdMilestones } = await supabase
    .from('ref_milestones')
    .insert(milestones)
    .select()

  console.log(`✅ 마일스톤 ${createdMilestones.length}개 생성됨`)

  // 4. 결과물 생성
  const deliverables = [
    // 킥오프 마일스톤
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[0].id, title: '프로젝트 계획서', description: 'WBS 및 일정표 포함', sort_order: 0 },
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[0].id, title: '역할 분담표', description: '팀원별 담당 영역 정의', sort_order: 1 },
    // 1차 개발 마일스톤
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[1].id, title: 'API 설계 문서', description: 'REST API 엔드포인트 명세', tag_label: '진행중', tag_bg: '#d4edda', tag_text_color: '#155724', sort_order: 0 },
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[1].id, title: 'DB 스키마', description: 'ERD 및 테이블 정의서', tag_label: '완료', tag_bg: '#d4edda', tag_text_color: '#155724', sort_order: 1 },
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[1].id, title: '테스트 시나리오', description: 'QA 테스트 케이스', sort_order: 2 },
    // 최종 배포 마일스톤
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[2].id, title: '배포 체크리스트', description: '프로덕션 배포 전 확인 항목', sort_order: 0 },
    { reference_id: reference.id, project_id: project.id, milestone_id: createdMilestones[2].id, title: '운영 매뉴얼', description: '장애 대응 및 모니터링 가이드', tag_label: '대기', tag_bg: '#fff3cd', tag_text_color: '#856404', sort_order: 1 },
  ]

  const { data: createdDeliverables } = await supabase
    .from('ref_deliverables')
    .insert(deliverables)
    .select()

  console.log(`✅ 결과물 ${createdDeliverables.length}개 생성됨`)

  // 5. 참조 문서 생성
  const links = [
    { reference_id: reference.id, project_id: project.id, title: 'Figma 디자인', url: 'https://figma.com/example', sort_order: 0 },
    { reference_id: reference.id, project_id: project.id, title: 'GitHub 저장소', url: 'https://github.com/example/repo', sort_order: 1 },
    { reference_id: reference.id, project_id: project.id, title: '기술 스펙 문서', url: 'https://notion.so/tech-spec', sort_order: 2 },
  ]

  const { data: createdLinks } = await supabase
    .from('ref_links')
    .insert(links)
    .select()

  console.log(`✅ 참조 문서 ${createdLinks.length}개 생성됨`)

  // 6. 합의된 정책 생성
  const policies = [
    { reference_id: reference.id, project_id: project.id, title: '코드 리뷰 필수', description: '모든 PR은 최소 1명의 리뷰어 승인 필요', sort_order: 0 },
    { reference_id: reference.id, project_id: project.id, title: '일일 스탠드업', description: '매일 오전 10시 15분 진행', sort_order: 1 },
    { reference_id: reference.id, project_id: project.id, title: '브랜치 전략', description: 'main → develop → feature/* 구조 사용', sort_order: 2 },
  ]

  const { data: createdPolicies } = await supabase
    .from('ref_policies')
    .insert(policies)
    .select()

  console.log(`✅ 합의된 정책 ${createdPolicies.length}개 생성됨`)

  console.log('\n════════════════════════════════════════')
  console.log('🎉 Seed 데이터 생성 완료!')
  console.log(`   프로젝트: ${project.name}`)
  console.log('════════════════════════════════════════')
}

seed().catch(console.error)
