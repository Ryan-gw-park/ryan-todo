# Agent 체계 코드베이스 진단 보고서

> 생성일: 2026-03-18
> 대상: ryan-todo 프로젝트 (React + Supabase + Zustand)

---

## 1. Schema Guardian

### 1-1. 테이블 인벤토리 (총 20개)

**기존 테이블 (5개)** — 마이그레이션 이전부터 존재

| 테이블 | PK 타입 | PK 컬럼 |
|--------|---------|---------|
| `tasks` | text | `id` (프론트엔드 생성) |
| `projects` | text | `id` (프론트엔드 생성) |
| `memos` | text | `id` (프론트엔드 생성) |
| `push_subscriptions` | unknown | unknown |
| `ui_state` | text | `id` |

**신규 테이블 (15개)** — 마이그레이션으로 생성

| 테이블 | PK 타입 | 생성 시점 | 상위 FK |
|--------|---------|----------|---------|
| `profiles` | uuid (= auth.users.id) | Loop-17 | auth.users |
| `companies` | uuid | Loop-17 | profiles |
| `teams` | uuid | Loop-17 | companies, profiles |
| `team_members` | uuid | Loop-17 | teams, profiles |
| `team_invitations` | uuid | Loop-17 | teams, profiles |
| `comments` | uuid | Loop-17 | profiles |
| `notifications` | uuid | Loop-17 | teams, profiles |
| `matrix_row_config` | uuid | Loop-17 | profiles, teams |
| `user_task_settings` | uuid | Loop-24 | profiles |
| `project_key_milestones` | uuid | Loop-26 | auth.users |
| `key_milestones` | uuid | Loop-26 | project_key_milestones, auth.users |
| `key_deliverables` | uuid | Loop-26 | key_milestones, project_key_milestones, auth.users |
| `key_links` | uuid | Loop-26 | project_key_milestones, auth.users |
| `key_policies` | uuid | Loop-26 | project_key_milestones, auth.users |

### 1-2. 주요 테이블 컬럼 정의

#### `tasks` (기존 + 10개 컬럼 추가)

```
tasks
├── id               text           PK (frontend-generated)
├── text             text           task title
├── project_id       text           app-level ref to projects.id (NO FK constraint)
├── category         text           'today' | 'next' | 'backlog'
├── done             boolean        completion flag
├── due_date         date/text      nullable
├── start_date       date/text      nullable
├── notes            text           description body
├── prev_category    text           undo buffer
├── sort_order       integer        display ordering
├── alarm            jsonb          nullable
├── created_at       timestamptz
│── Loop-17 ────────────────────────────────────────────────
├── scope            text           DEFAULT 'private'
├── team_id          uuid           nullable
├── assignee_id      uuid           nullable
├── created_by       uuid           nullable (auto-filled by trigger)
├── highlight_color  text           nullable
├── updated_at       timestamptz    DEFAULT now()
│── Loop-23 ────────────────────────────────────────────────
├── deleted_at       timestamptz    DEFAULT NULL (soft delete)
│── Loop-26 ────────────────────────────────────────────────
├── deliverable_id   uuid           FK ref_deliverables(id) ON DELETE SET NULL
├── key_milestone_id uuid           FK key_milestones(id) ON DELETE SET NULL
│
│   CHECK valid_scope:
│     (scope='private' AND team_id IS NULL AND assignee_id IS NULL) OR
│     (scope='team' AND team_id IS NOT NULL AND assignee_id IS NULL) OR
│     (scope='assigned' AND team_id IS NOT NULL AND assignee_id IS NOT NULL)
```

#### `projects` (기존 + 9개 컬럼 추가)

```
projects
├── id               text           PK (frontend-generated)
├── name             text
├── color            text
├── sort_order       integer
│── Loop-17 ────────────────────────────────────────────────
├── team_id          uuid           nullable (NULL = personal)
├── user_id          uuid           nullable (auto-filled)
├── created_by       uuid           nullable
├── is_archived      boolean        DEFAULT false
├── updated_at       timestamptz    DEFAULT now()
│── Loop-27 ────────────────────────────────────────────────
├── owner_id         uuid           FK auth.users(id) ON DELETE SET NULL
│── Loop-32 ────────────────────────────────────────────────
├── description      text           DEFAULT ''
├── start_date       date           DEFAULT NULL
├── due_date         date           DEFAULT NULL
├── status           text           DEFAULT 'active'
│
│   CHECK project_ownership:
│     (team_id IS NOT NULL AND user_id IS NULL) OR
│     (team_id IS NULL AND user_id IS NOT NULL)
│   CHECK projects_status_check:
│     status IN ('active','on_hold','completed','archived')
```

#### 기타 테이블 요약

- **`memos`**: text PK, user_id 추가 (Loop-17). `set_updated_at` 트리거 누락
- **`profiles`**: uuid PK (= auth.users.id), email, display_name, avatar_url
- **`teams`**: uuid PK, company_id, name, invite_code (UNIQUE), auto_approve
- **`team_members`**: uuid PK, UNIQUE(team_id, user_id), role/status/display_name. **updated_at 없음**
- **`comments`**: uuid PK, task_id text (FK 없음), author_id
- **`notifications`**: uuid PK, team_id, actor_id, target_user_id. **updated_at 없음**
- **`key_milestones`**: uuid PK, pkm_id FK, project_id text, owner_id, status, color

### 1-3. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 1-1 | **HIGH** | **Migration chain broken**: `supabase/migrations/`에 `ref_*` 테이블 생성만 존재. `key_*`로의 rename 마이그레이션이 `docs/migrations/`에만 존재하여 Supabase migration chain 외부. 새 환경 배포 시 스키마 깨짐 |
| ⚠️ 1-2 | **HIGH** | **notifications에 updated_at 컬럼 없음**: Loop-23에서 `idx_notifications_updated` 인덱스 생성 시도하지만 대상 컬럼 부재. 마이그레이션 에러 가능 |
| ⚠️ 1-3 | **HIGH** | **team_invitations에 DELETE RLS 정책 없음**: 프론트에서 `delete()` 호출 시 RLS에 의해 silent deny |
| ⚠️ 1-4 | MEDIUM | **memos에 set_updated_at 트리거 누락**: updated_at이 생성 시점에서 고정 |
| ⚠️ 1-5 | MEDIUM | **team_members에 updated_at 컬럼 없음**: CLAUDE.md 원칙("updated_at index required on all synced tables") 위반 |
| ⚠️ 1-6 | LOW | push_subscriptions.user_id가 text 타입 (uuid가 아님). RLS에서 `::uuid` 캐스트 사용 |
| ⚠️ 1-7 | LOW | comments.task_id, notifications.task_id에 FK 제약 없음 (의도적이나 고아 레코드 가능) |
| ⚠️ 1-8 | INFO | Loop-32에서 projects.created_by, key_milestones.created_by 중복 추가 (IF NOT EXISTS로 무해) |

---

## 2. Permission Guard

### 2-1. RLS 정책 전수 목록

**RLS 활성화 테이블: 16개** (+ reference 테이블 5개)

#### SECURITY DEFINER 헬퍼 함수 (재귀 방지)

| 함수 | 반환 | 용도 |
|------|------|------|
| `get_my_team_ids()` | `SETOF uuid` | active 멤버인 팀 ID |
| `get_my_owner_team_ids()` | `SETOF uuid` | owner 역할인 팀 ID |
| `get_my_team_member_ids()` | `SETOF uuid` | 같은 팀 유저 ID (profiles용) |

#### 주요 테이블 정책 요약

| 테이블 | 정책 수 | 핵심 분기 |
|--------|---------|----------|
| `tasks` | 9 | private=created_by / team=get_my_team_ids() / update=owner+creator+assignee+member_assign |
| `projects` | 8 | private=user_id / team=get_my_team_ids() / delete=owner만 |
| `teams` | 5 | select=멤버+invite_code / CUD=owner |
| `team_members` | 4 | select=팀원 / CUD=owner 또는 본인 |
| `comments` | 4 | select=팀원 / CUD=본인 / delete=본인+팀장 |
| `notifications` | 3 | select=owner+target+actor / insert=actor / update=target |
| `profiles` | 2 | ALL=본인 / select=팀원 |

### 2-2. Frontend 권한 분기

**`isOwner` 기반 분기** (4개 컴포넌트):
- `DetailPanel.jsx`: canEdit/canDelete 계산
- `CommentSection.jsx`: 타인 댓글 삭제
- `TeamMatrixView.jsx`: 다른 멤버 행 readOnly
- `TeamSettings.jsx`: 팀 설정 전체 제어

**canEdit/canDelete 로직**:
```js
const canEdit = !currentTeamId || isMyTask || isOwner
const canDelete = !currentTeamId || task.createdBy === myUserId || isOwner
```

**Scope-CRUD 권한 매트릭스**:

| 작업 | private | team | assigned |
|------|---------|------|----------|
| SELECT (DB) | created_by만 | 팀 전체 | 팀 전체 |
| UPDATE (DB) | created_by만 | **팀 전체** (member_assign 포함) | **팀 전체** |
| UPDATE (FE) | 항상 | owner/creator/assignee만 | owner/creator/assignee만 |
| DELETE (DB) | created_by만 | owner/created_by만 | owner/created_by만 |

### 2-3. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 2-1 | **HIGH** | **team_tasks_member_assign 과도한 UPDATE 권한**: permissive 정책 OR 결합으로 팀 전체 멤버가 DB 레벨에서 타인 할일의 모든 컬럼 수정 가능. 프론트 readOnly에만 의존 |
| ⚠️ 2-2 | MEDIUM | **projects_team_update가 모든 팀원에게 개방**: owner만 삭제 가능하지만 UPDATE는 전체 멤버에게 열림 |
| ⚠️ 2-3 | MEDIUM | **comments_select가 private 할일 댓글 노출 가능**: scope 체크 없이 team_id 기준으로만 필터링 |
| ⚠️ 2-4 | LOW | team_invitations에 DELETE 정책 없음 (1-3과 동일) |
| ⚠️ 2-5 | LOW | notifications에 DELETE 정책 없음. expires_at 기반 서버 정리에 의존 필요 |
| ⚠️ 2-6 | LOW | ui_state 테이블 `USING(true)` — 모든 인증 유저가 단일 row 공유, 팀 격리 없음 |
| ⚠️ 2-7 | INFO | getCachedUserId 이중 구현 (auth.js async + useStore.js sync). auth.js 버전 dead code 가능 |
| ⚠️ 2-8 | INFO | CLAUDE.md에 명시된 Magic Link 인증이 AuthForm.jsx에 미구현 |
| ⚠️ 2-9 | INFO | companies 테이블 RLS 활성 + 정책 0개 = 모든 접근 거부 |

---

## 3. View Consistency

### 3-1. 뷰 목록 및 라우팅

**13개 뷰/패널 컴포넌트** 존재. React Router는 최상위만, 메인 뷰는 Zustand `currentView`로 전환:

```
currentView: today | allTasks | matrix | project | timeline | memory | projectLayer
  matrix → teamId ? TeamMatrixView : MatrixView (유일한 팀/개인 분기)
```

**네비게이션 표면 3개** (Sidebar, BottomNav, Keyboard) — 뷰 목록 불일치

### 3-2. Store 의존성

- 단일 Zustand store (`useStore.js`, 955줄), 미들웨어 없음
- 모든 뷰가 `tasks`/`projects` 배열을 공유 → `set()` 호출 시 전체 리렌더
- Optimistic update → Async DB → Polling(팀 모드) 3단계 흐름

### 3-3. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 3-1 | LOW | 네비게이션 3개 표면(Sidebar/BottomNav/Keyboard)의 뷰 목록 불일치 |
| ⚠️ 3-2 | MEDIUM | **모바일 dead-end**: BottomNav에 matrix/timeline 탭 표시되지만 AppShell이 today로 강제 리다이렉트 |
| ⚠️ 3-3 | LOW | Keyboard VIEW_ORDER에 allTasks, projectLayer 미포함 |
| ⚠️ 3-4 | MEDIUM | **Highlight color 비반응적 읽기**: getState()로 읽어 폴링 업데이트 시 리렌더 안 됨 (TodayView, AllTasksView, TeamMatrixView) |
| ⚠️ 3-5 | LOW | MatrixView가 useProjectFilter 대신 sortProjectsLocally() 직접 사용 (코드 경로 분기) |
| ⚠️ 3-6 | LOW | ProjectView active tab은 useState (리셋됨) vs ProjectLayer는 store 상태 (유지됨) — UX 불일치 |
| ⚠️ 3-7 | LOW | TodayView 인사말 "Ryan" 하드코딩. store의 userName 미사용 |
| ⚠️ 3-8 | MEDIUM | **SYNC_TABLES에 projects/memos 미포함**: 팀원의 프로젝트 변경이 loadAll() 전까지 안 보임 |
| ⚠️ 3-9 | MEDIUM | /team/settings, /profile 등이 SyncProviderWrapper 외부 렌더링 — 해당 페이지에서 폴링 중단 |
| ⚠️ 3-10 | LOW | Optimistic update 실패 시 롤백 없음. loadAll()에서 silent revert |

---

## 4. Card + Interaction

### 4-1. 핵심 함수 시그니처

| 함수 | 위치 | 역할 |
|------|------|------|
| `addTask(task)` | useStore:455 | effectiveTeamId 결정 → 기본값 병합 → optimistic push → safeUpsertTask |
| `updateTask(id, patch)` | useStore:476 | applyTransitionRules → optimistic merge → safeUpsertTask |
| `toggleDone(id)` | useStore:514 | updateTask({done}) 위임 + 300ms toast undo |
| `applyTransitionRules(task, patch)` | useStore:25 | 순수 함수. 7개 비즈니스 규칙(R1-R7) 적용하여 patch 확장 |

### 4-2. DnD 구현

**8개 독립 DndContext** across 6 files (MatrixView, TodayView, TeamMatrixView, TimelineEngine, CompactTaskList, MilestoneOutlinerView×2, CompactMilestoneTab)

**Collision detection 불일치**:
- MatrixView: default (rectIntersection)
- TeamMatrixView: custom `matrixCollision` (pointerWithin + fallback)
- TodayView, MilestoneOutlinerView, KeyMilestoneTab: closestCenter
- CompactTaskList, CompactMilestoneTab: pointerWithin

### 4-3. Click vs Drag 분리 (5중 메커니즘)

1. **dnd-kit activationConstraint** (distance: 3px / delay: 200ms)
2. **UniversalCard Zone stopPropagation** (StatusZone, TitleZone, DetailZone)
3. **Mobile drag listener 제거** (`!isMobile ? listeners : undefined`)
4. **TimelineGrid raw mouse 5px threshold** (dnd-kit 미사용)
5. **isDragging visual feedback** (opacity: 0.3)

### 4-4. 인라인 편집

**TitleZone**: click → input → Enter/blur(save) / Escape(cancel). `onMouseDown: stopPropagation`으로 DnD 격리.

**Title save pipeline**: `parseDateFromText(text)` → startDate/dueDate 자동 추출 → updateTask

### 4-5. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 4-1 | MEDIUM | **Collision detection 불일치**: 개인 MatrixView(rectIntersection) vs 팀 TeamMatrixView(custom). 사용자 경험 차이 발생 가능 |
| ⚠️ 4-2 | LOW | TouchSensor delay 불일치: TeamMatrixView(120ms) vs 나머지(200ms) |
| ⚠️ 4-3 | LOW | CompactTaskList PointerSensor distance(5) vs 표준(3) |
| ⚠️ 4-4 | MEDIUM | **MilestoneOutlinerView, KeyMilestoneTab에 sensor 미설정**: dnd-kit 기본값(0px threshold)으로 1px 이동에도 드래그 시작 가능 |
| ⚠️ 4-5 | INFO | TimelineGrid가 raw mousedown/up 사용 (dnd-kit와 별도 패러다임) |
| ⚠️ 4-6 | LOW | TitleZone onBlur가 무조건 save() 호출 — 의도치 않은 저장 가능 |
| ⚠️ 4-7 | LOW | MilestoneTaskChip에 drag listeners + onClick 동시 부착. sensor 설정 변경 시 click 깨질 수 있음 |
| ⚠️ 4-8 | INFO | 8개 독립 DndContext에 공유 설정 팩토리 없음 → 불일치의 근본 원인 |

---

## 5. Design System

### 5-1. 색상 시스템

- **프로젝트 색상**: 8색 (`src/utils/colors.js`), 각 4개 시맨틱 값 (card/header/text/dot)
- **하이라이트 색상**: 5색 (red/orange/yellow/blue/green) — **4개 파일에 중복 정의**
- **카테고리**: 4종 (today/next/backlog/done)

### 5-2. 타이포그래피

- **폰트**: Noto Sans KR + Inter (Google Fonts)
- **Primary text**: `#37352f` (Notion style) + `#2C2C2A` 혼용 (162회/59파일)
- **Grey scale**: 토큰 없이 하드코딩 (#888, #999, #aaa 등 — 247회/54파일)

### 5-3. 스타일 패턴

- **인라인:className 비율 = 60:1** (1,322 vs 22)
- CSS 파일: `global.css` 1개 (102줄)만 존재
- CSS 변수 사용: **0건** (의도적 방침)
- className은 hover/media query 등 CSS 필수 시에만 사용

### 5-4. 모바일 반응형

- **Breakpoint**: `window.innerWidth < 768` 일관
- **16+ 컴포넌트**가 render-time snapshot (resize 미구독)
- iOS 대응: 16px font-size (zoom 방지), env(safe-area-inset-bottom)

### 5-5. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 5-1 | MEDIUM | **HIGHLIGHT_COLORS 4개 파일 중복** + 구조 불일치 (객체 3곳 vs 배열 1곳) |
| ⚠️ 5-2 | LOW | Primary text color 혼용 (#37352f vs #2C2C2A) |
| ⚠️ 5-3 | LOW | Grey scale 색상 토큰 없이 하드코딩 (54개 파일, 247회) |
| ⚠️ 5-4 | MEDIUM | **isMobile 렌더 스냅샷**: 16+ 컴포넌트가 resize 미구독, 화면 회전 시 전환 안 됨 |
| ⚠️ 5-5 | LOW | TouchSensor delay 불일치 (TeamMatrixView 120ms vs 나머지 200ms) |
| ⚠️ 5-6 | LOW | HelpPage에 `borderLeft: '3px solid #f0c36d'` 컬러 보더 |
| ⚠️ 5-7 | INFO | CSS 변수 0건, 인라인 스타일 압도적 — 의도적 설계 |
| ⚠️ 5-8 | INFO | 동일 스타일 객체 다수 파일 반복 정의 (모달 백드롭, 버튼 기본 등) |

---

## 6. Sync + Performance

### 6-1. 폴링 구현

- **인터벌**: 10초 (`POLL_INTERVAL_MS = 10_000`)
- **대상 테이블**: `['tasks', 'notifications']` (SYNC_TABLES)
- **활성화 조건**: 팀 모드에서만 (개인 모드 차단)
- **visibilityState**: 탭 숨김 시 중지, 복귀 시 loadAll() + 재시작
- **Delta sync**: `updated_at` 기준 (notifications는 `created_at`)
- **Idempotency**: `id + updatedAt` 비교로 중복 적용 방지

### 6-2. Supabase 쿼리

- `select('*')`: 12건 (폴링 포함)
- Optimistic update: 3단계 (로컬 set → DB upsert → syncStatus 전환)
- **롤백 없음**: DB 에러 시 console.error만, 로컬 상태 유지

### 6-3. 번들/성능

- **런타임 의존성 8개**: react, react-dom, react-router-dom, @supabase/supabase-js, zustand, @dnd-kit/core+sortable+utilities
- **manualChunks**: vendor-react, vendor-supabase, vendor-state (dnd-kit 미포함)
- **React.lazy**: 18개 컴포넌트 코드 스플리팅
- **Idle preload**: 4개 뷰 유휴 시간 미리 로드
- **SW 캐싱**: Static(CacheFirst 30일), API(NetworkFirst 3초 timeout 24시간)
- **iOS PWA 스냅샷**: localStorage에 24시간 TTL 스냅샷 저장, 콜드 스타트 최적화

### 6-4. Soft Delete

- **tasks 테이블에만 적용** (projects/memos/comments는 hard delete)
- `_deletedAtColExists` 캐시로 하위 호환
- 폴링에서 `deleted_at` 필터 없이 조회 → `row.deleted_at ? 'DELETE' : 'UPDATE'` 판별
- **Purge 메커니즘 없음** — soft-deleted 행 무한 누적

### 6-5. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 6-1 | **HIGH** | **isArrayEqual() snake_case/camelCase 불일치**: `item.updated_at`이 mapTask() 후 undefined가 되어 id만으로 비교 → 변경분 누락 가능 |
| ⚠️ 6-2 | MEDIUM | **comments가 SYNC_TABLES에 미포함**: types/mergeSyncUpdate/인덱스는 준비되었으나 실제 폴링 미연결 |
| ⚠️ 6-3 | MEDIUM | **projects/memos 폴링 대상 아님**: 팀원 간 프로젝트 변경이 탭 전환에만 의존 |
| ⚠️ 6-4 | MEDIUM | **notifications.updated_at 인덱스가 존재하지 않는 컬럼 대상**: 마이그레이션 에러 가능 (1-2와 동일) |
| ⚠️ 6-5 | MEDIUM | soft-deleted tasks **purge 메커니즘 부재** — DB 무한 누적 |
| ⚠️ 6-6 | LOW | PollingSyncProvider._poll()에서 `select('*')` — 10초마다 불필요한 대용량 컬럼 전송 |
| ⚠️ 6-7 | LOW | TASK_COLUMNS = '*' — 마이그레이션 확정 후 명시적 컬럼 전환 권장 |
| ⚠️ 6-8 | LOW | key_* 참조 테이블 4종 일괄 `select('*')` |
| ⚠️ 6-9 | LOW | Optimistic update 실패 시 롤백 없음 (3-10과 동일) |
| ⚠️ 6-10 | LOW | @dnd-kit 3패키지 manualChunks 미포함 |
| ⚠️ 6-11 | LOW | lastSync 영속화 없음 — 짧은 탭 전환에도 full reload |

---

## 7. Director Meta

### 7-1. CLAUDE.md 규칙 요약

8개 섹션: Golden Rule ("Don't Touch, Wrap It"), Architecture (3-tier, 3 scope), DB Rules, RBAC, Distributed System (10s polling, optimistic, last-write-wins), Backward Compatibility, File Structure, Loop Workflow

Common Mistakes 테이블에 9개 금지 패턴 명시

### 7-2. Loop 문서 구조

- **loop-index.md**: Loop-16~23까지만 등록 (10개, 전부 completed)
- **docs/loops/**: 20개 파일 (Loop-25 mockup, Loop-26 시리즈 6개, Loop-28 등)
- Loop 문서 공통 구조: 목표 → 전제조건 → 영향 파일 → Phase별 구현 → 검증 체크리스트 → 주의사항

### 7-3. 코드 보호 패턴

CLAUDE.md File Structure Convention 예시 파일 vs 실제:
- `TaskCard.jsx` → **미존재** (실제: TaskItem.jsx, UniversalCard.jsx)
- `TeamTaskCard.jsx` → **미존재**
- `useTodos.js` → **미존재** (실제: useStore.js가 통합)
- `useTeamTodos.js` → **미존재**
- `pages/MatrixView.jsx` → 경로 불일치 (실제: `components/views/`)
- `pages/TeamMatrixView.jsx` → 경로 불일치 (실제: `components/matrix/`)

### 7-4. 파일 구조

- **총 111개 파일** (.jsx 81 + .js 30)
- 최대 디렉토리: `components/shared/` (22개) — 페이지급 컴포넌트 혼재
- `components/outliner/` 빈 디렉토리 존재
- 글로벌 타임라인 (`components/timeline/`) vs 프로젝트 타임라인 (`components/project/timeline/`) 분리

### 7-5. 발견 사항

| # | 심각도 | 내용 |
|---|--------|------|
| ⚠️ 7-1 | **HIGH** | **loop-index.md에 Loop-24~28 미등록**: Loop 추적 체계 사실상 중단 |
| ⚠️ 7-2 | MEDIUM | Loop-26 서브 문서에 v2/v3 혼재, 최종 유효 버전 미명시 |
| ⚠️ 7-3 | **HIGH** | **CLAUDE.md File Structure Convention 6개 예시 중 4개 미존재, 2개 경로 불일치**: 문서와 실제 구조 심각한 괴리 |
| ⚠️ 7-4 | MEDIUM | CLAUDE.md가 명시한 `src/team/`, `src/pages/` 디렉토리 미존재 |
| ⚠️ 7-5 | MEDIUM | useTeamTodos.js 래퍼 훅 미생성 — "Wrap It" 원칙과 잠재적 충돌 |
| ⚠️ 7-6 | LOW | `src/components/outliner/` 빈 디렉토리 |
| ⚠️ 7-7 | LOW | `components/shared/` 비대화 (22개), 페이지급 컴포넌트 혼재 |
| ⚠️ 7-8 | INFO | 글로벌/프로젝트 타임라인 분리는 의도적이나 코드 공유 전략 주시 필요 |

---

## 전체 발견 사항 요약 (심각도별)

### HIGH (7건)

| ID | 섹션 | 내용 |
|----|------|------|
| 1-1 | Schema | Migration chain broken (ref_* → key_* rename이 migration chain 외부) |
| 1-2 | Schema | notifications.updated_at 컬럼 부재 + 인덱스 생성 시도 |
| 1-3 | Schema | team_invitations DELETE RLS 정책 없음 |
| 2-1 | Permission | team_tasks_member_assign으로 팀 전체 UPDATE 권한 (FE readOnly에만 의존) |
| 6-1 | Sync | isArrayEqual() camelCase 불일치로 변경분 누락 가능 |
| 7-1 | Meta | loop-index.md에 Loop-24~28 미등록 |
| 7-3 | Meta | CLAUDE.md File Structure Convention과 실제 코드 구조 심각한 괴리 |

### MEDIUM (17건)

| ID | 섹션 | 내용 |
|----|------|------|
| 1-4 | Schema | memos set_updated_at 트리거 누락 |
| 1-5 | Schema | team_members updated_at 컬럼 없음 |
| 2-2 | Permission | projects_team_update 전체 멤버 개방 |
| 2-3 | Permission | comments_select private 할일 댓글 노출 가능 |
| 3-2 | View | 모바일 BottomNav matrix/timeline dead-end |
| 3-4 | View | Highlight color 비반응적 getState() 읽기 |
| 3-8 | View | SYNC_TABLES에 projects/memos 미포함 |
| 3-9 | View | /team/settings 등 SyncProviderWrapper 외부 |
| 4-1 | Card | Collision detection 불일치 (개인 vs 팀) |
| 4-4 | Card | MilestoneOutlinerView/KeyMilestoneTab sensor 미설정 |
| 5-1 | Design | HIGHLIGHT_COLORS 4개 파일 중복 + 구조 불일치 |
| 5-4 | Design | isMobile 렌더 스냅샷 16+ 컴포넌트 |
| 6-2 | Sync | comments SYNC_TABLES 미포함 |
| 6-3 | Sync | projects/memos 폴링 미대상 |
| 6-4 | Sync | notifications.updated_at 인덱스 대상 컬럼 부재 |
| 6-5 | Sync | soft-deleted tasks purge 메커니즘 없음 |
| 7-2, 7-4, 7-5 | Meta | Loop 문서 버전 혼재, 디렉토리/훅 불일치 |

### LOW (20건) / INFO (8건)

Schema FK 부재, UI 상태 불일치, 스타일 하드코딩, DnD 설정 차이, 번들 최적화 여지 등
