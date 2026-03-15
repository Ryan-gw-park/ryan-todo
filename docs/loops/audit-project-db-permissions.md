# 프로젝트 탭 DB 구조 및 권한 전수 점검

## 목표

프로젝트 관련 DB 테이블, RLS 정책, 프론트엔드 권한 로직의 **설계 vs 실제 구현** 차이를 식별한다.
출력: `audit-report-project-permissions.md` 파일 하나.

---

## 1단계: DB 테이블 존재 및 컬럼 점검

Supabase SQL Editor 또는 `npx supabase` CLI로 아래 쿼리를 실행하고, 결과를 그대로 문서에 기록하라.

### 1-1. projects 테이블 전체 컬럼

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'projects'
ORDER BY ordinal_position;
```

**확인 항목:**
- [ ] `id` — text 타입인가?
- [ ] `team_id` — uuid, nullable인가?
- [ ] `user_id` — text, nullable인가?
- [ ] `created_by` — uuid, nullable인가?
- [ ] `name`, `color`, `sort_order` 존재하는가?
- [ ] team_id XOR user_id CHECK 제약조건이 있는가? → 아래 쿼리로 확인:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.projects'::regclass AND contype = 'c';
```

### 1-2. tasks 테이블 팀 관련 컬럼

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
AND column_name IN ('team_id', 'scope', 'assignee_id', 'created_by', 'deleted_at', 'deliverable_id', 'project_id')
ORDER BY ordinal_position;
```

**확인 항목:**
- [ ] `team_id` — uuid, nullable
- [ ] `scope` — text (값: 'private', 'team', 'assigned')
- [ ] `assignee_id` — uuid, nullable
- [ ] `created_by` — uuid, nullable
- [ ] `deleted_at` — timestamptz, nullable (Loop-23 soft delete)
- [ ] `deliverable_id` — uuid, nullable (Loop-26 Reference 연결)
- [ ] `project_id` — text, nullable

### 1-3. Reference 신규 테이블 존재 확인

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'project_references',
  'ref_milestones',
  'ref_deliverables',
  'ref_links',
  'ref_policies'
);
```

**각 테이블이 존재하면** 컬럼 전체를 출력:

```sql
-- 존재하는 테이블마다 실행
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<테이블명>'
ORDER BY ordinal_position;
```

**확인 항목 (테이블이 존재할 경우):**
- [ ] `project_references` — id(uuid), project_id(text), created_by(uuid)
- [ ] `ref_milestones` — reference_id(uuid FK), project_id(text), start_date(date), end_date(date)
- [ ] `ref_deliverables` — reference_id(uuid FK), milestone_id(uuid FK nullable), assignee_ids(text[])
- [ ] `ref_links` — reference_id(uuid FK), url(text)
- [ ] `ref_policies` — reference_id(uuid FK), tag_type(text)

### 1-4. 팀 관련 기존 테이블 확인

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('companies', 'teams', 'team_members', 'profiles', 'comments', 'notifications');
```

각 테이블 컬럼도 출력:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('companies', 'teams', 'team_members', 'profiles', 'comments', 'notifications')
ORDER BY table_name, ordinal_position;
```

---

## 2단계: RLS 정책 전수 조사

### 2-1. RLS 활성화 상태

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**RLS가 활성화되어야 하는 테이블 목록:**
- tasks, projects, memos, comments, notifications
- team_members, teams, companies, profiles
- push_subscriptions, ui_state, notes
- project_references, ref_milestones, ref_deliverables, ref_links, ref_policies (존재 시)

### 2-2. 전체 RLS 정책 목록

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

이 결과를 **테이블별로 정리**하여 문서에 기록하라.

### 2-3. projects 테이블 RLS 설계 대조

아래 설계 기준과 실제 정책을 1:1 비교하라. 누락/불일치 항목을 표시하라.

| # | 정책명 (설계) | 대상 | 조건 | 실제 존재? | 일치? |
|---|-------------|------|------|-----------|------|
| 1 | team_projects_select | SELECT | team_id IN (같은 팀 active 멤버) | ? | ? |
| 2 | personal_projects_select | SELECT | team_id IS NULL AND user_id = auth.uid() | ? | ? |
| 3 | team_projects_insert | INSERT | team_id IN (같은 팀 active 멤버) | ? | ? |
| 4 | personal_projects_insert | INSERT | team_id IS NULL AND user_id = auth.uid() | ? | ? |
| 5 | team_projects_update | UPDATE | team_id IN (같은 팀 active 멤버) | ? | ? |
| 6 | personal_projects_update | UPDATE | team_id IS NULL AND user_id = auth.uid() | ? | ? |
| 7 | team_projects_delete | DELETE | team_id IN (같은 팀 owner) | ? | ? |
| 8 | personal_projects_delete | DELETE | team_id IS NULL AND user_id = auth.uid() | ? | ? |

### 2-4. tasks 테이블 RLS 설계 대조

| # | 정책명 (설계) | 대상 | 조건 | 실제 존재? | 일치? |
|---|-------------|------|------|-----------|------|
| 1 | private_tasks_owner | ALL | scope='private' AND created_by=auth.uid() | ? | ? |
| 2 | team_tasks_select | SELECT | scope IN ('team','assigned') AND 같은 팀 | ? | ? |
| 3 | team_tasks_insert | INSERT | scope IN ('team','assigned') AND 같은 팀 | ? | ? |
| 4 | team_tasks_update | UPDATE | 같은 팀 + (owner OR created_by OR assignee_id) | ? | ? |
| 5 | team_tasks_delete | DELETE | 같은 팀 + (owner OR created_by) | ? | ? |

### 2-5. Reference 테이블 RLS (존재 시)

설계 기준: 6개 테이블 × 4개 정책(SELECT/INSERT/UPDATE/DELETE) = 24개.
조건: 팀 프로젝트면 같은 팀 멤버 CRUD, 개인 프로젝트면 본인만 CRUD.

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename LIKE 'ref_%' OR tablename = 'project_references'
ORDER BY tablename, cmd;
```

### 2-6. 나머지 테이블 RLS 확인

comments, notifications, notes, memos, push_subscriptions, ui_state 각각의 정책을 출력하고,
이전 RLS audit에서 수정된 3건(push_subscriptions, ui_state DELETE, notifications INSERT/UPDATE)이 반영되었는지 확인하라.

---

## 3단계: 프론트엔드 권한 로직 점검

### 3-1. ProjectManager 팀/개인 분기

```bash
# ProjectManager 또는 프로젝트 생성/수정 관련 컴포넌트 찾기
grep -rn "addProject\|ProjectManager\|project.*create\|project.*modal" src/ --include="*.jsx" --include="*.js" -l
```

해당 파일을 읽고 다음을 확인:
- [ ] 프로젝트 생성 시 팀/개인 선택 UI가 있는가?
- [ ] `teamId`가 있을 때만 소속 선택이 표시되는가?
- [ ] `addProject` 호출 시 `team_id` / `user_id` 분기가 있는가?
- [ ] 프로젝트 수정 시 소속 변경 불가(읽기전용)인가?
- [ ] 프로젝트 삭제 시 팀장 권한 체크가 있는가?

### 3-2. useStore의 project 관련 action

```bash
grep -n "addProject\|updateProject\|deleteProject\|loadProjects\|mapProject" src/hooks/useStore.js
```

각 함수의 전체 코드를 출력하고:
- [ ] `mapProject`에 `teamId`, `userId` 매핑이 있는가?
- [ ] `addProject`에 `team_id`, `user_id` 필드 분기가 있는가?
- [ ] `deleteProject`에 권한 체크 로직이 있는가? (프론트 가드)
- [ ] `loadAll` 또는 `loadProjects`에서 팀/개인 프로젝트를 모두 가져오는가?

### 3-3. 프로젝트 목록 렌더링의 팀/개인 구분

```bash
grep -rn "teamProject\|personalProject\|tab-divider\|team.*project.*filter\|project.*scope" src/ --include="*.jsx" --include="*.js" -l
```

- [ ] 프로젝트 탭 바에 팀/개인 구분선이 있는가?
- [ ] 프로젝트 목록에 팀/개인 뱃지가 표시되는가?
- [ ] 사이드바(존재 시)에서 프로젝트가 팀/개인으로 분리 표시되는가?

### 3-4. 프로젝트 가시성(visibility) 격리 — 핵심 보안 항목

> **원칙: 팀원 A는 팀원 B의 개인 프로젝트를 어떤 경로로도 볼 수 없어야 한다.**
> 사이드바 목록에 안 보이고, URL 직접 진입도 차단되어야 한다.

**3-4-1. 프로젝트 목록 데이터 소스 추적**

```bash
# 사이드바 또는 프로젝트 목록이 projects 데이터를 어디서 가져오는지 추적
grep -rn "useStore.*projects\|store.*projects\|projects.*filter\|getProjects\|loadProjects" src/ --include="*.jsx" --include="*.js" | grep -v "node_modules"
```

해당 코드를 읽고:
- [ ] 프로젝트 목록은 `useStore`의 `projects` 배열에서 가져오는가?
- [ ] `loadAll` 또는 `loadProjects`에서 Supabase `select('*')` 호출 시 **별도 WHERE 필터 없이 RLS에만 의존**하는가?
- [ ] 아니면 프론트에서 `projects.filter(p => p.teamId === teamId || p.userId === currentUserId)` 같은 추가 필터가 있는가?

**어떤 방식이든 상관없지만, 둘 중 하나는 반드시 작동해야 한다:**
1. RLS가 `personal_projects_select` 정책으로 남의 개인 프로젝트를 DB 레벨에서 차단하거나
2. 프론트에서 명시적으로 필터링하거나
3. (이상적) 둘 다

**3-4-2. URL 직접 진입 차단**

```bash
# 프로젝트 레이어 진입 경로 찾기
grep -rn "enterProjectLayer\|projectLayer\|selectedProjectId\|currentView.*project" src/ --include="*.jsx" --include="*.js"
```

- [ ] `enterProjectLayer(projectId)` 호출 시 해당 프로젝트가 현재 사용자의 `projects` 배열에 존재하는지 검증하는가?
- [ ] 또는 React Router URL 파라미터로 프로젝트에 진입할 경우, 존재하지 않는/접근 불가 프로젝트 ID에 대한 가드가 있는가?
- [ ] Reference 훅이 Supabase 호출 시 RLS에 의해 빈 결과를 받으면 어떻게 처리하는가? (에러 UI? 빈 화면? 리다이렉트?)

**3-4-3. 시나리오별 격리 매트릭스**

아래 4가지 경로 모두에서 팀원 B의 개인 프로젝트가 팀원 A에게 노출되지 않는지 확인하라:

| # | 접근 경로 | 차단 계층 | 확인 방법 |
|---|----------|----------|----------|
| 1 | 사이드바 프로젝트 목록 | RLS + 프론트 필터 | projects 배열에 남의 개인 프로젝트가 포함되는가? |
| 2 | 프로젝트 탭 바 (ProjectView) | 동일 | 탭 목록에 노출되는가? |
| 3 | URL/state 직접 조작으로 projectLayer 진입 | enterProjectLayer 가드 또는 Reference 훅 빈 결과 | 데이터가 로드되는가? |
| 4 | Supabase에서 ref_milestones 직접 조회 | RLS project_references → projects 체이닝 | 남의 프로젝트 reference_id로 쿼리 시 결과가 나오는가? |

**4번이 특히 중요하다:** Reference 테이블의 RLS가 `project_id`를 통해 projects 테이블의 소유권을 체크하는 구조인데, 이 체이닝이 올바르게 동작하는지 실제 정책의 `qual` 컬럼을 읽고 확인하라.

### 3-5. Task scope 라벨 표시

```bash
grep -rn "ScopeLabel\|scope.*label\|task-scope\|task.*assignee" src/ --include="*.jsx" --include="*.js" -l
```

- [ ] TodayView에 scope 라벨이 표시되는가?
- [ ] ProjectView에 담당자 + scope 표시가 있는가?
- [ ] TimelineView에 담당자 이름이 표시되는가?

---

## 4단계: 인덱스 점검

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('tasks', 'projects', 'project_references', 'ref_milestones', 'ref_deliverables', 'ref_links', 'ref_policies')
ORDER BY tablename, indexname;
```

**확인 항목:**
- [ ] tasks: team_id, scope, assignee_id, created_by, deleted_at, deliverable_id, project_id 인덱스
- [ ] projects: team_id, user_id, created_by 인덱스
- [ ] Reference 테이블: reference_id, project_id 인덱스

---

## 5단계: 트리거 및 함수 점검

```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('tasks', 'projects')
ORDER BY event_object_table, trigger_name;
```

- [ ] `tasks`에 `created_by` 자동 설정 트리거가 있는가?
- [ ] `projects`에 `created_by` 자동 설정 트리거가 있는가?
- [ ] `updated_at` 자동 갱신 트리거가 있는가?

---

## 6단계: 프로젝트 레이어 데이터 연동 점검

> 새 프로젝트 뷰(Reference 탭 / Tasks 탭 / 병렬 보기)에서
> 마일스톤·결과물·할일이 DB와 올바르게 연동되는지,
> 역할별 권한이 실제로 작동하는지 확인한다.

### 6-1. Reference 훅 → Supabase 호출 경로 추적

```bash
# Reference 관련 커스텀 훅 찾기
find src/ -name "useProjectReference*" -o -name "useRef*" -o -name "useReference*" | head -20

# Reference 탭 컴포넌트 찾기
find src/ -name "ReferenceTab*" -o -name "MilestoneItem*" -o -name "DeliverableItem*" | head -20
```

각 파일을 읽고 다음을 추적하라:

**useProjectReference (또는 동등한 훅):**
- [ ] `project_references` 테이블을 조회하는가?
- [ ] project_id로 필터링하는가?
- [ ] 레코드가 없으면 자동 생성(upsert)하는가?
- [ ] 반환값: reference 객체 + loading 상태

**useRefMilestones (또는 동등한 훅):**
- [ ] `ref_milestones` 테이블을 조회하는가?
- [ ] reference_id 또는 project_id로 필터링하는가?
- [ ] CRUD 4개 함수(add/update/delete/reorder)가 있는가?
- [ ] add 시 `created_by`, `project_id`, `reference_id` 를 올바르게 넣는가?
- [ ] delete 시 실제 DELETE인가, soft delete인가?

**useRefDeliverables (또는 동등한 훅):**
- [ ] `ref_deliverables` 테이블을 조회하는가?
- [ ] `milestone_id`로 그룹핑/필터링하는가?
- [ ] `assignee_ids` 배열을 읽고/쓰는가?
- [ ] add 시 `milestone_id` 연결이 올바른가?

**useRefLinks / useRefPolicies:**
- [ ] 각각 `ref_links`, `ref_policies` 테이블을 사용하는가?
- [ ] CRUD 함수가 존재하는가?

### 6-2. 할일 ↔ 결과물 연결 (deliverable_id)

```bash
# deliverable_id 사용처 찾기
grep -rn "deliverable_id\|deliverableId" src/ --include="*.jsx" --include="*.js"
```

- [ ] Task 생성/편집 UI에 결과물 선택(태깅) 기능이 있는가?
- [ ] `addTask` 또는 `updateTask` 호출 시 `deliverable_id`를 Supabase에 전달하는가?
- [ ] 병렬 보기 탭에서 `tasks.deliverable_id`로 결과물별 할일 그룹핑이 작동하는가?
- [ ] 결과물 삭제 시 연결된 tasks.deliverable_id가 NULL로 리셋되는가? (FK ON DELETE SET NULL)

### 6-3. Reference 컴포넌트 → 훅 → DB 데이터 흐름도

ReferenceTab.jsx(또는 동등 컴포넌트)를 읽고, 아래 흐름이 실제로 구현되어 있는지 추적하라:

```
ReferenceTab mount
  → useProjectReference(projectId)
    → Supabase: project_references WHERE project_id = ?
    → 없으면 INSERT → reference 반환
  → useRefMilestones(referenceId)
    → Supabase: ref_milestones WHERE reference_id = ?
  → useRefDeliverables(referenceId)
    → Supabase: ref_deliverables WHERE reference_id = ?
  → useRefLinks(referenceId)
  → useRefPolicies(referenceId)

사용자가 마일스톤 추가 클릭
  → addMilestone({ title, reference_id, project_id, created_by })
    → Supabase: INSERT INTO ref_milestones
    → 로컬 상태 갱신 (optimistic 또는 refetch)
    → UI 업데이트

사용자가 결과물을 마일스톤에 연결
  → updateDeliverable(id, { milestone_id })
    → Supabase: UPDATE ref_deliverables SET milestone_id = ?
```

**위 흐름에서 끊어진 지점이 있으면 명시하라.**

### 6-3-1. 데이터 영속성(persistence) 검증 — 알려진 버그 조사

> **현상: 마일스톤이나 할일을 추가하면 잠시 후 사라진다(리셋됨).**
> 이 버그의 원인을 반드시 특정하라.

가능한 원인을 아래 순서대로 코드를 추적하며 확인하라:

**원인 후보 A — Supabase INSERT가 실패하고 있다:**
```bash
# add 함수에서 Supabase 호출 후 에러 핸들링 확인
grep -A 20 "addMilestone\|insertMilestone\|\.insert\|\.upsert" src/hooks/useRef*.js src/hooks/useProjectReference*.js 2>/dev/null
```
- [ ] INSERT 호출 후 `{ error }` 를 체크하는가?
- [ ] error가 있을 때 콘솔에 출력하는가, 무시하는가?
- [ ] RLS 정책 위반으로 INSERT가 거부되고 있을 가능성? (created_by 누락, project_id 불일치 등)

**원인 후보 B — Optimistic update 후 refetch가 덮어쓴다:**
- [ ] add 함수에서 로컬 state에 먼저 추가(optimistic)한 뒤, 이어서 전체 목록을 refetch하는가?
- [ ] refetch 시점에 INSERT가 아직 완료되지 않아서 빈 결과로 덮어쓰는 race condition이 있는가?
- [ ] 또는 refetch 대신 useEffect의 dependency가 변경되어 훅이 재초기화되는가?

**원인 후보 C — 컴포넌트 언마운트/리마운트로 state가 초기화된다:**
```bash
# ReferenceTab 또는 상위 컴포넌트의 key prop 확인
grep -rn "key=\|<ReferenceTab\|<ProjectLayer" src/ --include="*.jsx" | head -20
```
- [ ] 탭 전환 시 ReferenceTab이 언마운트→리마운트되는가?
- [ ] 리마운트 시 훅의 state가 초기값(`[]`)으로 리셋된 후 Supabase 재조회하는데, INSERT가 실패해서 빈 결과인가?

**원인 후보 D — 폴링/sync가 데이터를 덮어쓴다:**
- [ ] SyncProvider 또는 기존 폴링 로직이 Reference 데이터를 주기적으로 refetch하는가?
- [ ] refetch 시 INSERT가 RLS에 의해 차단된 데이터는 누락되어 사라지는가?

**원인 후보 E — tasks 테이블과의 혼동:**
- [ ] 할일(task)이 사라지는 경우, `addTask`가 `project_id`를 올바르게 넣는가?
- [ ] `scope`, `team_id` 필드가 누락되어 RLS에 걸리는가?
- [ ] loadAll의 SELECT 쿼리에 새로 추가한 할일이 포함되는 WHERE 조건인가?

**진단 결과를 아래 형식으로 기록하라:**

```markdown
### 데이터 리셋 버그 진단
- 증상: 마일스톤/할일 추가 후 사라짐
- 원인: [A/B/C/D/E 중 해당] — [구체적 코드 위치와 설명]
- 근거: [해당 코드 스니펫]
- 수정 방향: [제안]
```

### 6-4. 할일 상세 패널(DetailPanel)의 마일스톤 표시

> **신규 요구사항:** 할일이 결과물(deliverable)에 연결되어 있고,
> 해당 결과물이 마일스톤에 속해 있다면, 상세 패널에서
> "소속 마일스톤"을 보여줘야 한다.

```bash
# DetailPanel 컴포넌트 찾기
find src/ -name "DetailPanel*" -o -name "TaskDetail*" | head -10
```

해당 파일을 읽고:

**현재 상태:**
- [ ] DetailPanel에 `deliverable_id` 관련 UI가 있는가?
- [ ] 결과물 이름이 표시되는가?
- [ ] 마일스톤 이름이 표시되는가?
- [ ] 결과물/마일스톤 연결을 변경할 수 있는 UI가 있는가?

**데이터 접근 경로:**
- [ ] task → `deliverable_id` → `ref_deliverables` → `milestone_id` → `ref_milestones` 체이닝이 가능한가?
- [ ] DetailPanel에서 이 체이닝 조회를 수행하는 코드 또는 훅이 있는가?
- [ ] 없다면, 필요한 조회 방식을 제안하라:

```
방법 A: DetailPanel에서 deliverable_id로 ref_deliverables를 조회 → milestone_id로 ref_milestones 조회
방법 B: loadAll 시 tasks에 deliverable + milestone 정보를 JOIN해서 가져옴
방법 C: 별도 훅 useTaskDeliverable(deliverableId)
```

각 방법의 장단점을 간단히 평가하라.

**보고서 출력에 포함할 항목:**

```markdown
### 상세 패널 마일스톤 표시 현황
- 현재 구현: [있음/없음]
- deliverable_id UI: [있음/없음]
- milestone 체이닝 조회: [있음/없음]
- 권장 구현 방식: [A/B/C]
- 예상 변경 파일: [파일 목록]
```

### 6-5. 역할별 권한 실동작 시나리오 분석

프론트엔드 코드를 읽고, 아래 시나리오별로 **UI 가드(버튼 숨김/비활성)** 와 **RLS 백엔드 가드** 양쪽이 구현되어 있는지 확인하라.

| # | 시나리오 | UI 가드 | RLS 가드 | 둘 다 있나? |
|---|---------|---------|---------|------------|
| 1 | 팀원 A가 팀 프로젝트의 마일스톤을 추가 | ? | team_insert (같은 팀 멤버) | ? |
| 2 | 팀원 A가 팀 프로젝트의 마일스톤을 삭제 | ? | team_delete (같은 팀 멤버) | ? |
| 3 | 팀원 A가 **다른 팀** 프로젝트의 결과물을 조회 | ? | team_select 차단 | ? |
| 4 | 팀원 A의 사이드바에 팀원 B의 **개인** 프로젝트가 **아예 안 보이는가** | projects 배열에서 제외? | personal_projects_select 차단 | ? |
| 5 | 팀원 A가 팀원 B의 개인 프로젝트 ID로 **직접 진입** 시도 (URL/state 조작) | enterProjectLayer 가드? 빈 결과 처리? | RLS로 project_references/ref_* 조회 빈 결과 | ? |
| 6 | 팀원 A가 팀원 B의 개인 프로젝트 마일스톤을 **reference_id로 직접 조회** | 불가능해야 함 | ref_milestones RLS → project_references → projects 체이닝 차단 | ? |
| 7 | 팀장이 팀 프로젝트를 삭제 | ? | team_projects_delete (owner) | ? |
| 8 | 팀원(비팀장)이 팀 프로젝트를 삭제 시도 | 버튼 숨김? | team_projects_delete 차단 | ? |
| 9 | 팀원 A가 팀 할일을 결과물에 태깅 | ? | team_tasks_update | ? |
| 10 | 팀원 A가 개인 할일을 팀 프로젝트 결과물에 태깅 | ? | scope 충돌? | ? |

**시나리오 4~6이 핵심 격리 검증이다.** 3-4절의 가시성 격리 매트릭스와 교차 확인하라.

**UI 가드 확인 방법:**
```bash
# 삭제 버튼 조건 렌더링 찾기
grep -rn "owner\|isOwner\|myRole\|canDelete\|canEdit" src/ --include="*.jsx" --include="*.js" | grep -i "project\|milestone\|deliverable\|reference"
```

### 6-6. Tasks 탭 ↔ 글로벌 뷰 동기화 확인

```bash
# Tasks 탭 컴포넌트 찾기
find src/ -name "TasksTab*" -o -name "ProjectTasksTab*" | head -10
```

해당 컴포넌트를 읽고:
- [ ] Task CRUD가 **기존 useStore의 addTask/updateTask/deleteTask**를 사용하는가?
  - (YES면 글로벌 뷰와 자동 동기화됨)
  - (NO면 별도 Supabase 호출이고, 글로벌 뷰와 동기화 끊김 — **심각한 문제**)
- [ ] Tasks 탭에서 할일 완료 체크 → TodayView/MatrixView에서 즉시 반영되는가? (코드 경로 추적)
- [ ] Tasks 탭에서 프로젝트 필터가 `selectedProjectId`를 사용하는가?

---

## 7단계: 엣지 케이스 및 데이터 정합성

### 7-1. 프로젝트 삭제 시 cascade 동작

```sql
-- project_references FK 확인
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (tc.table_name LIKE 'ref_%' OR tc.table_name = 'project_references')
ORDER BY tc.table_name;
```

- [ ] `project_references.project_id`는 projects에 FK가 있는가? (설계상 text 타입이라 DB-level FK 없을 수 있음)
- [ ] `ref_milestones` → `project_references` ON DELETE CASCADE인가?
- [ ] `ref_deliverables` → `project_references` ON DELETE CASCADE인가?
- [ ] `ref_deliverables` → `ref_milestones` ON DELETE SET NULL인가?
- [ ] 프로젝트 삭제 시 Reference 데이터가 고아(orphan)로 남지 않는가?

### 7-2. 빈 프로젝트 진입 시 동작

- [ ] Reference 탭에 진입했을 때 project_references 레코드가 없으면 자동 생성하는가?
- [ ] 마일스톤 0개, 결과물 0개일 때 빈 상태(empty state) UI가 있는가?
- [ ] Tasks 탭에서 해당 프로젝트의 할일이 0개일 때 빈 상태 UI가 있는가?

### 7-3. 팀/개인 프로젝트 전환 불가 제약

- [ ] 프론트엔드에서 프로젝트 수정 시 team_id/user_id 변경을 차단하는가?
- [ ] 만약 API를 직접 호출해서 team_id를 바꾸면 RLS가 차단하는가? (USING 조건 분석)

---

## 출력 형식

`audit-report-project-permissions.md` 파일에 아래 구조로 작성하라:

```markdown
# 프로젝트 DB/권한 점검 보고서
> 점검일: [날짜]
> 점검 대상: projects, tasks, Reference 5개 테이블, 팀 관련 6개 테이블

## 1. DB 테이블 현황
### projects
(컬럼 목록 + CHECK 제약조건)

### tasks (팀 관련 컬럼)
(컬럼 목록)

### Reference 테이블
(존재 여부 + 컬럼 목록)

### 팀 관련 테이블
(컬럼 목록)

## 2. RLS 정책 현황
### 전체 정책 목록
(테이블별 정리)

### 설계 대조표
#### projects
(8개 정책 대조)

#### tasks
(5개 정책 대조)

#### Reference 테이블
(24개 정책 대조 — 테이블 존재 시)

#### 기타 테이블
(comments, notifications 등)

## 3. 프론트엔드 권한 로직
### ProjectManager
(팀/개인 분기 현황)

### useStore project actions
(매핑/분기 현황)

### UI 라벨/뱃지
(팀/개인 구분 표시 현황)

## 4. 인덱스 현황
(테이블별 인덱스 목록)

## 5. 트리거/함수 현황
(created_by, updated_at 트리거)

## 6. 프로젝트 레이어 데이터 연동
### Reference 훅 → DB 호출 경로
(각 훅별 호출 테이블/필터/CRUD 함수 현황)

### 데이터 리셋 버그 진단
(증상/원인/근거/수정 방향)

### 상세 패널 마일스톤 표시 현황
(현재 구현 여부 + 체이닝 조회 + 권장 방식)

### 할일 ↔ 결과물 연결
(deliverable_id 사용처 + 양방향 동작)

### 데이터 흐름도
(ReferenceTab → 훅 → Supabase 경로, 끊어진 지점)

### 역할별 권한 시나리오
(10개 시나리오 × UI 가드 + RLS 가드 대조표)

### Tasks 탭 ↔ 글로벌 뷰 동기화
(useStore 공유 여부 + 경로 추적)

## 7. 엣지 케이스 및 데이터 정합성
### FK cascade 동작
(프로젝트 삭제 시 Reference 데이터 처리)

### 빈 프로젝트 / 전환 불가 제약
(empty state + team_id 변경 차단)

## 8. 불일치/누락 요약

| # | 영역 | 항목 | 설계 | 실제 | 조치 필요 |
|---|------|------|------|------|----------|
| 1 | ... | ... | ... | ... | ... |
| 2 | ... | ... | ... | ... | ... |

## 9. 권장 조치 우선순위
1. (가장 시급한 항목)
2. ...
```

**중요: SQL 쿼리 결과는 원본 그대로 포함하라. 해석이나 추측 없이 팩트만 기록한 후, 마지막 섹션 6~7에서 분석 결과를 정리하라.**
