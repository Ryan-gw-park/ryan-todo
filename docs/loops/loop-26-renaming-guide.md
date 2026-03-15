# Loop-26 리네이밍 가이드 — DB / 코드 / UI 전체 일괄 변경

## 목표

UI 레이블, 코드(파일명/변수명/함수명), DB 테이블명을 **일관되게 정렬**한다.  
앞으로 Ryan이 UI 이름으로 지시하면 코드와 DB에서 즉시 찾을 수 있어야 한다.

---

## 1. 탭 이름 매핑 (최종)

| UI 레이블 | 탭 key | 설명 |
|----------|--------|------|
| **Key Milestone** | `milestone` | 마일스톤 + 결과물 + Task 연결 (구 Reference) |
| **Tasks** | `tasks` | 마일스톤별 아웃라이너 (변경 없음) |
| **타임라인** | `ptimeline` | 프로젝트 타임라인 (구 병렬 보기) |

> 글로벌 타임라인(`timeline`)과 프로젝트 타임라인(`ptimeline`)을 구별.

---

## 2. DB 테이블 리네이밍

### 변경 전 → 변경 후

| Before | After | 설명 |
|--------|-------|------|
| `project_references` | `project_key_milestones` | 프로젝트별 Key Milestone 부모 레코드 |
| `ref_milestones` | `key_milestones` | 마일스톤 항목 |
| `ref_deliverables` | `key_deliverables` | 핵심 결과물 항목 |
| `ref_links` | `key_links` | 참조 문서 항목 |
| `ref_policies` | `key_policies` | 합의된 정책 항목 |

### 마이그레이션 SQL

> 기존 데이터는 가공 데이터이므로, 기존 테이블을 **DROP 후 새로 CREATE** 한다.

```sql
-- ═══ 1. 기존 테이블 삭제 (CASCADE로 의존성 함께) ═══

DROP TABLE IF EXISTS ref_policies CASCADE;
DROP TABLE IF EXISTS ref_links CASCADE;
DROP TABLE IF EXISTS ref_deliverables CASCADE;
DROP TABLE IF EXISTS ref_milestones CASCADE;
DROP TABLE IF EXISTS project_references CASCADE;

-- ═══ 2. 신규 테이블 생성 ═══

-- 프로젝트별 Key Milestone 부모 레코드
CREATE TABLE project_key_milestones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pkm_project_id ON project_key_milestones(project_id);
ALTER TABLE project_key_milestones ENABLE ROW LEVEL SECURITY;

-- 마일스톤 항목
CREATE TABLE key_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id         uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
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
CREATE INDEX idx_km_pkm_id ON key_milestones(pkm_id);
CREATE INDEX idx_km_project_id ON key_milestones(project_id);
ALTER TABLE key_milestones ENABLE ROW LEVEL SECURITY;

-- 핵심 결과물
CREATE TABLE key_deliverables (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id   uuid REFERENCES key_milestones(id) ON DELETE CASCADE,
  pkm_id         uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id     text NOT NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title          text NOT NULL DEFAULT '',
  description    text,
  assignee_ids   text[],
  tag_label      text,
  tag_bg         text DEFAULT '#E6F1FB',
  tag_text_color text DEFAULT '#185FA5',
  sort_order     integer DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_kd_milestone_id ON key_deliverables(milestone_id);
CREATE INDEX idx_kd_pkm_id ON key_deliverables(pkm_id);
CREATE INDEX idx_kd_project_id ON key_deliverables(project_id);
ALTER TABLE key_deliverables ENABLE ROW LEVEL SECURITY;

-- 참조 문서
CREATE TABLE key_links (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id       uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
  project_id   text NOT NULL,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title        text NOT NULL DEFAULT '',
  url          text,
  description  text,
  sort_order   integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_kl_pkm_id ON key_links(pkm_id);
ALTER TABLE key_links ENABLE ROW LEVEL SECURITY;

-- 합의된 정책
CREATE TABLE key_policies (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pkm_id       uuid NOT NULL REFERENCES project_key_milestones(id) ON DELETE CASCADE,
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
CREATE INDEX idx_kp_pkm_id ON key_policies(pkm_id);
ALTER TABLE key_policies ENABLE ROW LEVEL SECURITY;

-- ═══ 3. tasks 테이블 컬럼 정리 ═══

-- ref_milestone_id → key_milestone_id 로 변경
-- (기존 컬럼이 있다면 삭제 후 재생성)
ALTER TABLE tasks DROP COLUMN IF EXISTS ref_milestone_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS deliverable_id;

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS key_milestone_id uuid REFERENCES key_milestones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_key_milestone_id ON tasks(key_milestone_id);

-- ═══ 4. RLS 정책 (5개 테이블 × 4개 = 20개) ═══

-- project_key_milestones 예시 (나머지 4개 동일 패턴)
CREATE POLICY "team_select_pkm" ON project_key_milestones FOR SELECT USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_insert_pkm" ON project_key_milestones FOR INSERT WITH CHECK (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_update_pkm" ON project_key_milestones FOR UPDATE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

CREATE POLICY "team_delete_pkm" ON project_key_milestones FOR DELETE USING (
  project_id IN (
    SELECT p.id::text FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
  OR project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()::text AND team_id IS NULL
  )
);

-- ★ key_milestones, key_deliverables, key_links, key_policies 모두 위와 동일한 4개 정책 적용
-- 정책명만 변경: team_select_km, team_insert_km, team_update_km, team_delete_km
-- team_select_kd, team_insert_kd, team_update_kd, team_delete_kd
-- team_select_kl, team_insert_kl, team_update_kl, team_delete_kl
-- team_select_kp, team_insert_kp, team_update_kp, team_delete_kp
```

### 검증 SQL

```sql
-- 테이블 존재 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('project_key_milestones','key_milestones','key_deliverables','key_links','key_policies');

-- RLS 정책 확인
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'key_%' OR tablename = 'project_key_milestones';

-- tasks.key_milestone_id 확인
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'tasks' AND column_name = 'key_milestone_id';

-- 기존 테이블 삭제 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('project_references','ref_milestones','ref_deliverables','ref_links','ref_policies');
-- → 결과 0건이어야 함
```

---

## 3. 코드 리네이밍

### 파일명 변경

| Before | After |
|--------|-------|
| `src/components/project/ReferenceTab.jsx` | `src/components/project/KeyMilestoneTab.jsx` |
| `src/components/project/ParallelView.jsx` | `src/components/project/ProjectTimelineTab.jsx` |
| `src/components/project/parallel/SimpleGanttMode.jsx` | `src/components/project/timeline/GanttMode.jsx` |
| `src/components/project/parallel/DetailParallelMode.jsx` | `src/components/project/timeline/DetailMode.jsx` |
| `src/hooks/useProjectReference.js` | `src/hooks/useProjectKeyMilestone.js` |
| `src/hooks/useRefMilestones.js` | `src/hooks/useKeyMilestones.js` |
| `src/hooks/useRefDeliverables.js` | `src/hooks/useKeyDeliverables.js` |
| `src/hooks/useRefLinks.js` | `src/hooks/useKeyLinks.js` |
| `src/hooks/useRefPolicies.js` | `src/hooks/useKeyPolicies.js` |
| `src/hooks/useParallelData.js` | `src/hooks/useProjectTimelineData.js` |

### 컴포넌트/함수명 변경

| Before | After |
|--------|-------|
| `ReferenceTab` | `KeyMilestoneTab` |
| `ParallelView` | `ProjectTimelineTab` |
| `SimpleGanttMode` | `GanttMode` |
| `DetailParallelMode` | `DetailMode` |
| `useProjectReference(projectId)` | `useProjectKeyMilestone(projectId)` |
| `useRefMilestones(pkmId, projectId)` | `useKeyMilestones(pkmId, projectId)` |
| `useRefDeliverables(...)` | `useKeyDeliverables(...)` |
| `useRefLinks(...)` | `useKeyLinks(...)` |
| `useRefPolicies(...)` | `useKeyPolicies(...)` |
| `useParallelData(projectId)` | `useProjectTimelineData(projectId)` |

### Zustand state/action 변경

| Before | After |
|--------|-------|
| `projectLayerTab: 'ref'` | `projectLayerTab: 'milestone'` |
| `projectLayerTab: 'parallel'` | `projectLayerTab: 'ptimeline'` |
| `projectLayerParaMode` | `projectTimelineMode` |
| `setProjectLayerParaMode` | `setProjectTimelineMode` |

### 훅 내부 테이블 참조 변경

```javascript
// useProjectKeyMilestone.js
// Before
await db.from('project_references').select('*').eq('project_id', pid).single()
await db.from('project_references').insert({ project_id: pid })

// After
await db.from('project_key_milestones').select('*').eq('project_id', pid).single()
await db.from('project_key_milestones').insert({ project_id: pid })

// useKeyMilestones.js
// Before
await db.from('ref_milestones').select('*').eq('reference_id', refId)

// After
await db.from('key_milestones').select('*').eq('pkm_id', pkmId)

// useKeyDeliverables.js
// Before
await db.from('ref_deliverables')...

// After
await db.from('key_deliverables')...

// useKeyLinks.js, useKeyPolicies.js 동일 패턴
```

### FK 컬럼명 변경

| Before | After | 위치 |
|--------|-------|------|
| `reference_id` | `pkm_id` | key_milestones, key_deliverables, key_links, key_policies |
| `ref_milestone_id` | `key_milestone_id` | tasks 테이블 |

### useStore.js mapTask/taskToRow

```javascript
// mapTask
// Before
refMilestoneId: r.ref_milestone_id || null,

// After
keyMilestoneId: r.key_milestone_id || null,

// taskToRow
// Before
ref_milestone_id: t.refMilestoneId || null,

// After
key_milestone_id: t.keyMilestoneId || null,
```

### ProjectHeader.jsx

```javascript
// Before
const TABS = [
  { key: 'ref', label: 'Reference' },
  { key: 'tasks', label: 'Tasks', ... },
  { key: 'parallel', label: '병렬 보기', ... },
]

// After
const TABS = [
  { key: 'milestone', label: 'Key Milestone' },
  { key: 'tasks', label: 'Tasks', ... },
  { key: 'ptimeline', label: '타임라인', ... },
]
```

### ProjectLayer.jsx

```javascript
// Before
{tab === 'ref' && <ReferenceTab projectId={id} />}
{tab === 'tasks' && <TasksTab projectId={id} mode={taskMode} />}
{tab === 'parallel' && <ParallelView projectId={id} mode={paraMode} />}

// After
{tab === 'milestone' && <KeyMilestoneTab projectId={id} />}
{tab === 'tasks' && <TasksTab projectId={id} />}
{tab === 'ptimeline' && <ProjectTimelineTab projectId={id} mode={timelineMode} />}
```

### Sidebar.jsx 진입

```javascript
// Before
enterProjectLayer: (projectId) => set({
  currentView: 'projectLayer',
  selectedProjectId: projectId,
  projectLayerTab: 'ref',
})

// After
enterProjectLayer: (projectId) => set({
  currentView: 'projectLayer',
  selectedProjectId: projectId,
  projectLayerTab: 'milestone',
})
```

---

## 4. UI 레이블 최종 정리

### 프로젝트 레이어 탭

| 탭 key | UI 레이블 | 설명 |
|--------|----------|------|
| `milestone` | Key Milestone | 마일스톤 > 결과물 \| Task 2패널 |
| `tasks` | Tasks | 마일스톤별 아웃라이너 |
| `ptimeline` | 타임라인 | 간트 / 상세 2모드 |

### 타임라인 모드 바

| 모드 key | UI 레이블 | 설명 |
|---------|----------|------|
| `gantt` | 타임라인 | 마일스톤 간트 전체 조망 |
| `detail` | 결과물 + Task | 마일스톤별 결과물 + Task 병렬 |

### 글로벌 뷰 vs 프로젝트 뷰 구별

| 글로벌 | 프로젝트 | 코드에서 구별 |
|--------|---------|------------|
| 타임라인 (`timeline`) | 타임라인 (`ptimeline`) | `currentView` 값으로 구별 |
| TimelineView.jsx | ProjectTimelineTab.jsx | 파일명으로 구별 |

---

## 5. 리네이밍 체크리스트

### DB
- [ ] 기존 5개 테이블 DROP 확인
- [ ] 신규 5개 테이블 CREATE 확인 (`project_key_milestones`, `key_milestones`, `key_deliverables`, `key_links`, `key_policies`)
- [ ] `tasks.ref_milestone_id` DROP + `tasks.key_milestone_id` ADD 확인
- [ ] RLS 20개 정책 적용 확인
- [ ] 인덱스 생성 확인

### 코드 파일명
- [ ] 모든 Before 파일 삭제 또는 이름 변경 확인
- [ ] 모든 After 파일 존재 확인
- [ ] import 경로 전체 업데이트 확인

### 코드 변수명
- [ ] `reference` → `keyMilestone` 또는 `pkm` 전체 치환 확인
- [ ] `refMilestoneId` → `keyMilestoneId` 전체 치환 확인
- [ ] `ref_milestone_id` → `key_milestone_id` 전체 치환 확인
- [ ] `reference_id` → `pkm_id` 전체 치환 확인
- [ ] `projectLayerTab: 'ref'` → `'milestone'` 전체 치환 확인
- [ ] `projectLayerTab: 'parallel'` → `'ptimeline'` 전체 치환 확인
- [ ] `projectLayerParaMode` → `projectTimelineMode` 전체 치환 확인

### UI 레이블
- [ ] "Reference" 텍스트 미노출 확인
- [ ] "Key Milestone" 정상 표시 확인
- [ ] "병렬 보기" 텍스트 미노출 확인
- [ ] "타임라인" (프로젝트) 정상 표시 확인
- [ ] 글로벌 "타임라인"과 프로젝트 "타임라인" 혼동 없음 확인

### 기능 회귀
- [ ] Key Milestone 탭 CRUD 정상
- [ ] Tasks 탭 아웃라이너 정상
- [ ] 프로젝트 타임라인 탭 정상
- [ ] 글로벌 타임라인 뷰 정상 (별개 컴포넌트, 미영향)
- [ ] `npm run build` 성공

---

## 실행 순서

1. **DB 마이그레이션 먼저** — Ryan이 Supabase SQL Editor에서 실행
2. **코드 일괄 리네이밍** — Claude Code가 파일명 + 변수명 + import 경로 전체 변경
3. **기능 검증** — 빌드 + 각 탭 동작 확인

---

## 주의사항

- 리네이밍은 **기능 변경이 아니다.** 이름만 바꾸고 로직은 건드리지 않는다.
- DB 테이블을 DROP/CREATE 하므로 **기존 가공 데이터는 모두 삭제된다.** Ryan 확인 완료.
- `pkm_id`는 `project_key_milestones.id`의 약자. 훅과 쿼리에서 일관되게 사용.
- 글로벌 타임라인(`TimelineView.jsx`, `currentView: 'timeline'`)은 일절 건드리지 않는다.
