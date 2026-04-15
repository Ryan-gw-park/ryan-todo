# Loop 42 — 매트릭스 피벗 뷰 (Matrix Pivot View)

> **Phase**: Matrix Pivot Implementation
> **Status**: Confirmed — 2026-04-15
> **Depends on**: Loop 41 (MS L1 flat, 1:1 cleanup 완료)
> **Blocks**: 없음 (Loop 43과 독립)
> **Loop 번호 검증**: 2026-04-15 기준 docs/loops/ 최신 = loop-40. 41/42/43 연속 번호 정합.
> **Related docs**: matrix-redesign-spec.md (원본 통합 spec), matrix-redesign-01-spec.md

---

## 0. 목적

팀 매트릭스 뷰를 **피벗 테이블**로 재설계한다. 가로축 = 팀원, 세로축 = 프로젝트. 각 셀에서 "이 프로젝트에서 이 사람이 뭘 하고 있는지"를 바로 본다.

이 Loop가 **사용자가 느끼는 가장 큰 변화**다.

---

## 1. Scope

### 포함
- 신규 컴포넌트 5개 (PivotMatrixTable, PivotProjectRow, PivotMsSubRow, PivotTaskCell, PivotUngroupedSubRow)
- `TeamMatrixGrid` 내부를 PivotMatrixTable로 위임 (Wrapper 패턴 — Option A)
- `MsBacklogSidebar` 컴포넌트 삭제 (DELETE-5)
- `backlogFilter.js` 유틸 삭제 (DELETE-5)
- `UnifiedGridView`에서 백로그 사이드바 분기 제거
- `designTokens.js`에 amber/coral pill 토큰 추가
- 펼침 상태 영속화 (`useStore.collapseState['matrixPivot']`)
- R27 자동 펼침: 직속 task 있는 프로젝트만
- R30 양쪽 셀 중복 표시 (Primary 진하게, Secondary 연하게)

### 제외
- MS 구조 평탄화 → Loop 41 (선행)
- ProjectView (BacklogPanel, MsTaskTreeMode) → Loop 43
- "상위 MS 선택" UI 제거 → Loop 43
- 개인 매트릭스 (PersonalMatrixView) → 별도 phase
- task DnD (셀 간 이동) → 후속 Loop

---

## 2. REQ-LOCK 요구사항

| ID | 요구사항 | 상태 |
|----|---------|------|
| L42-R01 | 매트릭스 축: rows = 프로젝트, cols = 팀원 (피벗 테이블) | confirmed |
| L42-R02 | 컬럼: 프로젝트명(170px sticky) + 멤버 N개(115px each) + 합계(55px) | confirmed |
| L42-R03 | 멤버 컬럼: 팀 전체 멤버 항상 표시 (빈 컬럼 포함) | confirmed |
| L42-R04 | 접힌 행: 멤버별 Primary task 카운트 1줄 | confirmed |
| L42-R05 | 펼친 행: 프로젝트 헤더(카운트 유지) + MS sub-row + 직속 task sub-row | confirmed |
| L42-R06 | 셀 내 task: 체크박스 + task 이름. 세로 stack | confirmed |
| L42-R07 | Primary task: `color-text-primary`, `font-weight: 500` | confirmed |
| L42-R08 | Secondary task: `color-text-tertiary`, `font-weight: 400`. 별도 태그 없음 | confirmed |
| L42-R09 | **R30**: Secondary task는 해당 멤버 셀에도 중복 표시 (연하게). 같은 task가 Primary 셀에 진하게, Secondary 셀에 연하게 동시 등장 | confirmed |
| L42-R10 | 카운트 집계: Primary만. Secondary는 카운트에 포함 안 됨 | confirmed |
| L42-R11 | 빈 셀: `·` (text-tertiary) 중앙 정렬 | confirmed |
| L42-R12 | 카운트 색상: 5+ amber pill, 10+ coral pill | confirmed |
| L42-R13 | designTokens에 amber/coral pill 토큰 추가 | confirmed |
| L42-R14 | Sticky: 첫 컬럼 (left: 0), 헤더 행 (top: 0) | confirmed |
| L42-R15 | 가로 부족 시 overflow-x: auto | confirmed |
| L42-R16 | 한국어 wrap: `word-break: keep-all; overflow-wrap: break-word` | confirmed |
| L42-R17 | Toolbar: 전체/미배정/배정됨 필터 + 전체 펼치기 토글. **Filter semantic**: `전체` = 모든 팀 task (scope='team' 또는 'assigned'), `미배정` = `assigneeId IS NULL AND secondaryAssigneeId IS NULL AND scope='team'`, `배정됨` = `assigneeId IS NOT NULL OR secondaryAssigneeId IS NOT NULL`. 필터는 **셀 내 task 표시**에만 적용. 프로젝트/멤버 컬럼 목록은 영향 없음 | confirmed |
| L42-R18 | DepthToggle 없음 (Loop 41에서 삭제됨) | confirmed |
| L42-R19 | 펼침 상태: `useStore.collapseState['matrixPivot']`에 저장. 새로고침 시 복원 | confirmed |
| L42-R20 | **R27**: 기본 상태 = 전체 접힘. 단, `key_milestone_id IS NULL` 직속 task가 있는 프로젝트는 자동 펼침 | confirmed |
| L42-R21 | 셀 내 task 클릭 → inline 편집 (drawer 아님) | confirmed |
| L42-R22 | 셀 내 task 체크박스 → done 토글 (즉시 반영) | confirmed |
| L42-R23 | 빈 셀 hover → + 버튼 노출. 클릭 시 inline 새 task 생성. **자동 필드 설정**: `projectId` = 해당 행 프로젝트, `assigneeId` = 해당 컬럼 멤버 userId (미배정 컬럼이면 `null`), `secondaryAssigneeId` = `null`, `keyMilestoneId` = sub-row의 MS ID (MS sub-row인 경우) 또는 `null` (직속 task sub-row 또는 접힌 상태), `scope` = `assigneeId`에 따라 `applyTransitionRules`가 결정, `category` = `'backlog'` (기본값), `teamId` = `currentTeamId` | confirmed |
| L42-R24 | 멤버 컬럼 헤더 클릭 → Members View로 이동 (해당 멤버 필터) | confirmed |
| L42-R25 | 합계 컬럼 셀 클릭 → 해당 프로젝트의 모든 task를 drawer로 표시 | confirmed |
| L42-R26 | 직속 task sub-row → 라벨 없음 (익명 sub-row, chevron + indent + 빈 헤더 영역) | confirmed |
| L42-R27 | 백로그 사이드바(`MsBacklogSidebar`) 컴포넌트 삭제 (DELETE-5) | confirmed |
| L42-R28 | `backlogFilter.js` 유틸 삭제 (DELETE-5) | confirmed |
| L42-R29 | `TeamMatrixGrid` 외부 시그니처 유지. 내부만 PivotMatrixTable에 위임 (Wrapper) | confirmed |
| L42-R30 | `UnifiedGridView`에서 백로그 사이드바 분기 제거 | confirmed |

---

## 3. 컴포넌트 설계

### 3.1 PivotMatrixTable (메인)

**파일**: `src/components/views/grid/PivotMatrixTable.jsx`

**역할**: 피벗 테이블 전체 컨테이너. sticky 헤더/첫 컬럼, overflow-x, toolbar, 펼침 상태 관리.

**Props**:
```js
{
  scope: 'team',
  projects: Project[],
  members: Member[],         // 팀 전체 멤버
  tasks: Task[],
  milestones: Milestone[],   // L1 flat
  filter: 'all' | 'unassigned' | 'assigned'
}
```

**State**:
- `expandedProjectIds: Set<string>` — 어떤 프로젝트 행이 펼쳐져 있는지
- `editingTaskId: string | null` — 인라인 편집 중인 task ID

**자동 펼침 로직** (L42-R20):
```js
const initialExpanded = new Set(
  projects
    .filter(p => tasks.some(t => t.projectId === p.id && t.keyMilestoneId === null))
    .map(p => p.id)
)
// + localStorage에서 복원한 명시적 펼침 상태 merge
```

**구조**:
```jsx
<div className="pv-wrap" style={{ overflowX: 'auto' }}>
  <table className="pv">
    <colgroup>...</colgroup>
    <thead><tr>{Header cells}</tr></thead>
    <tbody>
      {projects.map(p => (
        <PivotProjectRow ... />
        {expanded && (
          <>
            {milestones.filter(m => m.projectId === p.id).map(m => (
              <PivotMsSubRow ... />
            ))}
            {hasUngroupedTasks && (
              <PivotUngroupedSubRow ... />
            )}
          </>
        )}
      ))}
    </tbody>
  </table>
</div>
```

### 3.2 PivotProjectRow

**파일**: `src/components/views/grid/cells/PivotProjectRow.jsx`

**역할**: 접힘/펼침 상태의 프로젝트 행. 카운트 표시 (5+ amber, 10+ coral).

**Props**: `{ project, members, tasks, isExpanded, onToggle, totals }`

**카운트 계산**: Primary assignee 기준만. Secondary는 별도 표시 안 함 (R10).

### 3.3 PivotMsSubRow

**파일**: `src/components/views/grid/cells/PivotMsSubRow.jsx`

**역할**: 펼친 프로젝트 안의 MS sub-row. 첫 컬럼에 MS 이름, 멤버 컬럼에 PivotTaskCell.

**Props**: `{ milestone, members, tasks }` (tasks는 이미 필터링된 그 MS의 task만)

### 3.4 PivotTaskCell

**파일**: `src/components/views/grid/cells/PivotTaskCell.jsx`

**역할**: 한 셀(MS × Member) 내 task 리스트 렌더링. Primary/Secondary 구분, inline 편집.

**Props**: `{ tasks, memberId, projectId, milestoneId }`

**렌더링 로직** (R30 양쪽 셀 중복):
```js
// 이 셀에 표시할 task =
//   (assigneeId === memberId) → Primary로 표시 (진하게)
//   (secondaryAssigneeId === memberId) → Secondary로 표시 (연하게)

const cellTasks = tasks.filter(t =>
  t.assigneeId === memberId || t.secondaryAssigneeId === memberId
)

cellTasks.map(task => {
  const isPrimary = task.assigneeId === memberId
  const style = isPrimary
    ? { color: COLOR.textPrimary, fontWeight: 500 }
    : { color: COLOR.textTertiary, fontWeight: 400 }
  return <TaskRow ... style={style} />
})
```

**Inline 편집** (R21):
```js
const [editing, setEditing] = useState(false)
onClick → setEditing(true) → input 노출
onBlur/Enter → updateTask(id, { text: trimmed }) → setEditing(false)
```

**참고 패턴**: `src/components/shared/ProjectLaneCard.jsx:48-60`의 inline 편집 패턴 차용.

### 3.5 PivotUngroupedSubRow

**파일**: `src/components/views/grid/cells/PivotUngroupedSubRow.jsx`

**역할**: keyMilestoneId === null인 task의 sub-row. PivotMsSubRow와 동일 셸이지만 첫 컬럼 라벨이 비어있음 (R26 익명).

**Props**: `{ members, tasks }` (tasks는 이미 ungrouped 필터링됨)

**시각 단서**:
- 좌측 indent (다른 MS sub-row와 동일한 들여쓰기)
- 빈 헤더 영역 (텍스트 없이 chevron만 표시 또는 chevron도 없이 indent만)
- 위/아래 divider로 구분

---

## 4. 스타일 토큰 (designTokens.js 추가)

```js
// 카운트 pill (R12)
amberPill: {
  bg: '#FAEEDA',
  fg: '#854F0B',
  borderRadius: 10,
  padding: '1px 8px',
  fontWeight: 500
},
coralPill: {
  bg: '#FAECE7',
  fg: '#993C1D',
  borderRadius: 10,
  padding: '1px 8px',
  fontWeight: 500
},

// 빈 셀 마커 (R11)
emptyCellMarker: {
  color: 'var(--color-text-tertiary)',
  fontSize: 13,
  textAlign: 'center'
},

// MS sub-row 배경
msSubRowBg: '#FAFAF7'
```

**TDZ 주의**: 메모리의 "Vite production build TDZ rule" 준수. `const S = COLOR` 같은 모듈 레벨 참조 금지. 컴포넌트 함수 본문 내에서 참조.

---

## 5. 기존 코드 변경

### 5.1 TeamMatrixGrid (Wrapper 패턴 — Option A)

**파일**: `src/components/views/grid/grids/TeamMatrixGrid.jsx`

**변경 전**: 84줄, 3×3 카드 그리드 직접 렌더링.

**변경 후**: PivotMatrixTable에 위임.

```jsx
import PivotMatrixTable from '../PivotMatrixTable'

export default function TeamMatrixGrid(props) {
  // 기존 props 파싱
  const { projects, members, tasks, milestones, filter } = props
  return (
    <PivotMatrixTable
      scope="team"
      projects={projects}
      members={members}
      tasks={tasks}
      milestones={milestones}
      filter={filter}
    />
  )
}
```

**외부 시그니처 보존**: 메모리의 "Don't Touch, Wrap It" 원칙. UnifiedGridView 등에서 import는 그대로.

### 5.2 UnifiedGridView 수정

**파일**: `src/components/views/UnifiedGridView.jsx`

**변경**:
- 백로그 사이드바 (MsBacklogSidebar) 분기 제거
- main 영역이 100% 폭 사용하도록 layout 조정
- 팀 매트릭스 모드 분기는 그대로 (TeamMatrixGrid가 내부에서 PivotMatrixTable 호출)

### 5.3 useStore.js — collapseState 키 추가

**파일**: `src/hooks/useStore.js`

**기존 `collapseState`** (Phase 12d 등에서 사용)에 새 키 추가:
```js
collapseState: {
  ...,
  matrixPivot: {            // 신규
    [projectId]: boolean    // true = 명시적 펼침, false = 명시적 접힘, undefined = 자동 결정
  }
}
```

**자동 펼침과의 충돌**: 사용자가 명시적으로 접은 프로젝트는 직속 task가 있어도 접힘 유지. 명시적 접힘이 자동 펼침보다 우선.

---

## 6. 컴포넌트 삭제 (DELETE-5)

### 6.1 MsBacklogSidebar

**파일**: `src/components/common/MsBacklogSidebar.jsx` (352줄)

**삭제 사유**: 백로그 패널 폐기 (R27).

**DELETE-5 grep**:
```bash
grep -rn 'MsBacklogSidebar' src/
grep -rn 'from.*MsBacklogSidebar' src/
```

**예상 사용처**: UnifiedGridView. 다른 곳에 있다면 별도 검토.

### 6.2 backlogFilter.js

**파일**: `src/utils/backlogFilter.js` (7줄)

**삭제 사유**: "백로그" 개념 폐기. `isBacklogTask` 유틸 불필요.

**DELETE-5 grep**:
```bash
grep -rn 'backlogFilter\|isBacklogTask' src/
```

---

## 7. 사전 확인 체크리스트 (diff 작성 전)

| # | 확인 항목 | 방법 |
|---|----------|------|
| 1 | Loop 41 완료 여부 (MS parent_id NULL, 1:1 cleanup 완료) | `SELECT count(*) FROM key_milestones WHERE parent_id IS NOT NULL` = 0 |
| 2 | `MsBacklogSidebar` import 사용처 | `grep -rn 'MsBacklogSidebar' src/` |
| 3 | `backlogFilter.js` 사용처 | `grep -rn 'backlogFilter\|isBacklogTask' src/` |
| 4 | 팀 멤버 데이터 소스 | `useStore`에서 `members` 셀렉터 확인 |
| 5 | task의 `secondaryAssigneeId` 컬럼 존재 확인 | DB 스키마 또는 type 정의 확인 |
| 6 | `useStore.collapseState` 패턴 | 기존 키 사용 사례 (Phase 12d 등) 확인 |
| 7 | inline 편집 참조 패턴 | `ProjectLaneCard.jsx:48-60` 확인 |

---

## 8. 성공 기준

- [ ] PivotMatrixTable + 4개 sub 컴포넌트 신규 생성
- [ ] TeamMatrixGrid 내부가 PivotMatrixTable에 위임 (외부 시그니처 보존)
- [ ] MsBacklogSidebar 파일 삭제됨
- [ ] backlogFilter.js 파일 삭제됨
- [ ] DELETE-5 검증 테이블 diff 문서에 포함
- [ ] designTokens에 amber/coral pill + emptyCellMarker + msSubRowBg 추가
- [ ] 매트릭스 뷰가 피벗 테이블로 표시됨
- [ ] 멤버 컬럼이 팀 전체 멤버 표시 (빈 컬럼 포함)
- [ ] 접힌 행: 카운트만 표시. 5+ amber pill, 10+ coral pill 적용
- [ ] 펼친 행: MS sub-row + 직속 task sub-row 표시. 셀에 task 노출
- [ ] Primary task 진하게, Secondary task 연하게. Secondary는 양쪽 셀에 중복 표시
- [ ] 직속 task 있는 프로젝트가 기본 펼침 상태 (R27)
- [ ] 펼침 상태 새로고침 시 복원 (localStorage)
- [ ] 셀 내 task 클릭 → inline 편집
- [ ] 빈 셀 hover → + 버튼
- [ ] 빌드 성공 (TDZ 에러 없음)

---

## 9. Rollback 계획

- git revert로 신규 컴포넌트 + 변경 사항 모두 되돌림
- DB 변경은 없으므로 (Loop 41에서 처리됨) 추가 작업 불필요
- TeamMatrixGrid의 기존 84줄 코드는 git history에서 복원

---

## 10. 시각적 참고

대화 중 작성된 mockup widget ("team_matrix_pivot_v3_with_secondary_assignee")는 repo에 저장되어 있지 않음. diff 작성 시 **본 spec 문서의 수치와 ASCII 레이아웃을 ground truth로 사용**:

**확정 수치** (통합 spec §4.1 + §4.2 참조):
- 컬럼 폭: 프로젝트명 170px (sticky), 멤버 115px each, 합계 55px
- 헤더 행 높이: 기본 36px (`ROW.standard`, designTokens.js)
- Sub-row 행 높이: 30px (`ROW.compact`)
- MS sub-row 배경: `#FAFAF7`
- 셀 패딩: `4px 8px` (`SPACE.cellPadding`)
- 빈 셀 마커: `·` (text-tertiary, fontSize 13, 중앙)
- 카운트 pill: 5+ amber(`#FAEEDA`/`#854F0B`), 10+ coral(`#FAECE7`/`#993C1D`), borderRadius 10, padding `1px 8px`
- 첫 컬럼 sticky: `position: sticky; left: 0; z-index: 2`
- 헤더 행 sticky: `position: sticky; top: 0; z-index: 3`
- 좌상단 교차 셀: `z-index: 4`

**시각 디테일 미결 사항**: diff 작성자가 위 수치로 빌드한 결과를 screenshot으로 검증 후 필요시 미세 조정.
