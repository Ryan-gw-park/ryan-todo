# Phase 12d Spec — 팀원 뷰 신규 + 정/부 담당자 시스템

> 작성일: 2026-04-13
> 상태: **초안** (상세화 필요)
> 선행: `12d-recon.md`, Phase 12a/12b/12c

---

## 1. 목표

1. **팀원 뷰 (MembersView)** 신규 — 멤버 컬럼 칸반, 프로젝트별 task 그룹핑, 워크로드 비교
2. **정/부 담당자 시스템** — tasks에 `secondary_assignee_id`, milestones에 `secondary_owner_id` 추가
3. **12c 팀 매트릭스 패치** — 스택 아바타 (정+부 겹침 표시)

---

## 2. 확정 결정사항

### 사용자 확정 (C1~C9, brief 원본)

| # | 항목 | 결정 |
|---|------|------|
| C1 | 정/부 의미론 | 데이터 비대칭(정 leader) + 실행 flat(동등) |
| C2 | 캡 | 2명 고정 (primary + secondary) |
| C3 | 적용 범위 | tasks + milestones 둘 다 |
| C4 | 카운팅 | 정만 메인 카운트, 부는 별도 보조 (+부 N) |
| C5 | 12c task/MS 행 UI | A안 — 스택 아바타 (앞=정, 뒤=부) |
| C6 | 12d 부담당 처리 | 별도 섹션 — 정담당 먼저, dashed divider + "부담당 (N)" |
| C7 | DB 변경 | tasks, milestones에 secondary_* 컬럼 추가 |
| C8 | 사이드바 | "팀" 섹션에 "팀원" 항목 신설 |
| C9 | Phase 묶음 | 12d 단일 phase |

### Q1~Q7 결정

| # | 항목 | 결정 |
|---|------|------|
| Q1 | B안 부담당 처리 | **(b)** 정+부 양쪽 sub-section에 출현 (부쪽은 muted + 정담당 badge) |
| Q2 | 컬럼 정렬 | **(a)** task 수 내림차순 |
| Q3 | 빈 컬럼 | **(a)** 항상 표시 |
| Q4 | DnD | **(b)** 활성 — 컬럼 간 drag = 정담당 변경 |
| Q5 | 정 변경 시 부 | **(a)** 유지 |
| Q6 | swap 액션 | **(b)** 범위 외 |
| Q7 | cascade | **(a)** primary만 (secondary 유지) |

---

## 3. DB 마이그레이션

```sql
-- Phase 12d: 정/부 담당자 시스템
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS secondary_assignee_id uuid DEFAULT NULL;
ALTER TABLE key_milestones ADD COLUMN IF NOT EXISTS secondary_owner_id uuid DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee 
  ON tasks(secondary_assignee_id) WHERE secondary_assignee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ms_secondary_owner 
  ON key_milestones(secondary_owner_id) WHERE secondary_owner_id IS NOT NULL;
```

- CHECK constraint(`valid_scope`) 영향 없음 — secondary는 nullable, scope 무관
- RLS 신규 정책 불필요 — 기존 row-level 정책이 커버
- 기존 데이터 영향 없음 (모두 NULL 시작)

---

## 4. 기능 범위

### 4-1. Store 변경

- `mapTask`: `secondaryAssigneeId: r.secondary_assignee_id || null` 추가
- `taskToRow`: `secondary_assignee_id: t.secondaryAssigneeId || null` 추가
- milestones SELECT에 `secondary_owner_id` 추가
- `applyTransitionRules`: secondary 규칙 추가 안 함 (scope에 영향 없음)
- `cascadeMilestoneOwner`: primary만 cascade (Q7), secondary 유지
- `_defaultCollapseState`에 `membersView: {}` 추가

### 4-2. 공용 컴포넌트 신규

**StackedAvatar** — 정/부 아바타 겹침 표시
- props: `primaryName, primaryColor, secondaryName, secondaryColor, size`
- 정: 앞 (full), 부: 뒤 (marginLeft: -size*0.3, 약간 숨김)
- secondary가 null이면 단일 MiniAvatar

**DualAssigneeSelector** — 정/부 dual 선택 dropdown
- props: `taskId, assigneeId, secondaryAssigneeId, members, onChangePrimary, onChangeSecondary`
- UI: 정 아바타 + 부 아바타 (ghost if null), 클릭 → dropdown
- dropdown: "정담당" 섹션 + "부담당" 섹션 분리
- 미배정: ghost 아바타 (dashed border)

### 4-3. 팀원 뷰 (MembersView) 신규

**레이아웃**: 멤버 = 컬럼 (240px 고정), 가로 스크롤
```
┌─ Ryan (12 +부1) ─┬─ Edmond (8) ──┬─ eric (5 +부2) ─┬─ ash (3) ──┐
│ ● ABI 코리아      │ ● ABI 코리아   │ ● ABI 코리아    │ ● 팀 개별   │
│   □ task 1        │   □ task 4     │   □ task 7      │   □ task 10 │
│   □ task 2        │   □ task 5     │   □ task 8      │   □ task 11 │
│ ● 26Q1 이사회     │ ● 스톡옵션     │ ● 팀 개별       │            │
│   □ task 3        │   □ task 6     │   □ task 9      │            │
│ ┈┈ 부담당 (1) ┈┈  │               │ ┈┈ 부담당 (2) ┈┈│            │
│   □ task (정:Ed)  │               │   □ task (정:Ry) │            │
│   □ task (정:ash) │               │                  │            │
└──────────────────┴───────────────┴─────────────────┴────────────┘
```

**컬럼 구조**:
- 헤더: MiniAvatar + 이름 + "N +부M" 카운트 (sticky top)
- 본문: 프로젝트별 그룹 (프로젝트 dot + 이름 + 접기)
  - 프로젝트 그룹 내 task 리스트 (sortOrder)
- 부담당 섹션: dashed divider + "부담당 (N)" + muted task 리스트 + 정담당 mini badge
- 가로 스크롤: `overflowX: auto` (TimelineGrid 패턴)
- 컬럼 헤더: `position: sticky, top: 0` (세로 스크롤 시 고정)
- 컬럼 정렬: task 수 내림차순 (Q2)
- 빈 컬럼: 항상 표시 (Q3)

**DnD**: 컬럼 간 task drag = 정담당 변경 (Q4)
- 드래그: task 행 drag handle
- 드롭: 다른 멤버 컬럼에 drop → `updateTask(id, { assigneeId: targetMemberId })`
- 정 변경 시 부 유지 (Q5)

**밀도 토글**: 편안 / 컴팩트 (localStorage `membersViewDensity`)

### 4-4. 12c 팀 매트릭스 패치 (C5)

**task 행**: TaskAssigneeChip → StackedAvatar (secondary 있을 때)
**MS 행**: MilestoneRow에 owner StackedAvatar 추가 (optional)
**Lane 헤더 참여자 칩**: 정담당 기준 카운트 유지 (C4)
**B안**: 부담당 task가 정+부 양쪽 sub-section에 출현 (Q1), 부쪽은 muted + 정담당 badge

### 4-5. DetailPanel 패치

AssigneeSelector → DualAssigneeSelector (정/부 선택)
MS DetailModal → secondary_owner 선택 추가

### 4-6. Sidebar + 라우팅

- `TASK_VIEWS`에 `{ key: 'members', label: '팀원', icon: '👥' }` 추가
- `App.jsx` views 객체에 `'team-members': MembersView` 등록
- `setView('team-members')` 호출

---

## 5. 영향 파일

### 신규
| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260413_secondary_assignee.sql` | DB 마이그레이션 |
| `src/components/views/MembersView.jsx` | 팀원 뷰 본체 |
| `src/components/shared/StackedAvatar.jsx` | 정/부 겹침 아바타 |
| `src/components/shared/DualAssigneeSelector.jsx` | 정/부 dual 선택 |

### 수정
| 파일 | 변경 |
|------|------|
| `useStore.js` | mapTask/taskToRow에 secondary 매핑, milestones SELECT, collapseState |
| `TeamMatrixGrid.jsx` | task 행 StackedAvatar 패치, B안 부담당 양쪽 출현 |
| `MilestoneRow.jsx` | secondary_owner badge (선택) |
| `Sidebar.jsx` | TASK_VIEWS에 "팀원" 추가 |
| `App.jsx` | views 객체에 MembersView 등록 |
| `DetailPanel.jsx` | DualAssigneeSelector 통합 |

---

## 6. 구현 순서 (R-ATOMIC)

| # | 커밋 |
|---|------|
| 1 | `feat(db): add secondary_assignee_id + secondary_owner_id (12d-1)` |
| 2 | `feat(store): add secondary fields to mapTask/taskToRow + milestone select (12d-2)` |
| 3 | `feat(shared): add StackedAvatar + DualAssigneeSelector (12d-3)` |
| 4 | `feat(team-matrix): patch task/MS rows for stacked avatar (12d-4)` |
| 5 | `feat(views): add MembersView kanban layout with DnD (12d-5)` |
| 6 | `feat(sidebar): add 팀원 menu + App.jsx view registration (12d-6)` |
| 7 | `feat(detail): add DualAssigneeSelector to DetailPanel (12d-7)` |

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| R1 | CHECK constraint 영향 | 안전 — secondary는 CHECK 미포함 |
| R2 | RLS 영향 | 안전 — row-level 정책, 컬럼 무관 |
| R3 | applyTransitionRules | secondary 규칙 안 넣음 (scope 무관) |
| R4 | B안 이중 출현 key 충돌 | `${taskId}-secondary` suffix |
| R5 | DnD와 가로 스크롤 충돌 | PointerSensor distance 설정 |
| R6 | cascade secondary 유지 | Q7 확정 — primary만 cascade |
| R7 | 정 변경 시 부 유지 | Q5 확정 — 별도 처리 불필요 |

---

## 8. QA 체크리스트

### DB
- [ ] `secondary_assignee_id` 컬럼 생성 (tasks)
- [ ] `secondary_owner_id` 컬럼 생성 (key_milestones)
- [ ] 기존 CHECK constraint 영향 없음
- [ ] 인덱스 생성

### 정/부 시스템
- [ ] 정담당 변경 → scope 변경 (기존 동작)
- [ ] 부담당 변경 → scope 변경 없음
- [ ] 정 변경 시 부 유지 (Q5)
- [ ] cascade는 primary만 (Q7)

### 12c 패치
- [ ] task 행 스택 아바타 (정+부 겹침)
- [ ] B안 부담당 양쪽 출현 + muted 스타일 (Q1)
- [ ] Lane 헤더 참여자 칩: 정담당 기준 카운트

### 팀원 뷰
- [ ] 멤버 컬럼 240px, 가로 스크롤
- [ ] 컬럼 정렬: task 수 내림차순 (Q2)
- [ ] 빈 컬럼 항상 표시 (Q3)
- [ ] 컬럼 헤더 sticky
- [ ] 프로젝트별 task 그룹핑
- [ ] 부담당 섹션 (dashed divider + muted)
- [ ] DnD: 컬럼 간 drag = 정담당 변경 (Q4)
- [ ] 밀도 토글 (localStorage)

### DetailPanel
- [ ] DualAssigneeSelector (정/부 선택)
- [ ] 부담당 제거 가능

### 사이드바
- [ ] "팀원" 메뉴 표시
- [ ] 클릭 → MembersView 전환

### 빌드
- [ ] `npm run build` 통과
- [ ] 기존 뷰 회귀 없음
