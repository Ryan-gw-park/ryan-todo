# Loop 44 — 개인 매트릭스 시간 피벗 Recon

> **Phase**: Personal Matrix Redesign
> **Date**: 2026-04-15
> **Spec**: [matrix-redesign-personal-spec.md](./matrix-redesign-personal-spec.md)
> **Depends on**: Loop 41, 42 완료 / Loop 43과 독립

---

## 0. Executive Summary

**판정**: spec에 **심각한 사실 오류 2건** + **방향 수정 권장 2건** 존재. diff 작성 전 spec 보완 필수.

| 항목 | spec 가정 | 실제 | 조치 |
|------|---------|------|------|
| category enum | `'today'`, `'thisWeek'`, `'someday'` | `'today'`, `'next'`, `'backlog'`, `'done'` | **spec R03 전면 수정** |
| NULL category 처리 | "지금 할일" 컬럼에 표시 | `mapTask`에서 `|| 'backlog'`로 기본값 적용 → NULL이 없음 | **spec R04 무의미, 로직 단순화** |
| collapseState 저장 | `useStore.collapseState['personalMatrixPivot']` | Loop 42는 ui_state 충돌로 별도 hook 채택 | **usePivotExpandState 확장 권장** |
| 컴포넌트 재사용 | PersonalPivot* 5개 신규 생성 | 구조는 동일, 컬럼 정의만 다름 → 일반화 가능 | **신규 생성 권장(spec 방향 OK)** 단 공용 유틸 분리 고려 |

---

## 1. Category Enum — ⚠️ Spec 오류

### 실제 enum (소스 코드 기준)

[src/utils/colors.js:20-25](../../src/utils/colors.js#L20-L25):
```js
export const CATEGORIES = [
  { key: 'today',   label: '오늘 할일', shortLabel: '오늘', emoji: '🎯' },
  { key: 'next',    label: '다음 할일', shortLabel: '다음', emoji: '📌' },
  { key: 'backlog', label: '남은 할일', shortLabel: '남은', emoji: '📋' },
  { key: 'done',    label: '완료',     shortLabel: '완료', emoji: '✅' },
]
```

[src/components/views/grid/constants.js:5](../../src/components/views/grid/constants.js#L5): 일부 파일에선 `CATS`가 3개 (`today`/`next`/`later`)로 정의 — **불일치**. 확인 필요.

### NULL → backlog 강제 변환

[src/hooks/useStore.js:173](../../src/hooks/useStore.js#L173):
```js
function mapTask(r) {
  return { ..., category: r.category || 'backlog', ... }
}
```

즉 DB에 NULL이 있어도 앱 레이어에서 `'backlog'`로 변환됨. **spec R04의 "NULL → 지금 할일 컬럼" 정책은 실행 경로가 존재하지 않음**.

### 권장 시간 컬럼 정의

spec R02의 3컬럼("지금 할일 / 이번주 / 언젠가")을 실제 enum에 매핑:

| 컬럼 라벨 | 매칭 category | 비고 |
|---------|-------------|------|
| 지금 할일 | `'today'` | R25 명칭 변경 적용 |
| 다음 할일 | `'next'` | spec "이번주"와 다름 |
| 남은 할일 | `'backlog'` | spec "언젠가"와 다름. NULL 유입도 여기로 |
| 완료 | `'done'` | 표시 제외 (`!t.done` 필터로 처리하는 기존 패턴) |

**다른 옵션**: 4개 컬럼(done 제외 3개 + backlog)이거나, "이번주"/"언젠가" 컨셉 유지 시 DB 마이그레이션 필요.

---

## 2. PersonalMatrixGrid 현재 구조

[src/components/views/grid/grids/PersonalMatrixGrid.jsx:27-122](../../src/components/views/grid/grids/PersonalMatrixGrid.jsx#L27)

**Props**: `projects, myTasks, collapsed, toggleCollapse, toggleDone, openDetail, activeId, matrixMsCollapsed, toggleMatrixMsCollapse, handleMsDelete, matrixDoneCollapsed, toggleMatrixDoneCollapse`

**현 구조**: ProjectLaneCard 기반 카드 grid (Phase 12f). 3×3 그리드 폐기된 상태.

**today 필터**:
- Line 37-47: `todayFilter` state + localStorage `'personalTodayFilter'` (기본 ON)
- Line 50-54: task filter `category === 'today'` 적용
- Line 63-73: 토글 버튼 UI

**Wrapper 변환 대상**: Loop 42 TeamMatrixGrid와 동일 패턴. 외부 시그니처 유지 가능하나 **Line 37~73의 todayFilter 관련 코드는 전부 제거** (R16).

---

## 3. today 필터 토글 정확한 위치

- 파일: PersonalMatrixGrid.jsx (다른 곳 아님)
- State: 로컬 useState + localStorage
- UnifiedGridView에는 **없음** (spec §4.2의 "UnifiedGridView에도 있을 수 있음" 가정 불필요)

**조치**: PersonalMatrixGrid Wrapper 변환 시 자연스럽게 제거 — 추가 작업 없음.

---

## 4. 사이드바 프로젝트 정렬

[src/hooks/useStore.js:1276-1283](../../src/hooks/useStore.js#L1276):

```js
// getOrderedProjects 또는 유사 함수
const teamPs = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId))
const personalPs = sortProjectsLocally(projects.filter(p => !p.teamId))
// projectSectionOrder[0], [1]로 순서 결정 (기본: 팀 → 개인)
```

정렬 기준: `localProjectOrder[pid] ?? sortOrder ?? 0`

**spec R06 충족**: 기존 로직이 이미 팀 먼저 → 개인 순서. 추가 정렬 코드 불필요. PersonalPivotMatrixTable이 `projects` prop을 그대로 사용.

---

## 5. addTask category 기본값

[src/hooks/useStore.js:534](../../src/hooks/useStore.js#L534):
```js
const t = { ..., category: 'today', ..., ...teamDefaults, ...task }
```

기본값 `'today'` — spec의 "지금 할일" 컬럼 정책과 일치. 단, 빈 셀에서 새 task 생성 시 **컬럼 기반으로 category 명시 전달 필수** (PivotTaskCell 패턴 차용):

```js
addTask({
  projectId, keyMilestoneId,
  assigneeId: currentUserId,
  category: timeCol.key,  // 'today' | 'next' | 'backlog' 중 하나
  text: v,
})
```

[applyTransitionRules](../../src/hooks/useStore.js#L30): addTask에선 호출 안 됨(기존 동작). updateTask에서만 호출. 문제 없음.

---

## 6. currentUserId 획득

[src/hooks/useStore.js:112-114](../../src/hooks/useStore.js#L112) `getCachedUserId()` 동기 함수.

**사용 예시** (PersonalMatrixGrid 현재 구현): `import { getCachedUserId } from ...`

**PersonalPivotMatrixTable**: 동일 패턴 사용. 부팅 후 캐시 보장됨. Zustand 셀렉터 필요 없음.

**엣지 케이스**: userId null 시 cellTasks가 항상 빈 배열 → 정상 동작 (표시만 비어 있음).

---

## 7. "오늘" 텍스트 일괄 정리 (R25)

grep 결과:

| 파일 | 라인 | 상태 | 조치 |
|------|------|------|------|
| `src/utils/colors.js` | 21 | `label: '오늘 할일'` | **변경**: `'지금 할일'` |
| `src/components/views/grid/constants.js` | 5 | 이미 `'지금 할일'` | 유지 |
| `src/components/layout/MobileTopBar.jsx` | 8 | `today: '오늘 할일'` | **변경**: `'지금 할일'` |
| `src/components/modals/MilestoneDetailModal.jsx` | 15 | `label: '오늘'` | **변경** |
| `src/components/shared/HelpPage.jsx` | 여러 곳 | 도움말 텍스트 | **변경** (사용자 노출) |
| `src/components/views/grid/grids/PersonalMatrixGrid.jsx` | 78 | "오늘 할 일이 없습니다" | Wrapper 변환 시 제거 |

**DB enum `'today'`**, 코드 변수명 `today`: 유지.

---

## 8. 컴포넌트 재사용 판단

### Loop 42 PivotMatrixTable 구조 분석

[src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx):
- Props: `{ projects, members, tasks, milestones, filter }`
- 고정 컬럼: 프로젝트명 + members[] + 미배정 + 합계
- 셀 렌더링: PivotMsSubRow/PivotUngroupedSubRow (members prop 의존)

### 개인용으로 적용 시

**Option A — 신규 컴포넌트 5개 생성** (spec §3 제안):
- Pros: 명확한 책임, 독립 수정 용이
- Cons: 코드 중복 (~60%)

**Option B — 일반화 + props로 컬럼 정의 주입**:
- PivotMatrixTable에 `columns: Column[]` prop 도입
- Column 타입: `{ key, label, matchTask: (t) => boolean, onClickHeader?, newTaskDefaults }`
- Pros: 단일 진실 원천. 후속 phase (시간+멤버 2축 등)에 유연
- Cons: PivotMatrixTable 리팩토링 필요. Loop 42가 안정화되기 전이므로 리스크

**Option C — 부분 추출** (추천):
- PivotProjectRow, PivotMsSubRow 내부 cell 렌더링 부분만 render prop으로 추출
- 컨테이너(PivotMatrixTable, Personal*) 2개는 분리 유지
- Pros: 헤더/컬럼 구조의 차이는 명확히 분리, 공통 구조는 재사용
- Cons: render prop 설계 비용

**권장**: **Option A (spec 방향)** — Loop 42를 안정적으로 놓고 Loop 44를 독립 진행. 일반화는 후속 loop에서 양쪽 안정화 이후. 단, `PivotTaskCell`은 현재 `memberId` prop에 의존하므로 **`PivotTaskCell`은 재사용 가능** (memberId=null 경로가 이미 미배정 컬럼용으로 구현됨 → `timeCol.match(t.category)` 필터만 다르게).

**실제로는**: `PersonalPivotTimeCell` = `PivotTaskCell`의 필터 로직만 바뀐 버전. 공통 추출 또는 별도 생성 모두 가능. 별도 생성이 더 읽기 쉬움.

---

## 9. collapseState 패턴 — Spec §4.3 수정 권장

### Loop 42 결정사항 (이미 배포됨)

[src/hooks/usePivotExpandState.js](../../src/hooks/usePivotExpandState.js) (~30줄, localStorage 전용):
```js
// useStore.collapseState는 ui_state 단일 row(id='default')에 동기화되어
// cross-device/session 충돌 위험. 로컬 UI 상태는 별도 저장.
```

### spec §4.3 문제점

```
collapseState: {
  matrixPivot: {...},          // 팀 (Loop 42) ← 실제로는 useStore에 없음
  personalMatrixPivot: {...}   // 개인 (Loop 44 추가 제안)
}
```

- **사실 오류**: Loop 42의 `matrixPivot`은 `useStore.collapseState`에 없음. `usePivotExpandState` hook의 localStorage `'matrixPivotExpanded'` 키 사용 중.
- **Loop 44 권장**: `usePivotExpandState`를 확장하여 `scope` 파라미터 추가하거나, 별도 hook `usePersonalPivotExpandState` 생성. localStorage 키: `'personalMatrixPivotExpanded'`.

**추천 방향**: 동일 hook 재사용 + 키 파라미터화.

```js
// src/hooks/usePivotExpandState.js 확장
export default function usePivotExpandState(scope = 'team') {
  const KEY = scope === 'personal' ? 'personalMatrixPivotExpanded' : 'matrixPivotExpanded'
  // ... 동일 로직
}
```

### spec 수정 필요

§4.3 "useStore.js — collapseState 키 추가" 섹션 전체 **삭제**하고 "usePivotExpandState hook 재사용"으로 교체.

---

## 10. DnD 상태 확인

| 파일 | DnD |
|------|-----|
| Loop 42 PivotMatrixTable | DnD 없음 (셀 렌더링만) |
| UnifiedGridView | `project-lane` DnD는 유지 중 (프로젝트 재정렬) |
| PersonalMatrixGrid 현재 | SortableContext 활성 (ProjectLaneCard 재정렬) |
| PersonalPivotMatrixTable 신규 | **DnD 비활성** (spec R21) |

**조치**: Wrapper 변환 시 SortableContext는 유지하되 내부 피벗 테이블은 non-draggable. 프로젝트 재정렬은 후속 loop로 분리하거나 피벗 테이블 바깥(예: 사이드바)에서 처리.

---

## 11. 영향 받는 파일 목록

### 신규 (Spec §3 + recon 권장)
- `src/components/views/grid/PersonalPivotMatrixTable.jsx`
- `src/components/views/grid/cells/PersonalPivotProjectRow.jsx`
- `src/components/views/grid/cells/PersonalPivotMsSubRow.jsx`
- `src/components/views/grid/cells/PersonalPivotTimeCell.jsx`
- `src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx`

### 수정
- `src/components/views/grid/grids/PersonalMatrixGrid.jsx` — Wrapper 변환 (todayFilter 코드 제거)
- `src/hooks/usePivotExpandState.js` — scope 파라미터 추가 (또는 신규 훅)
- `src/utils/colors.js` — CATEGORIES[0].label → '지금 할일'
- `src/components/layout/MobileTopBar.jsx` — today 라벨
- `src/components/modals/MilestoneDetailModal.jsx` — today 라벨
- `src/components/shared/HelpPage.jsx` — 본문 텍스트

### 삭제 대상 (DELETE-5)
- `localStorage['personalTodayFilter']` 키 — 파일 삭제는 아니고 사용처 제거
- PersonalMatrixGrid의 todayFilter state/JSX 블록

---

## 12. 구현 옵션 정리

### Option A: Spec 방향 그대로 (5개 컴포넌트 신규)
- **권장**
- Loop 42 패턴과 일관
- Trade-off: 코드 중복

### Option B: 컴포넌트 일반화
- PivotMatrixTable에 `columns: Column[]` prop 도입
- 후속 loop에서 채택 검토. **본 Loop는 비권장** (Loop 42 안정화 기간 필요)

### Option C: PivotTaskCell만 재사용
- `PersonalPivotTimeCell`을 신규 생성하지 않고, `PivotTaskCell`에 `filterFn` prop 추가
- 부분적 일반화. 변경 범위 작음
- **고려할 만함** (diff 작성 시 결정)

---

## 13. 위험 요소 / 사전 확인

| # | 위험 | 완화 |
|---|------|------|
| R1 | spec R03의 enum이 실제와 다름 (`thisWeek`/`someday` → `next`/`backlog`) | **diff 작성 전 spec 수정 필수** |
| R2 | `grid/constants.js`의 CATS와 `colors.js`의 CATEGORIES 불일치 | diff 시 한쪽으로 통일 검토 (별도 작업 가능) |
| R3 | spec R04 "NULL → 지금 할일" 경로 없음 | spec에서 R04 삭제 또는 "mapTask 기본값 덕에 해당 없음"으로 명시 |
| R4 | collapseState spec 불일치 (Loop 42 실제 구현 미반영) | spec §4.3 교체 |
| R5 | R25 "오늘" 일괄 변경 범위 (HelpPage 등) 추가 시간 필요 | diff 단계에서 파일별 우선순위 결정 |
| R6 | `'later'` category 값의 출처 (grid/constants.js:5) | 실제 사용처 grep 후 판단 — 현재 dead code일 가능성 |
| R7 | addTask scope 자동 결정 (applyTransitionRules는 updateTask 전용) | PivotTimeCell 호출 시 scope 명시 전달 필요 — Loop 42와 동일 패턴 |

---

## 14. REQ-LOCK 커버리지 (spec §2 재검증)

| ID | 상태 | 비고 |
|----|------|------|
| L44-R01 | ✅ | 구현 가능 |
| L44-R02 | ⚠️ | 시간 컬럼 3개 확정 필요 (실제 enum 기준) |
| L44-R03 | ❌ | **enum 수정 필요** — 실제: today/next/backlog |
| L44-R04 | ❌ | **무의미** — mapTask가 NULL을 backlog로 변환 |
| L44-R05 ~ L44-R09 | ✅ | |
| L44-R10 | ✅ | Secondary 미포함 확정 |
| L44-R11 ~ L44-R12 | ✅ | PivotTaskCell 재사용 또는 신규 |
| L44-R13 ~ L44-R15 | ✅ | Loop 42 토큰 재사용 |
| L44-R16 | ✅ | PersonalMatrixGrid Wrapper 변환으로 자연 제거 |
| L44-R17 | ❌ | **usePivotExpandState 확장 권장** (useStore 아님) |
| L44-R18 ~ L44-R22 | ✅ | |
| L44-R23 | ✅ | |
| L44-R24 | ✅ | UnifiedGridView 변경 없음 확인 |
| L44-R25 | ✅ | 파일별 grep 결과 확보 |

---

## 15. 결론

**diff 작성 전 spec 수정 필수 항목**:
1. R03: 시간 컬럼 ↔ category enum 매핑 실제 값으로 재정의 (today/next/backlog)
2. R04: NULL 처리 로직 삭제 또는 명시 수정
3. §4.3: collapseState 방식을 usePivotExpandState hook으로 교체

**구현 방향**: spec Option A(5개 컴포넌트 신규) 유지. PivotTaskCell은 재사용 고려 (filterFn prop).

**완료 후 효과**: 팀/개인 매트릭스 모두 피벗 테이블로 통일. 사용자 멘탈 모델 일관성 확보. 시간축 명시로 "오늘 해야 할 일"이 한눈에 보이는 뷰 완성.

---

**Recon 완료. 다음 단계: spec을 위 3가지 수정사항 반영 후 `/diff-plan matrix-redesign-personal`로 진행하세요.**
