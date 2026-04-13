# Phase 12c Recon — 팀 매트릭스 리스트형 전환 (플랫 리스트 + 담당자 태그)

> 작성일: 2026-04-13
> 상태: 조사 완료

---

## 1. 요구사항 요약

팀 매트릭스의 5컬럼 멤버 grid를 **플랫 리스트 + 담당자 태그** 방식으로 교체.

- **기본 (C안)**: 플랫 리스트 + Lane 헤더 우측 참여자 칩 + 우측 아바타 배지
- **토글 (B안)**: 담당자별 그룹 (sub-section)
- **max-width 880px**, 가운데 정렬
- 개인 매트릭스는 변경 없음

---

## 2. 현재 상태 분석

### 2-1. TeamMatrixGrid.jsx (현재 구조)

- **열 = 팀원**: `gridTemplateColumns: repeat(${members.length}, 1fr)`
- **행 = 프로젝트**: Lane 카드, 각 Lane 내부에 팀원 컬럼
- **셀 필터**: `cellTasks = projAllTasks.filter(t => t.assigneeId === mem.userId)`
- **DnD**: `SortableContext` → `SortableLaneCard` (프로젝트 순서 변경)
- **CellContent**: 셀마다 task 그룹핑 (MS별)

### 2-2. UnifiedGridView.jsx

- `TeamMatrixGrid`에 props 전달: `projects, tasks, members, collapsed, toggleCollapse, editingId, ...`
- 뷰 토글: Pill 컴포넌트 (`매트릭스 | 주간 플래너`)
- "group by owner" 토글: Pill 옆에 추가 가능

### 2-3. 멤버 아바타 색상 시스템

- **존재하지 않음**. MiniAvatar는 `#888` 하드코딩
- `getColorByIndex(index)` 함수는 있지만 프로젝트 색상용
- **신규 멤버 색상 매핑 필요**

### 2-4. AssigneeSelector.jsx

- 기존 담당자 변경 드롭다운 (DetailPanel에서 사용)
- `useTeamMembers.getMembers(currentTeamId)` 호출
- 멤버 목록 표시 + 선택 시 `onUpdate` 콜백
- **재사용 가능** — owner badge 클릭 시 유사 dropdown

---

## 3. 변경 범위

### 3-1. TeamMatrixGrid.jsx — **완전 재작성**

기존 5컬럼 grid → 플랫 리스트:

**C안 (기본):**
```
┌─ Lane: 팀 개별 과제 11건          R3  E3  ash1  eric3 ┐
│ □ 1분기 NDR 자료 준비                          ⓡ Ryan │
│ □ 수주/매출 현황 업데이트                       ⓡ Ryan │
│ □ MM                                        ⓔ Edmond │
│ ...                                                  │
│ + 추가                                               │
└──────────────────────────────────────────────────────┘
```

**B안 (토글 시):**
```
┌─ Lane: 팀 개별 과제 11건                              ┐
│  Ryan 3                                               │
│  □ 1분기 NDR 자료 준비                                 │
│  □ 수주/매출 현황 업데이트                              │
│  Edmond 3                                             │
│  □ MM                                                  │
│  ...                                                   │
└───────────────────────────────────────────────────────┘
```

### 3-2. 멤버 색상 시스템 추가

`getColorByIndex(memberIndex)` 재사용 → 멤버별 고유 색상 자동 할당

### 3-3. 담당자 변경 dropdown

task 우측 아바타 배지 클릭 → 멤버 picker dropdown (AssigneeSelector 패턴 재사용)

---

## 4. 사전 결정사항 (사용자 확정)

| # | 항목 | 결정 |
|---|------|------|
| D1 | 기본 뷰 | C안 (플랫 리스트 + 헤더 칩) |
| D2 | 토글 | B안 (담당자별 그룹) — localStorage `teamMatrixGroupByOwner` |
| D3 | max-width | 880px, margin: 0 auto |
| D4 | 멤버 색상 | `getColorByIndex(memberIndex)` 재사용 (자동 할당) |
| D5 | 헤더 칩 정렬 | task 수 내림차순 (제일 바쁜 사람 먼저) |
| D6 | 미배정 task 위치 | 맨 위 (회의에서 즉시 배정) |
| D7 | B안 미배정 그룹 | 첫 sub-section "미배정 (N)" |
| D8 | DnD | Lane 내부 task sortable만 유지, 셀 간 이동 → dropdown으로 일원화 |
| D9 | 기존 5컬럼 grid | 완전 교체 (토글 유지 안 함) |
| D10 | 개인 매트릭스 | 변경 없음 |

---

## 5. 영향 파일

| 파일 | 변경 |
|------|------|
| `src/components/views/grid/grids/TeamMatrixGrid.jsx` | **완전 재작성** |
| `src/components/views/UnifiedGridView.jsx` | 토글 state + props 전달 |
| `src/components/views/grid/shared/MiniAvatar.jsx` | 멤버별 색상 지원 (color prop 추가) |

### 미변경
- `PersonalMatrixGrid.jsx` — 개인 매트릭스 그대로
- `useStore.js` — `updateTask`, `toggleDone` 등 기존 action 재사용
- DB 스키마 — 변경 없음 (`assignee_id` 이미 존재)

---

## 6. 재사용 가능

| 항목 | 소스 |
|------|------|
| `getColorByIndex(index)` | `src/utils/colors.js` |
| `MiniAvatar` | `src/components/views/grid/shared/MiniAvatar.jsx` |
| `AssigneeSelector` 패턴 | `src/components/shared/AssigneeSelector.jsx` |
| `InlineAdd` | task 인라인 추가 |
| `SortableLaneCard` | 12b에서 추가한 Lane DnD |
| `Pill` 컴포넌트 | 토글 UI |

---

## 7. 위험 요소

| # | 위험 | 대응 |
|---|------|------|
| W1 | 기존 5컬럼 DnD (`tmat:` prefix) 코드 삭제 후 handleDragEnd 회귀 | `tmat:` 관련 코드 제거 + 새 prefix 또는 제거 |
| W2 | CellContent/MilestoneRow가 새 구조에서 불필요 | 플랫 리스트에서는 CellContent 대신 직접 TaskRow 사용 |
| W3 | 멤버 색상 할당이 멤버 순서에 의존 | 멤버 ID → index 매핑을 stable하게 |
| W4 | 기존 DroppableCell (`tmat:`) 제거 시 UnifiedGridView handleDragEnd의 `tmat:` 분기도 정리 필요 | handleDragEnd에서 `tmat:` 분기를 새 구조에 맞게 교체 또는 제거 |
| W5 | 회의 중 실시간 동기화 — 10초 폴링으로 충분한가 | 기존 동작 유지 (변경 없음) |

---

## 8. 구현 순서 (R-ATOMIC)

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `feat(team-matrix): replace grid with flat task list + owner badge` | TeamMatrixGrid 재작성 (C안), max-width 880, 헤더 칩 |
| 2 | `feat(team-matrix): add group-by-owner toggle with localStorage` | 토글 (C↔B), UnifiedGridView 헤더 |
| 3 | `feat(team-matrix): add owner picker dropdown on badge click` | 아바타 배지 클릭 → 멤버 dropdown |
