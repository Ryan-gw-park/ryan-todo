import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  db: { schema: 'public' },
  auth: { persistSession: false }
})

async function migrate() {
  console.log('🔧 Reference 테이블 마이그레이션 시작...\n')

  // Supabase JS client doesn't support raw SQL execution directly
  // We need to use the REST API with the service role key

  const sql = `
    -- project_references
    CREATE TABLE IF NOT EXISTS project_references (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id text NOT NULL,
      created_by uuid,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- ref_milestones
    CREATE TABLE IF NOT EXISTS ref_milestones (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
      project_id     text NOT NULL,
      created_by     uuid,
      title          text NOT NULL DEFAULT '',
      description    text,
      start_date     date,
      end_date       date,
      color          text DEFAULT '#1D9E75',
      sort_order     integer DEFAULT 0,
      created_at     timestamptz DEFAULT now(),
      updated_at     timestamptz DEFAULT now()
    );

    -- ref_deliverables
    CREATE TABLE IF NOT EXISTS ref_deliverables (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
      milestone_id   uuid REFERENCES ref_milestones(id) ON DELETE SET NULL,
      project_id     text NOT NULL,
      created_by     uuid,
      title          text NOT NULL DEFAULT '',
      description    text,
      assignee_ids   text[],
      due_label      text,
      tag_label      text,
      tag_bg         text DEFAULT '#E6F1FB',
      tag_text_color text DEFAULT '#185FA5',
      sort_order     integer DEFAULT 0,
      created_at     timestamptz DEFAULT now(),
      updated_at     timestamptz DEFAULT now()
    );

    -- ref_links
    CREATE TABLE IF NOT EXISTS ref_links (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
      project_id   text NOT NULL,
      created_by   uuid,
      title        text NOT NULL DEFAULT '',
      url          text,
      description  text,
      sort_order   integer DEFAULT 0,
      created_at   timestamptz DEFAULT now(),
      updated_at   timestamptz DEFAULT now()
    );

    -- ref_policies
    CREATE TABLE IF NOT EXISTS ref_policies (
      id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
      project_id   text NOT NULL,
      created_by   uuid,
      title        text NOT NULL DEFAULT '',
      description  text,
      tag_label    text,
      tag_type     text DEFAULT 'internal',
      sort_order   integer DEFAULT 0,
      created_at   timestamptz DEFAULT now(),
      updated_at   timestamptz DEFAULT now()
    );

    -- tasks.deliverable_id
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverable_id uuid;
  `

  // Use the Supabase REST API to execute SQL
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ sql })
  })

  if (!response.ok) {
    // If exec_sql doesn't exist, we need to run SQL manually
    console.log('ℹ️  exec_sql 함수가 없습니다. Supabase SQL Editor에서 직접 실행해 주세요.')
    console.log('   파일: docs/loops/loop-26_0-sql.sql')
    console.log('')
    console.log('또는 아래 SQL을 Supabase SQL Editor에 붙여넣어 실행하세요:')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    return false
  }

  console.log('✅ 테이블 생성 완료!')
  return true
}

migrate().catch(console.error)
