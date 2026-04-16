# Loop 44 — 개인 매트릭스 시간 피벗 (Personal Matrix Time Pivot)

> **Phase**: Personal Matrix Redesign
> **Status**: Confirmed — 2026-04-15
> **Depends on**: Loop 41 (MS L1 flat), Loop 42 (PivotMatrixTable 구조 재사용)
> **Independent of**: Loop 43
> **Related docs**: matrix-redesign-spec.md, loop-41-spec.md, loop-42-spec.md, loop-43-spec.md

---

## 0. 목적

개인 매트릭스를 **시간 × 프로젝트** 피벗 테이블로 재설계한다. 가로축 = 시간 카테고리(지금 할일/이번주/언젠가), 세로축 = 프로젝트(팀+개인 전체). 각 셀에서 "이 프로젝트에서 내가 언제 할 일"을 즉시 본다.

**팀 매트릭스(Loop 42)와 동일한 인터랙션 패턴을 유지**하여 사용자 멘탈 모델 일관성을 확보한다. 멤버 컬럼 자리에 시간 컬럼이 들어가는 것 외에는 동일.

---

## 1. Scope

### 포함
- `PersonalMatrixGrid` 내부를 신규 `PersonalPivotMatrixTable`로 위임 (Wrapper 패턴 — Loop 42와 동일)
- 신규 컴포넌트: `PersonalPivotMatrixTable`, `PersonalPivotProjectRow`, `PersonalPivotMsSubRow`, `PersonalPivotTimeCell`, `PersonalPivotUngroupedSubRow`
- 시간 컬럼 3개: 지금 할일 / 이번주 / 언젠가
- 모든 프로젝트(팀+개인) 행으로 표시 (내 task 0건이어도)
- 빈 셀에서 + 버튼으로 새 task inline 생성 (해당 프로젝트 × 시간 카테고리로)
- "today 필터 ON" 토글 폐기 — 컬럼 자체가 필터 역할 흡수
- 펼침 상태 영속화 (`useStore.collapseState['personalMatrixPivot']`)
- 자동 펼침: 직속 task가 있는 프로젝트 (Loop 42 R20과 동일 정책)

### 제외
- task category enum 변경 → diff 작성 전 **사전 grep으로 현재 enum 확인**. 변경 필요시 별도 마이그레이션
- "오늘" → "지금 할일" 명칭 변경 (Sub-Loop 7 미적용 사항) → 본 Loop에서 함께 적용
- DnD (시간 컬럼 간 task 이동) → 후속 Loop
- 팀 매트릭스 (Loop 42) → 무관

---

## 2. REQ-LOCK 요구사항

| ID | 요구사항 | 상태 |
|----|---------|------|
| L44-R01 | 매트릭스 축: rows = 모든 프로젝트(팀+개인), cols = 시간 카테고리 3개 | confirmed |
| L44-R02 | 컬럼: 프로젝트명(170px sticky) + 지금 할일 + 다음 할일 + 남은 할일 + 합계(55px). (recon 후 실제 enum 기준 변경) | confirmed |
| L44-R03 | 시간 컬럼 3개의 task category 매핑 (recon 결과 실제 enum 반영): 지금 할일 = `'today'`, 다음 할일 = `'next'`, 남은 할일 = `'backlog'`. `'done'`은 `!t.done` 필터로 별도 제외. ([src/utils/colors.js:20-25](../../src/utils/colors.js#L20-L25) `CATEGORIES` 기준) | confirmed |
| L44-R04 | category NULL 처리: [mapTask](../../src/hooks/useStore.js#L173)에서 `|| 'backlog'`로 자동 변환되므로 UI 레이어에서 별도 fallback 불필요. unrecognized 값이 혹시 등장하면 `'backlog'` 컬럼으로 귀속(기본값 일치). | confirmed |
| L44-R05 | 행 표시 범위: 사이드바에 보이는 모든 프로젝트 (팀+개인). 내 task 0건이어도 행 표시 | confirmed |
| L44-R06 | 행 정렬: 사이드바 순서와 동일 (팀 프로젝트 먼저, 개인 프로젝트 나중) | confirmed |
| L44-R07 | 접힌 행: 시간 카테고리별 task 카운트 1줄 | confirmed |
| L44-R08 | 펼친 행: 프로젝트 헤더 + MS sub-row + 직속 task sub-row | confirmed |
| L44-R09 | 셀 내 task: 체크박스 + task 이름. 세로 stack | confirmed |
| L44-R10 | task 표시 조건: `assigneeId === currentUserId` (내 task만). Secondary 처리는 **본 Loop 미포함** (개인 뷰에서는 자기 자신의 Primary만 의미 있음) | confirmed |
| L44-R11 | 빈 셀: `·` (text-tertiary) 중앙 정렬. hover 시 + 버튼 노출 | confirmed |
| L44-R12 | 빈 셀 + 버튼 클릭 → 해당 프로젝트 × 해당 시간 카테고리로 inline task 생성. assigneeId 자동 = 본인 | confirmed |
| L44-R13 | 카운트 색상: Loop 42와 동일 (5+ amber, 10+ coral). designTokens 토큰 재사용 | confirmed |
| L44-R14 | Sticky: 첫 컬럼 + 헤더 행 (Loop 42와 동일) | confirmed |
| L44-R15 | 한국어 wrap: `word-break: keep-all` (Loop 42와 동일) | confirmed |
| L44-R16 | Toolbar: "today 필터 ON" 토글 **삭제**. 전체 펼치기 토글만 유지 | confirmed |
| L44-R17 | 펼침 상태: **`usePivotExpandState(scope='personal')` hook 사용** (Loop 42 패턴 재사용). localStorage 키 `'personalMatrixPivotExpanded'`. `useStore.collapseState`는 사용 안 함 (ui_state 단일 row 충돌 회피) | confirmed |
| L44-R18 | 자동 펼침: `key_milestone_id IS NULL` 직속 task가 있는 프로젝트 | confirmed |
| L44-R19 | 셀 내 task 클릭 → inline 편집 (Loop 42 R21과 동일 패턴) | confirmed |
| L44-R20 | 셀 내 체크박스 → done 토글 즉시 반영 | confirmed |
| L44-R21 | task category 변경: 셀 간 DnD는 **본 Loop 미포함**. 단 task 상세 편집에서 category 변경 가능 (기존 동작 유지) | confirmed |
| L44-R22 | 직속 task sub-row → 라벨 없음 (Loop 42 R26과 동일) | confirmed |
| L44-R23 | `PersonalMatrixGrid` 외부 시그니처 유지. 내부만 PersonalPivotMatrixTable에 위임 | confirmed |
| L44-R24 | UnifiedGridView의 개인 매트릭스 분기 — 백로그 사이드바 분기는 이미 Loop 42에서 제거됨. 추가 변경 최소 | confirmed |
| L44-R25 | "오늘" → "지금 할일" 명칭 변경 (Sub-Loop 7 잔여 작업) — toolbar/카테고리 라벨/store action label 일괄 적용 | confirmed |

---

## 3. 컴포넌트 설계

### 3.1 PersonalPivotMatrixTable (메인)

**파일**: `src/components/views/grid/PersonalPivotMatrixTable.jsx`

**역할**: 개인 피벗 테이블 컨테이너. Loop 42 PivotMatrixTable과 구조적으로 동일하나 컬럼 정의와 셀 렌더링 다름.

**Props**:
```js
{
  projects: Project[],          // 팀 + 개인 전체
  tasks: Task[],                // UnifiedGridView가 넘기는 myTasks — 이미 assigneeId 기준 사전 필터됨
  milestones: Milestone[],      // L1 flat
}
// currentUserId는 getCachedUserId() 동기 함수로 내부 획득 (prop 불필요).
// sub-row 컴포넌트(MsSubRow, UngroupedSubRow, TimeCell)에는 currentUserId prop 전달 유지.
```

**State**:
- `expandedProjectIds: Set<string>`
- `editingTaskId: string | null`

**시간 카테고리 정의** (recon 후 실제 enum 반영):
```js
const TIME_COLUMNS = [
  { key: 'today',   label: '지금 할일' },
  { key: 'next',    label: '다음 할일' },
  { key: 'backlog', label: '남은 할일' },
]
// 매칭 함수: (task) => task.category === col.key
// 'done' 카테고리는 t.done === true와 중복되므로 `!t.done` 필터가 별도 제외
```
NULL category는 [mapTask:173](../../src/hooks/useStore.js#L173)에서 `'backlog'`로 강제 변환되어 자동으로 남은 할일 컬럼에 귀속. UI에 별도 fallback 불필요.

### 3.2 PersonalPivotProjectRow

**파일**: `src/components/views/grid/cells/PersonalPivotProjectRow.jsx`

**역할**: 접힘/펼침 프로젝트 행. 컬럼 위치만 시간 컬럼으로 변경.

**카운트 계산**:
```js
const countByTimeCol = TIME_COLUMNS.reduce((acc, col) => {
  acc[col.key] = tasks.filter(t =>
    t.projectId === project.id &&
    t.assigneeId === currentUserId &&
    !t.done &&
    col.match(t.category)
  ).length
  return acc
}, {})
```

### 3.3 PersonalPivotMsSubRow

**파일**: `src/components/views/grid/cells/PersonalPivotMsSubRow.jsx`

**역할**: 펼친 프로젝트 안의 MS sub-row. 첫 컬럼 MS 이름, 시간 컬럼에 PersonalPivotTimeCell.

### 3.4 PersonalPivotTimeCell

**파일**: `src/components/views/grid/cells/PersonalPivotTimeCell.jsx`

**역할**: 한 셀(MS × 시간 카테고리) 내 task 리스트.

**Props**: `{ tasks, timeCol, projectId, milestoneId, currentUserId }`

**렌더링 로직**:
```js
const cellTasks = tasks.filter(t =>
  t.assigneeId === currentUserId &&
  timeCol.match(t.category)
)
// 모두 동일 weight/color (Loop 42와 달리 Primary/Secondary 구분 없음)
```

**빈 셀 + 버튼** (R12):
```js
onClickAdd → createTask({
  projectId, keyMilestoneId: milestoneId, // null이면 직속
  assigneeId: currentUserId,
  category: timeCol.matchValue,           // 'today' | 'thisWeek' | 'someday'
  text: ''
})
→ 즉시 inline 편집 모드 진입
```

**Inline 편집**: Loop 42 R21과 동일 패턴 (ProjectLaneCard.jsx:48-60 참조).

### 3.5 PersonalPivotUngroupedSubRow

**파일**: `src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx`

**역할**: keyMilestoneId === null인 task의 sub-row. PersonalPivotMsSubRow와 동일 셸이지만 첫 컬럼 라벨이 비어있음 (R22).

---

## 4. 기존 코드 변경

### 4.1 PersonalMatrixGrid (Wrapper 패턴)

**파일**: `src/components/views/grid/grids/PersonalMatrixGrid.jsx`

**변경 후**:
```jsx
import PersonalPivotMatrixTable from '../PersonalPivotMatrixTable'

export default function PersonalMatrixGrid(props) {
  const { projects, tasks, milestones, currentUserId } = props
  return (
    <PersonalPivotMatrixTable
      scope="personal"
      projects={projects}
      tasks={tasks}
      milestones={milestones}
      currentUserId={currentUserId}
    />
  )
}
```

### 4.2 UnifiedGridView 검토

**파일**: `src/components/views/UnifiedGridView.jsx`

- 백로그 사이드바 분기는 Loop 42에서 이미 제거됨
- 개인 매트릭스 분기 자체는 변경 없음 (PersonalMatrixGrid가 내부에서 위임)
- "today 필터 ON" 토글 컴포넌트가 UnifiedGridView 또는 PersonalMatrixGrid에 있다면 **제거** (R16)

### 4.3 usePivotExpandState hook 확장 (Loop 42 패턴 재사용)

**⚠️ 정정**: Loop 42의 팀 매트릭스 펼침 상태는 `useStore.collapseState`가 아니라 [src/hooks/usePivotExpandState.js](../../src/hooks/usePivotExpandState.js)에서 localStorage로 관리 중 (ui_state 단일 row 충돌 회피 목적). Loop 44는 동일 hook을 **scope 파라미터로 확장**하여 재사용한다.

**변경안**:
```js
// src/hooks/usePivotExpandState.js
export default function usePivotExpandState(scope = 'team') {
  const KEY = scope === 'personal'
    ? 'personalMatrixPivotExpanded'
    : 'matrixPivotExpanded'
  // 기존 로직 동일
}
```

**사용 예시** (PersonalPivotMatrixTable):
```js
const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('personal')
```

**useStore.js 변경 없음**.

### 4.4 "오늘" → "지금 할일" 명칭 변경 (R25)

**대상**: Sub-Loop 7에서 미적용된 명칭 변경.

**grep 대상**:
```bash
grep -rn '오늘' src/components/ src/hooks/ src/utils/
grep -rn "label.*today\|label.*'오늘'" src/
```

**처리 원칙**:
- 사용자에게 보이는 "오늘" 라벨 → "지금 할일"로 변경
- DB enum 값 `'today'`는 **변경 안 함** (마이그레이션 회피)
- 코드 내 변수명 `today` 등은 유지 (rename은 별도 작업)

**범위**: 본 Loop의 신규 컴포넌트(PersonalPivotMatrixTable 등)는 처음부터 "지금 할일" 라벨 사용. 기존 컴포넌트 중 사용자에게 노출되는 "오늘" 텍스트만 일괄 정리.

---

## 5. 사전 확인 체크리스트 (diff 작성 전 필수)

| # | 확인 항목 | 방법 |
|---|----------|------|
| 1 | Loop 41/42 완료 여부 | DB 쿼리 + PivotMatrixTable 동작 확인 |
| 2 | task `category` 컬럼의 실제 enum 값 | `SELECT DISTINCT category FROM tasks WHERE category IS NOT NULL` |
| 3 | category enum 값과 컬럼 매핑 정합 | R03 매핑 테이블이 실제 enum과 일치하는지 검증 |
| 4 | category가 NULL인 task 개수 | `SELECT count(*) FROM tasks WHERE category IS NULL` (R04 동작 확인용) |
| 5 | 사이드바 프로젝트 정렬 기준 | `useStore`의 projects 셀렉터 정렬 로직 확인 |
| 6 | "today 필터 ON" 토글 위치 | `grep -rn 'today 필터\|todayFilter' src/` |
| 7 | "오늘" 텍스트 사용처 | §4.4 grep 명령 |
| 8 | task 생성 시 category 기본값 | `createTask` action 또는 task model 확인 |
| 9 | currentUserId 셀렉터 | `useStore`에서 어떻게 노출되는지 |

---

## 6. 성공 기준

- [ ] PersonalPivotMatrixTable + 4개 sub 컴포넌트 신규 생성
- [ ] PersonalMatrixGrid 내부가 PersonalPivotMatrixTable에 위임 (외부 시그니처 보존)
- [ ] 매트릭스 뷰가 시간 컬럼 3개로 표시 (지금 할일 / 다음 할일 / 남은 할일) — R03 교정 반영
- [ ] 모든 프로젝트가 행으로 표시 (내 task 0건이어도)
- [ ] category가 NULL/미설정인 task가 "지금 할일" 컬럼에 정상 표시
- [ ] "today 필터 ON" 토글이 UI에서 사라짐
- [ ] 접힌 행: 시간 카테고리별 카운트 표시. 5+ amber, 10+ coral 적용
- [ ] 펼친 행: MS sub-row + 직속 task sub-row 표시. 셀에 task 노출
- [ ] 빈 셀 hover → + 버튼. 클릭 시 해당 프로젝트 × 시간 카테고리로 새 task inline 생성
- [ ] 셀 내 task 클릭 → inline 편집
- [ ] 직속 task 있는 프로젝트가 자동 펼침 (R18)
- [ ] 펼침 상태 새로고침 시 복원 (localStorage)
- [ ] "오늘" 라벨이 사용자에게 보이는 모든 곳에서 "지금 할일"로 변경됨 (R25)
- [ ] 빌드 성공 (TDZ 에러 없음)

---

## 7. Rollback 계획

- git revert로 신규 컴포넌트 + 변경 사항 모두 되돌림
- DB 변경 없음 (R25는 라벨 변경만, enum 유지)
- PersonalMatrixGrid의 기존 코드는 git history에서 복원

---

## 8. Loop 42와의 일관성

| 항목 | Loop 42 (팀) | Loop 44 (개인) |
|------|-------------|----------------|
| 가로축 | 팀원 | 시간 카테고리 |
| 세로축 | 프로젝트 | 프로젝트 (팀+개인 전체) |
| 행 표시 범위 | 팀 프로젝트만 | 모든 프로젝트 (내 task 0건 포함) |
| 펼침 구조 | MS sub-row + 직속 sub-row | 동일 |
| 셀 내 task | Primary 진하게 + Secondary 연하게 (양쪽 셀 중복) | 자기 task만 (구분 없음) |
| 카운트 색상 | 5+ amber, 10+ coral | 동일 |
| 인라인 편집 | 가능 | 동일 |
| 빈 셀 + 버튼 | 가능 (해당 프로젝트 × 멤버) | 가능 (해당 프로젝트 × 시간 카테고리, assignee 자동 본인) |
| 자동 펼침 | 직속 task 있는 프로젝트 | 동일 |
| Sticky | 첫 컬럼 + 헤더 | 동일 |

**구조적 차이**: 컬럼 정의(멤버 vs 시간), 셀 task 필터링 로직(assignee 매칭 vs category 매칭). **외형 인터랙션은 거의 동일**하므로 사용자 학습 비용 최소.

---

## 9. 후속 작업 (이번 Loop 외)

- 시간 컬럼 간 DnD (task category 변경) — 후속 Loop
- 팀 매트릭스에 시간축 추가 옵션 (3차원 가능성) — 별도 phase
- task category enum 정규화 (`'today'` → `'now'` 등) — 별도 마이그레이션
- 개인 매트릭스에 Secondary task 표시 옵션 — 사용 후 결정
