# Phase 12d Recon — 팀원 뷰 신규 + 정/부 담당자 시스템

> 작성일: 2026-04-13
> 상태: 조사 완료

---

## 1. 요구사항 요약

**목표 1**: 팀원 뷰 (Member View) 신규 — 멤버 컬럼 칸반, 프로젝트별 task 그룹핑
**목표 2**: 정/부 담당자 시스템 — tasks에 `secondary_assignee_id`, milestones에 `secondary_owner_id` 추가

---

## 2. 현재 상태 분석

### 2-1. 데이터 모델

**tasks 테이블**:
- `assignee_id uuid` — nullable, FK 없음 (CHECK constraint로 scope 연동)
- `scope` — CHECK: `(private AND assignee_id IS NULL) OR (team AND assignee_id IS NULL) OR (assigned AND assignee_id IS NOT NULL)`
- 인덱스: `idx_tasks_assignee` (WHERE NOT NULL)
- RLS: 8 정책 (private 4 + team 4). `team_tasks_update` 정책에서 `assignee_id = auth.uid()` 참조
- `secondary_assignee_id`: **존재하지 않음**

**key_milestones 테이블**:
- `owner_id uuid` — nullable, FK profiles(id) 명시적
- `created_by uuid` — nullable
- 인덱스: 없음 (owner_id 전용)
- **RLS: 없음** (명시적 정책 미설정 — app-level 접근 제어)
- `secondary_owner_id`: **존재하지 않음**

**CHECK constraint 주의** (tasks):
```sql
(scope = 'assigned' AND team_id IS NOT NULL AND assignee_id IS NOT NULL)
```
→ `secondary_assignee_id`는 이 CHECK에 포함되지 않으므로 **무관하게 추가 가능** (nullable로 추가하면 기존 CHECK 영향 없음)

### 2-2. Store 액션 및 데이터 흐름

**mapTask** (line 170-183): `assigneeId: r.assignee_id || null` — secondary 필드 없음
**taskToRow** (line 116-134): `assignee_id: t.assigneeId || null` — secondary 필드 없음
**milestones**: mapMilestone 함수 없음 — raw DB 객체 직접 사용 (`owner_id` 그대로)
**TASK_COLUMNS**: `'*'` (와일드카드) → 새 컬럼 추가 시 자동 로드

**applyTransitionRules** (line 30-82):
- R1: `assigneeId` 설정 → `scope='assigned'`
- R2: `assigneeId=null` → `scope='team'|'private'`, 카테고리 backlog
- **secondary_assignee_id에 대한 규칙 없음** → 추가 필요 없음 (secondary는 scope에 영향 없음)

**cascadeMilestoneOwner** (line 1085-1149):
- `owner_id`만 처리, `secondary_owner_id` 미인식
- cascade 시 secondary는 어떻게? → **secondary는 cascade하지 않음** (spec 필요)

**카운팅**:
- `computeMilestoneCount(msId, allTasks)` — `milestoneProgress.js` — `keyMilestoneId` 기반, assignee 무관
- TeamMatrixGrid Lane 헤더: `projTasks.filter(t => !t.done).length` — assignee 무관
- TeamMatrixGrid 참여자 칩: `t.assigneeId || '__unassigned__'` — 정담당만 집계

### 2-3. 팀원 데이터

**useTeamMembers.getMembers(teamId)** 반환:
```js
{ id, teamId, userId, role, status, displayName, email, avatarUrl, joinedAt }
```
- 정렬: `joined_at` ASC
- 멤버 색상: `getColorByIndex(memberIndex)` — members를 userId로 stable sort 후 index 매핑 (12c)

### 2-4. 라우팅

- `currentView` state (useStore) — string key
- `App.jsx` views 객체: `'team-matrix': () => <UnifiedGridView ...>` 등
- `setView('team-members')` 호출 → views 객체에 등록 필요
- 사이드바: `TASK_VIEWS` 배열 (line 35-39) + `NavItem` 컴포넌트

### 2-5. 수평 스크롤 + 고정 헤더 패턴

- **TimelineGrid**: `overflowX: 'auto'`, 내부 `width: gridW` 고정, sticky 헤더 `position: sticky, top: 0, zIndex: 3`
- **TimelineLeftPanel**: `width: panelW, flexShrink: 0, zIndex: 5` — 좌측 고정 패널
- 12d 멤버 뷰에서 이 패턴 재사용 가능

---

## 3. 재사용 가능 컴포넌트

| 컴포넌트 | 현재 API | 확장 필요 사항 |
|---------|----------|--------------|
| **MiniAvatar** | `name, size, color` | 스택 아바타 패턴 (정/부 겹쳐 표시) — wrapper 컴포넌트 `StackedAvatar` 신규 |
| **TaskAssigneeChip** | `taskId, assigneeId, members, onChangeAssignee, size` | `secondaryAssigneeId` + `onChangeSecondary` 추가 또는 별도 `DualAssigneeChip` |
| **MilestoneRow** | accent, alive/total, collapse | **owner 표시 없음** — 정/부 owner badge 추가 필요 |
| **AssigneeSelector** | `task, onUpdate` — 단일 assignee 선택 | 정/부 dual 모드 확장 (두 번째 dropdown) |
| **InlineAdd** | `projectId, category, color, extraFields` | 12d에서는 사용하지 않음 (읽기 위주 뷰) |
| **TeamMatrixGrid (12c)** | C안/B안 토글, Lane 카드 | task 행 3곳에서 assignee 렌더 → 스택 아바타 패치 |

---

## 4. 변경 범위

### 4-1. DB 마이그레이션 SQL 초안

```sql
-- Phase 12d: 정/부 담당자 시스템
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS secondary_assignee_id uuid DEFAULT NULL;
ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS secondary_owner_id uuid DEFAULT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee ON tasks(secondary_assignee_id) WHERE secondary_assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ms_secondary_owner ON key_milestones(secondary_owner_id) WHERE secondary_owner_id IS NOT NULL;

-- RLS: 기존 정책이 secondary 컬럼을 참조하지 않으므로 신규 정책 불필요
-- (secondary_assignee_id는 SELECT/UPDATE 정책에 영향 없음 — 기존 team_tasks_* 정책이 커버)
```

> **CHECK constraint 영향 없음**: `valid_scope`은 `assignee_id`만 참조. `secondary_assignee_id`는 nullable이므로 제약 없음.

### 4-2. 신규 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `src/components/views/MembersView.jsx` | 팀원 뷰 본체 — 멤버 컬럼 칸반 |
| `src/components/shared/StackedAvatar.jsx` | 정/부 아바타 겹침 표시 |
| `src/components/shared/DualAssigneeSelector.jsx` | 정/부 dual 선택 dropdown |

### 4-3. 수정 컴포넌트

| 컴포넌트 | 변경 |
|---------|------|
| `useStore.js` | `mapTask`에 `secondaryAssigneeId` 추가, `taskToRow`에 `secondary_assignee_id` 추가, milestones SELECT에 `secondary_owner_id` 추가 |
| `Sidebar.jsx` | TASK_VIEWS에 `{ key: 'members', label: '팀원', icon: '👥' }` 추가 |
| `App.jsx` | views 객체에 `'team-members': MembersView` 등록 |
| `TeamMatrixGrid.jsx` (12c) | task 행의 TaskAssigneeChip → StackedAvatar 패치 (secondary 표시) |
| `MilestoneRow.jsx` | secondary_owner badge 추가 (선택적) |
| `DetailPanel.jsx` | AssigneeSelector → DualAssigneeSelector (정/부 선택) |

---

## 5. 사용자 결정 필요 항목

| # | 항목 | 옵션 |
|---|------|------|
| Q1 | 12c B안(담당자별 그룹)에서 부담당 task 처리 | (a) 정담당 sub-section에만 출현 + 부 표시 / (b) 정+부 양쪽 출현 |
| Q2 | 12d 컬럼 정렬 기본값 | (a) task 수 내림차순 / (b) 사이드바 멤버 순서 / (c) 이름 알파벳 |
| Q3 | 12d 빈 컬럼(task 0건) 처리 | (a) 항상 표시 / (b) 숨김 + 토글 |
| Q4 | 12d DnD | (a) v1 비활성 (읽기 위주) / (b) 컬럼 간 drag = 정담당 변경 |
| Q5 | 정담당 변경 시 부담당 유지? | (a) 유지 / (b) 자동 해제 |
| Q6 | 정/부 swap 빠른 액션 | (a) 포함 / (b) 12d 범위 외 |
| Q7 | cascadeMilestoneOwner에 secondary 포함? | (a) 포함 (secondary도 cascade) / (b) primary만 (secondary 유지) |

---

## 6. 위험 요소 및 대응

| # | 위험 | 대응 |
|---|------|------|
| R1 | CHECK constraint(`valid_scope`)가 secondary를 막을 수 있음 | **안전** — secondary는 CHECK에 포함 안 됨 |
| R2 | RLS가 secondary 접근을 차단할 수 있음 | **안전** — 기존 정책은 컬럼 레벨이 아닌 row 레벨 |
| R3 | `TASK_COLUMNS = '*'`이므로 새 컬럼 자동 로드 | **장점** — mapTask에 매핑만 추가하면 됨 |
| R4 | applyTransitionRules에서 secondary 처리 누락 | **안전** — secondary는 scope에 영향 없음 (의도적 분리) |
| R5 | 12c B안에서 부담당 task 이중 출현 시 key 충돌 | key에 `${taskId}-secondary` suffix 추가 |
| R6 | 멤버 뷰 가로 스크롤이 DnD와 충돌 | v1에서 DnD 비활성 (Q4 결정) |
| R7 | milestones RLS 부재 | 기존 상태 유지 — app-level 제어 |
| R8 | 스냅샷에 새 collapseState 키 누락 | `_defaultCollapseState`에 `membersView: {}` 추가 |

---

## 7. R-ATOMIC 커밋 시퀀스 제안

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(db): add secondary_assignee_id + secondary_owner_id (12d-1)` | DB 마이그레이션 + 인덱스 |
| 2 | `feat(store): add secondary fields to mapTask/taskToRow + milestone select (12d-2)` | Store 매핑 |
| 3 | `feat(shared): add StackedAvatar + DualAssigneeSelector (12d-3)` | 공용 컴포넌트 |
| 4 | `feat(team-matrix): patch task/MS rows for stacked avatar (12d-4)` | 12c 팀 매트릭스 패치 |
| 5 | `feat(views): add MembersView kanban layout (12d-5)` | 멤버 뷰 본체 |
| 6 | `feat(sidebar): add 팀원 menu item + App.jsx view registration (12d-6)` | 사이드바 + 라우팅 |
| 7 | `feat(detail): add DualAssigneeSelector to DetailPanel (12d-7)` | 상세 패널 정/부 선택 |

---

## 8. 다음 단계

1. 사용자 Q1~Q7 결정 → spec 확정
2. spec 작성 시 짚어야 할 항목:
   - applyTransitionRules에 secondary 규칙 추가 여부 (권장: 안 함)
   - cascadeMilestoneOwner의 secondary 처리 (Q7)
   - B안 부담당 이중 출현 여부 (Q1)
   - 멤버 뷰 밀도 토글 세부 스타일
   - 스택 아바타의 정확한 겹침 px (marginLeft: -6 등)
