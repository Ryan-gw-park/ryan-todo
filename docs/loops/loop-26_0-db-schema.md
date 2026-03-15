# Loop-26.0 — Reference DB 스키마 + 권한 기반

## 목표
Reference 기능을 위한 신규 테이블 생성 및 RLS 정책 적용.  
코드 변경 없이 **DB만 건드리는** 안전한 선행 작업.

---

## 전제 조건
- Supabase Dashboard 접근 가능
- 기존 `tasks`, `projects` 테이블 정상 동작 확인
- `tasks.created_by`, `projects` 테이블에 `created_by` 컬럼 존재 여부 확인

---

## 사전 확인 (SQL Editor에서 실행)

```sql
-- 1. tasks.created_by 존재 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'created_by';

-- 2. projects.created_by 존재 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'created_by';

-- 3. projects.id 타입 확인 (text expected)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'id';
```

> **결과에 따라 분기:**
> - `tasks.created_by`가 없으면 → 아래 "마이그레이션 A" 실행
> - `projects.created_by`가 없으면 → 아래 "마이그레이션 B" 실행
> - 둘 다 있으면 → 바로 "신규 테이블 생성"으로 진행

---

## 마이그레이션 A: tasks.created_by (조건부)

```sql
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE tasks SET created_by = assignee_id 
WHERE created_by IS NULL AND assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

CREATE OR REPLACE FUNCTION set_task_created_by()
RETURNS trigger AS $$
BEGIN
  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_tasks_created_by ON tasks;
CREATE TRIGGER trg_tasks_created_by
BEFORE INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION set_task_created_by();
```

## 마이그레이션 B: projects.created_by (조건부)

```sql
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE projects SET created_by = user_id::uuid 
WHERE created_by IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

CREATE OR REPLACE FUNCTION set_project_created_by()
RETURNS trigger AS $$
BEGIN
  IF new.created_by IS NULL THEN
    new.created_by := auth.uid();
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_projects_created_by ON projects;
CREATE TRIGGER trg_projects_created_by
BEFORE INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION set_project_created_by();
```

---

## 신규 테이블 생성

### project_references

```sql
CREATE TABLE project_references (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_project_references_project_id ON project_references(project_id);
ALTER TABLE project_references ENABLE ROW LEVEL SECURITY;
```

### ref_milestones

```sql
CREATE TABLE ref_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title          text NOT NULL DEFAULT '',
  description    text,
  start_date     date,
  end_date       date,
  color          text DEFAULT '#1D9E75',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_ref_milestones_reference_id ON ref_milestones(reference_id);
CREATE INDEX idx_ref_milestones_project_id ON ref_milestones(project_id);
ALTER TABLE ref_milestones ENABLE ROW LEVEL SECURITY;
```

> **주의:** `start_date`와 `end_date` 두 컬럼. 간트 바의 시작~종료 범위 표현에 필수.  
> 기존 분석에서 `milestone_date` 단일 컬럼이었으나, 목업의 간트 바가 범위를 표현하므로 수정.

### ref_deliverables

```sql
CREATE TABLE ref_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id   uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  milestone_id   uuid REFERENCES ref_milestones(id) ON DELETE SET NULL,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
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
CREATE INDEX idx_ref_deliverables_reference_id ON ref_deliverables(reference_id);
CREATE INDEX idx_ref_deliverables_milestone_id ON ref_deliverables(milestone_id);
CREATE INDEX idx_ref_deliverables_project_id ON ref_deliverables(project_id);
ALTER TABLE ref_deliverables ENABLE ROW LEVEL SECURITY;
```

> **milestone_id FK:** 결과물이 어느 마일스톤에 속하는지 연결. Reference 편집 뷰의 좌우 행 정렬에 사용.  
> NULL 허용 — 아직 마일스톤에 연결되지 않은 결과물도 존재 가능.

### ref_links

```sql
CREATE TABLE ref_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  url          text,
  description  text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_ref_links_reference_id ON ref_links(reference_id);
ALTER TABLE ref_links ENABLE ROW LEVEL SECURITY;
```

### ref_policies

```sql
CREATE TABLE ref_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id uuid NOT NULL REFERENCES project_references(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  description  text,
  tag_label    text,
  tag_type     text DEFAULT 'internal',
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_ref_policies_reference_id ON ref_policies(reference_id);
ALTER TABLE ref_policies ENABLE ROW LEVEL SECURITY;
```

### tasks 테이블에 deliverable_id 추가

```sql
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS deliverable_id uuid REFERENCES ref_deliverables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_deliverable_id ON tasks(deliverable_id);
```

> **nullable.** 기존 Task는 모두 NULL. Task 생성/편집 시 선택적으로 결과물 태그 가능.

---

## RLS 정책

### 공통 패턴 (ref_* 5개 테이블 + project_references)

> Reference는 팀 전체 공동 관리. 팀 멤버면 누구나 CRUD 가능.

```sql
-- project_references 예시 (나머지 5개 동일 패턴)
CREATE POLICY "team_select_project_references" ON project_references FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_project_references" ON project_references FOR INSERT WITH CHECK (
  /* 동일 조건 */
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_project_references" ON project_references FOR UPDATE USING (
  /* 동일 조건 */
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_project_references" ON project_references FOR DELETE USING (
  /* 동일 조건 */
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);
```

> **ref_milestones, ref_deliverables, ref_links, ref_policies** 모두 위와 동일한 4개 정책 적용.
> 총 RLS 정책: 6개 테이블 × 4개 = **24개**

---

## 검증

```sql
-- 테이블 존재 확인
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('project_references','ref_milestones','ref_deliverables','ref_links','ref_policies');

-- RLS 정책 확인
SELECT tablename, policyname FROM pg_policies 
WHERE tablename LIKE 'ref_%' OR tablename = 'project_references';

-- tasks.deliverable_id 확인
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'tasks' AND column_name = 'deliverable_id';
```

---

## 완료 조건
- [ ] 사전 확인 SQL 실행 완료
- [ ] (조건부) 마이그레이션 A/B 실행
- [ ] 6개 신규 테이블 생성 확인
- [ ] tasks.deliverable_id 컬럼 추가 확인
- [ ] RLS 24개 정책 적용 확인
- [ ] 인덱스 생성 확인
- [ ] 기존 앱 정상 동작 확인 (테이블 추가만이므로 영향 없어야 함)
- [ ] `npm run build` 성공

---

## 주의사항
- `projects.id`는 **text** 타입 — `ref_*.project_id`도 text로 맞춤
- `ref_milestones`에 **start_date + end_date** 두 컬럼 (간트 바 범위 표현 필수)
- `ref_deliverables.milestone_id`는 FK로 마일스톤 연결 — Reference 좌우 정렬에 사용
- `tasks.deliverable_id`는 **nullable** — 기존 Task 무영향, 선택적 태깅
- 기존 `tasks` 컬럼(text/done/category/alarm) 수정 없음
