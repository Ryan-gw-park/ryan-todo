// 정기주총 프로젝트에 간트차트 마일스톤 자동 입력 스크립트
// Usage: node scripts/insert-milestones.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gnqbjxuuzvppupispvpf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImducWJqeHV1enZwcHVwaXNwdnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjM3MjAsImV4cCI6MjA4ODU5OTcyMH0.2bh71qyJLWf9kqqr9xHYY4HcfKk79FxoM48rG5GvbdM'

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

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

async function main() {
  // 1. '정기주총' 프로젝트 찾기
  const { data: projects, error: pErr } = await db
    .from('projects')
    .select('id, name')
    .ilike('name', '%정기주총%')

  if (pErr) { console.error('프로젝트 조회 실패:', pErr.message); process.exit(1) }
  if (!projects || projects.length === 0) { console.error('정기주총 프로젝트를 찾을 수 없습니다'); process.exit(1) }

  const project = projects[0]
  console.log(`프로젝트 발견: ${project.name} (id: ${project.id})`)

  // 2. project_key_milestones 조회 (없으면 생성)
  let { data: pkm } = await db
    .from('project_key_milestones')
    .select('id')
    .eq('project_id', project.id)
    .single()

  if (!pkm) {
    console.log('project_key_milestones 레코드 생성 중...')
    const { data: newPkm, error: pkmErr } = await db
      .from('project_key_milestones')
      .insert({ project_id: project.id })
      .select('id')
      .single()
    if (pkmErr) { console.error('PKM 생성 실패:', pkmErr.message); process.exit(1) }
    pkm = newPkm
  }
  console.log(`PKM id: ${pkm.id}`)

  // 3. 기존 마일스톤 확인
  const { data: existing } = await db
    .from('key_milestones')
    .select('id, title')
    .eq('pkm_id', pkm.id)

  if (existing && existing.length > 0) {
    console.log(`\n기존 마일스톤 ${existing.length}개 존재:`)
    existing.forEach(m => console.log(`  - ${m.title}`))
    console.log('\n기존 마일스톤을 유지하고 새 마일스톤을 추가합니다.')
  }

  // 4. 마일스톤 삽입
  const rows = MILESTONES.map(m => ({
    pkm_id: pkm.id,
    project_id: project.id,
    title: m.title,
    start_date: m.start_date,
    end_date: m.end_date,
    sort_order: m.sort_order,
    color: '#1D9E75',
  }))

  const { data: inserted, error: insertErr } = await db
    .from('key_milestones')
    .insert(rows)
    .select('id, title, sort_order')

  if (insertErr) {
    console.error('마일스톤 삽입 실패:', insertErr.message)
    process.exit(1)
  }

  console.log(`\n✓ ${inserted.length}개 마일스톤 삽입 완료:`)
  inserted.forEach(m => console.log(`  [${String(m.sort_order).padStart(2)}] ${m.title}`))
}

main().catch(err => { console.error(err); process.exit(1) })
