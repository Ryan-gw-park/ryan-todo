# 프로젝트 DB/권한 점검 보고서
> 점검일: 2026-03-16
> 점검 대상: projects, tasks, Key Milestone 5개 테이블, 팀 관련 6개 테이블

---

## 1. DB 테이블 현황

### 1-1. projects 테이블 (SQL 실행 필요)

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

**CHECK 제약조건 확인:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.projects'::regclass AND contype = 'c';
```

### 1-2. tasks 테이블 팀 관련 컬럼 (SQL 실행 필요)

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tasks'
AND column_name IN ('team_id', 'scope', 'assignee_id', 'created_by', 'deleted_at', 'deliverable_id', 'project_id', 'key_milestone_id')
ORDER BY ordinal_position;
```

**확인 항목:**
- [ ] `team_id` — uuid, nullable
- [ ] `scope` — text (값: 'private', 'team', 'assigned')
- [ ] `assignee_id` — uuid, nullable
- [ ] `created_by` — uuid, nullable
- [ ] `deleted_at` — timestamptz, nullable (Loop-23 soft delete)
- [ ] `key_milestone_id` — uuid, nullable (Loop-26 마일스톤 연결)
- [ ] `project_id` — text, nullable

### 1-3. Key Milestone 테이블 존재 확인 (SQL 실행 필요)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'project_key_milestones',
  'key_milestones',
  'key_deliverables',
  'key_links',
  'key_policies'
);
```

**각 테이블 컬럼 확인:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'project_key_milestones'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'key_milestones'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'key_deliverables'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'key_links'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'key_policies'
ORDER BY ordinal_position;
```

### 1-4. 팀 관련 기존 테이블 (SQL 실행 필요)

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('companies', 'teams', 'team_members', 'profiles', 'comments', 'notifications')
ORDER BY table_name, ordinal_position;
```

---

## 2. RLS 정책 현황

### 2-1. RLS 활성화 상태 (SQL 실행 필요)

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### 2-2. 전체 RLS 정책 목록 (SQL 실행 필요)

```sql
SELECT
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

### 2-3. Key Milestone 테이블 RLS (SQL 실행 필요)

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename LIKE 'key_%' OR tablename = 'project_key_milestones'
ORDER BY tablename, cmd;
```

---

## 3. 프론트엔드 권한 로직

### 3-1. ProjectManager.jsx 분석 결과

**파일 위치:** `src/components/shared/ProjectManager.jsx`

| 항목 | 구현 여부 | 위치 |
|------|----------|------|
| 팀/개인 선택 UI | ✅ 있음 | L126-131 |
| teamId 조건부 표시 | ✅ 있음 | `currentTeamId &&` 조건 |
| addProject 팀/개인 분기 | ✅ 있음 | L29-34 |
| 소속 변경 불가 (읽기전용) | ✅ 있음 | L77-79 |
| 삭제 시 팀장 권한 체크 | ✅ 있음 | L97-108 |

**삭제 권한 로직:**
```javascript
const canDelete = p.teamId ? myRole === 'owner' : (!currentTeamId || p.userId === getCachedUserId())
```

### 3-2. useStore.js project 관련 action

**파일 위치:** `src/hooks/useStore.js`

#### mapProject (L100-107)
```javascript
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    teamId: r.team_id || null,
    userId: r.user_id || null,
  }
}
```
- ✅ `teamId`, `userId` 매핑 있음

#### addProject (L481-498)
```javascript
addProject: async (name, color, projectScope) => {
  const teamId = get().currentTeamId
  const userId = await getCurrentUserId()
  const p = {
    teamId: (teamId && projectScope !== 'personal') ? teamId : null,
    userId: (!teamId || projectScope === 'personal') ? userId : null,
  }
  // ...
}
```
- ✅ `team_id`, `user_id` 분기 있음

#### deleteProject (L513-538)
- ⚠️ 프론트에서 권한 체크 없음 (UI에서만 차단, RLS 의존)

### 3-3. 프로젝트 가시성 격리

#### loadAll 프로젝트 필터링 (L280-287)
```javascript
if (teamId) {
  const uid = _cachedUserId || (await d.auth.getUser()).data?.user?.id
  projectsQuery = projectsQuery.or(`team_id.eq.${teamId},user_id.eq.${uid}`)
}
```
- ✅ 팀 모드: 팀 프로젝트 + 본인 개인 프로젝트만 로드
- ✅ RLS + DB 필터 병행

#### Sidebar 프론트 필터 (L25-28)
```javascript
const teamProjects = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId && currentTeamId))
const personalProjects = sortProjectsLocally(projects.filter(p => !p.teamId))
```
- ✅ 클라이언트 측 추가 필터링

#### ProjectLayer 접근 제어 (L15-16)
```javascript
const project = projects.find(p => p.id === selectedProjectId)
if (!project) {
  return <div>프로젝트를 선택하세요</div>
}
```
- ✅ 존재하지 않는 프로젝트 접근 시 폴백 UI
- ⚠️ URL 직접 진입은 불가능 (상태 기반 네비게이션만)

---

## 4. 인덱스 현황 (SQL 실행 필요)

```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('tasks', 'projects', 'project_key_milestones', 'key_milestones', 'key_deliverables', 'key_links', 'key_policies')
ORDER BY tablename, indexname;
```

---

## 5. 트리거/함수 현황 (SQL 실행 필요)

```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('tasks', 'projects', 'key_milestones', 'key_deliverables')
ORDER BY event_object_table, trigger_name;
```

---

## 6. 프로젝트 레이어 데이터 연동

### 6-1. Key Milestone 훅 → Supabase 호출 경로

| 훅 | 테이블 | 필터 조건 | CRUD 함수 |
|---|--------|----------|----------|
| useProjectKeyMilestone | project_key_milestones | project_id | load, (auto-create) |
| useKeyMilestones | key_milestones | pkm_id | add, update, remove, reorder |
| useKeyDeliverables | key_deliverables | pkm_id | add, update, remove, getByMilestone |
| useKeyLinks | key_links | pkm_id | add, update, remove |
| useKeyPolicies | key_policies | pkm_id | add, update, remove |

### 6-2. created_by 설정 상태

| 훅 | created_by 설정 | 상태 |
|---|-----------------|------|
| useProjectKeyMilestone | ❌ 미설정 | 🔴 버그 |
| useKeyMilestones.add() | ❌ 미설정 | 🔴 버그 |
| useKeyDeliverables.add() | ❌ 미설정 | 🔴 버그 |
| useKeyLinks.add() | ❌ 미설정 | 🔴 버그 |
| useKeyPolicies.add() | ❌ 미설정 | 🔴 버그 |

**영향:** RLS 정책에서 `created_by = auth.uid()` 조건 사용 시 INSERT 실패 가능

### 6-3. 데이터 흐름도

```
KeyMilestoneTab mount
  → useProjectKeyMilestone(projectId)
    → Supabase: project_key_milestones WHERE project_id = ?
    → 없으면 INSERT (created_by 미설정 ⚠️)
  → useKeyMilestones(pkm.id, projectId)
    → Supabase: key_milestones WHERE pkm_id = ?
  → useKeyDeliverables(pkm.id, projectId)
    → Supabase: key_deliverables WHERE pkm_id = ?
  → useKeyLinks / useKeyPolicies (하단 접힌 섹션)

사용자가 마일스톤 추가 클릭
  → add() 호출
    → Supabase: INSERT INTO key_milestones (pkm_id, project_id, title, sort_order)
    → created_by 미설정 ⚠️
    → 로컬 상태 갱신
```

### 6-4. 할일 ↔ 마일스톤 연결

| 항목 | 구현 여부 |
|------|----------|
| keyMilestoneId 매핑 (mapTask) | ✅ 있음 (L123) |
| keyMilestoneId 저장 (taskToRow) | ✅ 있음 (L70) |
| Task 생성 시 keyMilestoneId 전달 | ✅ 있음 |
| deliverable_id 매핑 | ❌ 없음 |
| deliverable_id 저장 | ❌ 없음 |

### 6-5. DetailPanel 마일스톤 표시 현황

| 항목 | 구현 여부 |
|------|----------|
| deliverable_id UI | ❌ 없음 |
| 결과물 이름 표시 | ❌ 없음 |
| 마일스톤 이름 표시 | ❌ 없음 |
| 마일스톤 체이닝 조회 | ❌ 없음 |

### 6-6. Tasks 탭 ↔ 글로벌 뷰 동기화

**현황:** ✅ 완벽한 동기화

TasksTab → MilestoneOutlinerView → useStore의 addTask/updateTask/deleteTask 사용

**데이터 흐름:**
```
TasksTab.addTask()
  → useStore.addTask()
    → state.tasks 업데이트 (Zustand)
    → Supabase upsert
    → 모든 구독 컴포넌트 재렌더링 (TodayView, AllTasksView 등)
```

---

## 7. 엣지 케이스 및 데이터 정합성

### 7-1. FK cascade 동작 (SQL 실행 필요)

```sql
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
AND (tc.table_name LIKE 'key_%' OR tc.table_name = 'project_key_milestones')
ORDER BY tc.table_name;
```

### 7-2. 빈 프로젝트 진입 시 동작

| 항목 | 구현 여부 |
|------|----------|
| PKM 레코드 자동 생성 | ✅ 있음 |
| 마일스톤 0개 시 empty state | ✅ 있음 ("마일스톤을 추가하여...") |
| Tasks 탭 empty state | ✅ 있음 |

### 7-3. 팀/개인 프로젝트 전환 불가 제약

| 항목 | 구현 여부 |
|------|----------|
| 프론트 UI 차단 | ✅ 있음 (읽기전용) |
| RLS 차단 | 🔍 SQL 확인 필요 |

---

## 8. 불일치/누락 요약

| # | 영역 | 항목 | 설계 | 실제 | 조치 필요 |
|---|------|------|------|------|----------|
| 1 | Key Milestone 훅 | created_by 설정 | 모든 add()에서 설정 | 미설정 | 🔴 필수 |
| 2 | DetailPanel | 마일스톤 이름 표시 | 연결된 마일스톤 표시 | 없음 | 🟡 권장 |
| 3 | DetailPanel | 결과물 표시 | deliverable 체이닝 | 없음 | 🟢 선택 |
| 4 | useStore | deliverable_id 매핑 | mapTask/taskToRow에 포함 | 없음 | 🟢 선택 |
| 5 | deleteProject | 프론트 권한 체크 | 함수 내 권한 검증 | UI에서만 차단 | 🟡 권장 |
| 6 | updateProject | teamId/userId 변경 차단 | 업데이트 쿼리에서 제외 | 포함됨 | 🟡 권장 |

---

## 9. 권장 조치 우선순위

### 🔴 필수 (데이터 정합성 영향)
1. **모든 Key Milestone 훅의 add() 함수에 created_by 추가**
   - useProjectKeyMilestone: 자동 생성 시
   - useKeyMilestones.add()
   - useKeyDeliverables.add()
   - useKeyLinks.add()
   - useKeyPolicies.add()

   ```javascript
   // 예시: useKeyMilestones.js
   async function add() {
     const userId = (await getDb().auth.getUser()).data?.user?.id
     const { data } = await db.from('key_milestones').insert({
       pkm_id: pkmId,
       project_id: projectId,
       title: '',
       sort_order: milestones.length,
       created_by: userId,  // 추가
     }).select().single()
   }
   ```

### 🟡 권장 (보안 강화)
2. **deleteProject 함수 내 권한 체크 추가**
3. **updateProject에서 teamId/userId 필드 명시적 제외**
4. **DetailPanel에 마일스톤 이름 표시**

### 🟢 선택 (기능 확장)
5. **deliverable_id 매핑 추가** (Task ↔ 결과물 연결 UI 필요 시)

---

## 10. SQL 쿼리 실행 체크리스트

Supabase SQL Editor에서 아래 순서로 실행하고 결과를 이 문서에 붙여넣기:

- [ ] 1-1. projects 컬럼
- [ ] 1-1. projects CHECK 제약조건
- [ ] 1-2. tasks 팀 관련 컬럼
- [ ] 1-3. Key Milestone 테이블 존재
- [ ] 1-3. 각 테이블 컬럼
- [ ] 1-4. 팀 관련 테이블 컬럼
- [ ] 2-1. RLS 활성화 상태
- [ ] 2-2. 전체 RLS 정책 목록
- [ ] 2-3. Key Milestone RLS
- [ ] 4. 인덱스 현황
- [ ] 5. 트리거/함수 현황
- [ ] 7-1. FK cascade 동작
