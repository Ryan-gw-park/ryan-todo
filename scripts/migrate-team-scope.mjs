/**
 * 일회성 마이그레이션: 팀 프로젝트에 소속된 private tasks → team tasks로 전환
 *
 * 사용법:
 *   1. Supabase SQL Editor에서 20260314100000_migrate_team_task_scope.sql 실행
 *   2. node scripts/migrate-team-scope.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gnqbjxuuzvppupispvpf.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImducWJqeHV1enZwcHVwaXNwdnBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjM3MjAsImV4cCI6MjA4ODU5OTcyMH0.2bh71qyJLWf9kqqr9xHYY4HcfKk79FxoM48rG5GvbdM'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data, error } = await supabase.rpc('migrate_team_task_scope')

if (error) {
  console.error('Migration failed:', error.message)
  console.log('\n→ Supabase SQL Editor에서 먼저 20260314100000_migrate_team_task_scope.sql을 실행하세요.')
  process.exit(1)
}

console.log(`✓ 마이그레이션 완료: ${data}건의 tasks가 team scope로 전환되었습니다.`)
