# Loop 42 — 매트릭스 피벗 뷰 Diff Plan

> **Phase**: Matrix Pivot Implementation
> **Spec**: [matrix-redesign-02-spec.md](./matrix-redesign-02-spec.md)
> **Date**: 2026-04-15
> **Depends on**: Loop 41 완료 (MS parent_id NULL, 1:1 cleanup 완료)
> **Independent of**: Loop 43

---

## 0. 사전 조사 결과

| 항목 | 결과 |
|------|------|
| MsBacklogSidebar 사용처 | **UnifiedGridView.jsx:8 (import), :478 (렌더)**만 — 단일 |
| backlogFilter 사용처 | **BacklogPanel.jsx:4, :117**만 — BacklogPanel은 Loop 43에서 처리. **본 Loop에서 `backlogFilter.js` 삭제 보류** (Loop 43로 이관) |
| TeamMatrixGrid props | `{projects, tasks, members, collapsed, toggleCollapse, toggleDone, openDetail, activeId, currentTeamId, groupByOwner}` (84줄 전체) |
| UnifiedGridView layout 구조 | 434: main flex 컨테이너 → 435: DndContext → 436-475: 좌측 그리드 → 478: MsBacklogSidebar (우측) |
| designTokens.js 구조 | 8줄 COLOR 객체 / 23줄 FONT / 37줄 SPACE / 53줄 ROW / 61줄 GANTT. amber/coral pill 추가 위치 = 새 객체 or COLOR 확장 |

---

## 1. 변경할 파일 목록

### 1.1 신규 파일 (5개 컴포넌트)

| 파일 | 역할 | 예상 줄수 |
|------|------|----------|
| `src/components/views/grid/PivotMatrixTable.jsx` | 메인 피벗 테이블 컨테이너. sticky, overflow-x, 펼침 상태 관리 | ~250 |
| `src/components/views/grid/cells/PivotProjectRow.jsx` | 접힌/펼친 프로젝트 행. 멤버별 카운트, 카운트 pill | ~120 |
| `src/components/views/grid/cells/PivotMsSubRow.jsx` | MS sub-row (L1 flat). 첫 컬럼 MS 이름 + 멤버 셀 | ~90 |
| `src/components/views/grid/cells/PivotTaskCell.jsx` | 한 셀 내 task 리스트. Primary/Secondary 분기, inline 편집, 빈 셀 hover + 버튼 | ~180 |
| `src/components/views/grid/cells/PivotUngroupedSubRow.jsx` | keyMilestoneId=null sub-row. 첫 컬럼 라벨 없음(익명), chevron+indent | ~80 |

### 1.2 삭제 파일

| 파일 | 삭제 사유 |
|------|----------|
| [src/components/common/MsBacklogSidebar.jsx](../../src/components/common/MsBacklogSidebar.jsx) (352줄) | 백로그 사이드바 폐기 (통합 spec R08) |

**주**: `src/utils/backlogFilter.js` 삭제는 Loop 43으로 이관 (BacklogPanel이 여전히 사용 중).

### 1.3 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| [src/components/views/grid/grids/TeamMatrixGrid.jsx](../../src/components/views/grid/grids/TeamMatrixGrid.jsx) (84줄) | 내부 전부 교체 → `PivotMatrixTable` 위임. 외부 props 시그니처 유지 (Wrapper 패턴, 통합 spec §10) |
| [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx):8 | MsBacklogSidebar import 제거 |
| [src/components/views/UnifiedGridView.jsx](../../src/components/views/UnifiedGridView.jsx):434-478 | layout 재구성 — 우측 사이드바 `<MsBacklogSidebar>` 렌더 제거. 좌측 그리드가 100% 폭 사용하도록 `flex: 1` 제거 또는 wrapper 정리 |
| [src/styles/designTokens.js](../../src/styles/designTokens.js) | `amberPill`, `coralPill`, `emptyCellMarker`, `msSubRowBg` 토큰 추가 (기존 COLOR 객체 뒤에 별도 객체로) |
| [src/hooks/useStore.js](../../src/hooks/useStore.js) addTask | **세미 수정**: `assigneeId: task.assigneeId || userId` (line ~529) falsy 치환이 명시 `null` 전달을 userId로 덮는 문제. `'assigneeId' in task ? task.assigneeId : userId`로 변경 — Primary 피벗 뷰에서 미배정 컬럼 생성 지원. 기존 `assigneeId` 미전달 케이스는 동일 동작 유지 |
| `src/hooks/usePivotExpandState.js` (신규) | **matrixPivot 전용 localStorage hook** — `useStore.collapseState` 동기화 루프 **미사용** (ui_state는 id='default' 단일 row로 per-project 상태에 부적합, cross-device/session 충돌 위험). localStorage key: `matrixPivotExpanded` |

### 1.4 변경 없음 (유지)

- tasks / key_milestones 테이블 (Loop 41에서 처리 완료)
- mapTask, addTask, updateTask, applyTransitionRules
- 개인 매트릭스 (PersonalMatrixGrid) — R21 별도 phase
- 주간 플래너 (PersonalWeeklyGrid, TeamWeeklyGrid)

---

## 2. DB 마이그레이션

**없음.** 본 Loop는 UI/컴포넌트 변경만. DB는 Loop 41에서 완료.

---

## 3. API 변경

**없음.** 기존 store 메서드만 사용 (`updateTask`, `addTask`, `toggleDone`, `openDetail`).

---

## 4. 프론트엔드 변경 상세

### 4.1 신규 컴포넌트 설계

#### 4.1.1 PivotMatrixTable.jsx

```jsx
// src/components/views/grid/PivotMatrixTable.jsx
import { useState, useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import { COLOR, FONT, SPACE, ROW } from '../../../styles/designTokens'
import PivotProjectRow from './cells/PivotProjectRow'
import PivotMsSubRow from './cells/PivotMsSubRow'
import PivotUngroupedSubRow from './cells/PivotUngroupedSubRow'

import usePivotExpandState from '../../../hooks/usePivotExpandState'

export default function PivotMatrixTable({ projects, members, tasks, milestones, filter = 'all' }) {
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState()
  const setView = useStore(s => s.setView)
  const setMemberFilter = useStore(s => s.setMemberFilter) // 존재 확인 필요, 없으면 신규 추가

  // 자동 펼침: 직속 task 있는 프로젝트 (R27)
  // 명시적 접힘이 자동 펼침보다 우선 (spec §5.3)
  const isExpanded = (pid) => {
    const explicit = pivotCollapsed[pid]
    if (explicit === true) return true   // 명시 펼침
    if (explicit === false) return false // 명시 접힘
    // undefined: 자동 결정
    return tasks.some(t => t.projectId === pid && t.keyMilestoneId == null && !t.done && !t.deletedAt)
  }

  const toggleProject = (pid) => {
    setPivotCollapsed(pid, !isExpanded(pid))
  }

  // L42-R24: 멤버 헤더 클릭 → Members View
  const navigateToMembersView = (userId) => {
    // 실제 구현은 기존 라우팅 패턴 재사용 (setView는 Zustand로 currentView 전환)
    setMemberFilter?.(userId)
    setView('members')
  }

  // Filter 적용 (R31): 셀 내 표시 task만 필터 (목록/컬럼은 영향 없음)
  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks
    if (filter === 'unassigned') return tasks.filter(t =>
      t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team')
    if (filter === 'assigned') return tasks.filter(t =>
      t.assigneeId != null || t.secondaryAssigneeId != null)
    return tasks
  }, [tasks, filter])

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 170 + members.length * 115 + 55 }}>
        <colgroup>
          <col style={{ width: 170 }} />
          {members.map(m => <col key={m.userId} style={{ width: 115 }} />)}
          <col style={{ width: 115 }} />  {/* 미배정 */}
          <col style={{ width: 55 }} />   {/* 합계 */}
        </colgroup>
        <thead>
          <tr>
            <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 4, background: '#fff' }}>
              프로젝트 · 마일스톤
            </th>
            {members.map(m => (
              <th key={m.userId}
                  style={{ position: 'sticky', top: 0, zIndex: 3, background: '#fff', cursor: 'pointer' }}
                  onClick={() => navigateToMembersView(m.userId)}>
                {m.displayName || '?'}
              </th>
            ))}
            <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#fff' }}>미배정</th>
            <th style={{ position: 'sticky', top: 0, zIndex: 3, background: '#fff' }}>합계</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => {
            const projTasks = filteredTasks.filter(t => t.projectId === p.id && !t.done && !t.deletedAt)
            const projMilestones = milestones.filter(m => m.projectId === p.id)
            const ungrouped = projTasks.filter(t => t.keyMilestoneId == null)
            const expanded = isExpanded(p.id)
            return (
              <React.Fragment key={p.id}>
                <PivotProjectRow
                  project={p} members={members} tasks={projTasks}
                  isExpanded={expanded} onToggle={() => toggleProject(p.id)} />
                {expanded && projMilestones.map(ms => (
                  <PivotMsSubRow
                    key={`ms-${ms.id}`}
                    milestone={ms} members={members}
                    tasks={projTasks.filter(t => t.keyMilestoneId === ms.id)} />
                ))}
                {expanded && ungrouped.length > 0 && (
                  <PivotUngroupedSubRow
                    key={`ungr-${p.id}`}
                    project={p} members={members} tasks={ungrouped} />
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

#### 4.1.2 PivotProjectRow.jsx

```jsx
// 접힌/펼친 상태 공통. 카운트 pill (5+ amber, 10+ coral)
// Primary 기준 카운트만 집계 (R06)
import { COLOR } from '../../../../styles/designTokens'

export default function PivotProjectRow({ project, members, tasks, isExpanded, onToggle }) {
  const countByMember = {}
  for (const m of members) {
    // Primary만 (R06). Secondary는 카운트에서 제외
    countByMember[m.userId] = tasks.filter(t => t.assigneeId === m.userId).length
  }
  // 미배정 = R31 정의: assigneeId IS NULL AND secondaryAssigneeId IS NULL AND scope='team'
  const unassignedCount = tasks.filter(t =>
    t.assigneeId == null && t.secondaryAssigneeId == null && t.scope === 'team'
  ).length
  const total = tasks.length

  const renderCountCell = (n) => {
    if (n === 0) return <span style={{ color: COLOR.textTertiary, textAlign: 'center' }}>·</span>
    if (n >= 10) return <CoralPill>{n}</CoralPill>
    if (n >= 5) return <AmberPill>{n}</AmberPill>
    return <span>{n}</span>
  }

  return (
    <tr onClick={onToggle} style={{ cursor: 'pointer', borderBottom: `1px solid ${COLOR.border}` }}>
      <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2 }}>
        <Chevron expanded={isExpanded} /> {project.name} <span style={{ color: COLOR.textTertiary }}>{total}건</span>
      </td>
      {members.map(m => <td key={m.userId} style={{ textAlign: 'center' }}>{renderCountCell(countByMember[m.userId])}</td>)}
      <td style={{ textAlign: 'center' }}>{renderCountCell(unassignedCount)}</td>
      <td style={{ textAlign: 'center' }}>{total}</td>
    </tr>
  )
}
```

#### 4.1.3 PivotMsSubRow.jsx / PivotUngroupedSubRow.jsx

공통 구조. PivotMsSubRow는 첫 컬럼에 MS 이름, PivotUngroupedSubRow는 첫 컬럼 비움 (R24/R26).

```jsx
// PivotMsSubRow
<tr style={{ background: PIVOT.msSubRowBg }}>
  <td style={{ position: 'sticky', left: 0, background: PIVOT.msSubRowBg, zIndex: 2, paddingLeft: 24 }}>
    · {milestone.title}
  </td>
  {members.map(m => (
    <td key={m.userId}>
      <PivotTaskCell tasks={tasks} memberId={m.userId}
        projectId={milestone.projectId} milestoneId={milestone.id} />
    </td>
  ))}
  {/* 미배정 셀: memberId=null 전달 */}
  <td>
    <PivotTaskCell tasks={tasks} memberId={null}
      projectId={milestone.projectId} milestoneId={milestone.id} />
  </td>
  {/* 합계: 이 MS의 전체 task 수. tasks는 이미 이 MS로 필터된 상태 */}
  <td style={{ textAlign: 'center' }}>{tasks.length}</td>
</tr>

// PivotUngroupedSubRow — 동일 구조, 첫 컬럼 텍스트 없음 (R24)
<tr style={{ background: S.msSubRowBg }}>
  <td style={{ position: 'sticky', left: 0, background: S.msSubRowBg, zIndex: 2, paddingLeft: 24 }}>
    {/* 라벨 없음 */}
  </td>
  ...
</tr>
```

#### 4.1.4 PivotTaskCell.jsx (핵심)

```jsx
// 한 셀 내 task 표시 + inline 편집 + 빈 셀 hover + 버튼
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR } from '../../../../styles/designTokens'

export default function PivotTaskCell({ tasks, memberId, projectId, milestoneId }) {
  const updateTask = useStore(s => s.updateTask)
  const addTask = useStore(s => s.addTask)
  const toggleDone = useStore(s => s.toggleDone)
  const currentTeamId = useStore(s => s.currentTeamId)
  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [hover, setHover] = useState(false)

  // R30: Primary (assigneeId===memberId) + Secondary (secondaryAssigneeId===memberId)
  const cellTasks = tasks.filter(t =>
    t.assigneeId === memberId || t.secondaryAssigneeId === memberId
  )

  const handleEditFinish = (taskId, value) => {
    setEditingId(null)
    if (value?.trim()) updateTask(taskId, { text: value.trim() })
  }

  const handleAddNew = (text) => {
    setAddingNew(false)
    if (!text?.trim()) return
    // L42-R23 자동 필드
    // ⚠️ 주의: addTask는 internal에서 applyTransitionRules를 호출하지 않음 (useStore.js).
    //        scope는 명시 전달 필요. 또한 teamDefaults의 `assigneeId: task.assigneeId || userId`
    //        falsy 치환으로 미배정이 자기 자신으로 덮임 → memberId 명시 분기 필요.
    const isUnassignedColumn = memberId === null || memberId === undefined
    addTask({
      text: text.trim(),
      projectId,
      assigneeId: isUnassignedColumn ? null : memberId,
      secondaryAssigneeId: null,
      keyMilestoneId: milestoneId || null,
      teamId: currentTeamId,
      scope: isUnassignedColumn ? 'team' : 'assigned',
      // category는 지정하지 않음 — addTask 기본값 사용 (applyTransitionRules 우회 방지)
    })
    // 추가 대응: addTask 내부 `assigneeId: task.assigneeId || userId` falsy 보정이
    // null을 userId로 덮는 버그 → 본 Loop에서 필요 시 useStore.addTask 로직 수정 고려.
    // 최소 수정: `addTask` 호출 전 assigneeId === null 명시 전달 시 `|| userId` 건너뛰도록
    // useStore.js addTask 내부에서 `in` 연산자로 분기.
  }

  if (cellTasks.length === 0) {
    return (
      <td onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          style={{ textAlign: 'center', padding: '4px 8px', minHeight: 30, position: 'relative' }}>
        {addingNew
          ? <input autoFocus onBlur={e => handleAddNew(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') handleAddNew(e.target.value); if (e.key === 'Escape') setAddingNew(false) }} />
          : hover
            ? <button onClick={() => setAddingNew(true)} style={{ fontSize: 13 }}>+</button>
            : <span style={{ color: COLOR.textTertiary }}>·</span>}
      </td>
    )
  }

  return (
    <td style={{ padding: '4px 8px', verticalAlign: 'top' }}>
      {cellTasks.map(task => {
        const isPrimary = task.assigneeId === memberId
        const style = isPrimary
          ? { color: COLOR.textPrimary, fontWeight: 500 }
          : { color: COLOR.textTertiary, fontWeight: 400 }
        const isEditing = editingId === task.id
        return (
          <div key={task.id} style={{ display: 'flex', gap: 4, wordBreak: 'keep-all', overflowWrap: 'break-word', ...style }}>
            <input type="checkbox" checked={task.done} onChange={() => toggleDone(task.id)} />
            {isEditing
              ? <input autoFocus defaultValue={task.text}
                       onBlur={e => handleEditFinish(task.id, e.target.value)}
                       onKeyDown={e => { if (e.key === 'Enter') handleEditFinish(task.id, e.target.value); if (e.key === 'Escape') setEditingId(null) }} />
              : <span onClick={() => setEditingId(task.id)}>{task.text}</span>}
          </div>
        )
      })}
    </td>
  )
}
```

### 4.2 designTokens.js 토큰 추가

```js
// 기존 COLOR, FONT, SPACE, ROW, GANTT 뒤에 추가
export const PILL = {
  amber: { bg: '#FAEEDA', fg: '#854F0B', borderRadius: 10, padding: '1px 8px', fontWeight: 500 },
  coral: { bg: '#FAECE7', fg: '#993C1D', borderRadius: 10, padding: '1px 8px', fontWeight: 500 },
}

export const PIVOT = {
  msSubRowBg: '#FAFAF7',
  emptyCellColor: COLOR.textTertiary,  // TDZ 주의: 같은 파일 내 이미 정의된 COLOR 참조는 OK (위→아래 순서)
  emptyCellMarker: '·',
  emptyCellFontSize: 13,
}
```

**TDZ 검증**: designTokens.js는 모듈 최상위에서 `COLOR` 먼저 정의 → `PIVOT.emptyCellColor`에서 참조. 파일 내 순서 지키면 안전. 단, 컴포넌트에서 `const S = PIVOT` 같은 모듈 레벨 변수 바인딩 금지 — 반드시 컴포넌트 함수 내부에서 import 후 사용.

### 4.3 TeamMatrixGrid.jsx Wrapper 변환

```jsx
// Before (84줄): 3×3 카드 그리드 직접 렌더
// After (~20줄):

import PivotMatrixTable from '../PivotMatrixTable'
import useStore from '../../../../hooks/useStore'

export default function TeamMatrixGrid({ projects, tasks, members, currentTeamId, /* 나머지 props */ }) {
  const milestones = useStore(s => s.milestones)
  return (
    <PivotMatrixTable
      projects={projects}
      members={members}
      tasks={tasks}
      milestones={milestones}
      filter="all"  /* toolbar 필터는 상위에서 내려받아 연결 — 추후 연결 */
    />
  )
}
```

**시그니처 보존**: 외부 props는 전부 받되, `groupByOwner`, `collapsed`, `toggleCollapse`, `toggleDone`, `openDetail`, `activeId`는 PivotMatrixTable 내부가 직접 store에서 구독하므로 무시해도 됨. props 유지 이유는 UnifiedGridView 호출부 호환성.

### 4.4 UnifiedGridView.jsx 수정

```diff
- import MsBacklogSidebar from '../common/MsBacklogSidebar'
  ...
  <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>
    <DndContext ...>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* 4가지 grid 컴포넌트 */}
      </div>
-     {scope === 'team' && view === 'matrix' && (
-       <MsBacklogSidebar projects={projects} milestones={milestones} tasks={tasks} weekDateStrs={...} />
-     )}
    </DndContext>
  </div>
```

레이아웃 결과: 좌측 그리드가 전체 폭 사용. 변경 최소화.

**⚠️ 개인 모드 부작용 (I1)**: UnifiedGridView.jsx:478의 `<MsBacklogSidebar>`는 현재 scope 분기 없이 **항상 렌더**. 따라서 본 제거는 **개인 매트릭스에서도 백로그 사이드바를 없앤다**. R21(개인 매트릭스 별도 phase)과 충돌하지 않으나, 개인 모드 사용자는 일시적으로 백로그 진입점 상실 → BacklogPanel(ProjectView 내)을 유일한 경로로 사용. 사용자 공지 필요. Loop 43 완료 시점에 BacklogPanel도 평탄화되어 UX 전환 완성.

### 4.5 usePivotExpandState hook (신규, localStorage 전용)

**파일**: `src/hooks/usePivotExpandState.js` (신규, ~30줄)

**설계 이유**: C2 (critical) 방지. `useStore.collapseState`는 Supabase `ui_state` (id='default') 단일 row에 동기화되므로 **per-project 상태 누적 시 충돌 위험**. matrixPivot은 사용자 로컬 UI 상태이므로 localStorage로 분리.

```js
// src/hooks/usePivotExpandState.js
import { useState, useCallback } from 'react'

const KEY = 'matrixPivotExpanded'

function readLS() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function writeLS(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)) } catch {}
}

export default function usePivotExpandState() {
  const [pivotCollapsed, setState] = useState(readLS)
  const setPivotCollapsed = useCallback((pid, value) => {
    setState(prev => {
      const next = { ...prev, [pid]: value }
      writeLS(next)
      return next
    })
  }, [])
  return { pivotCollapsed, setPivotCollapsed }
}
```

**useStore.js는 건드리지 않음** (C2 회피). `_defaultCollapseState`에 matrixPivot 키 추가도 불필요.

### 4.6 DnD 이벤트 체계 변경

기존 UnifiedGridView의 DnD는 `bl-ms:`, `bl-task:`, `cell-ms:`, `cell-task:`, `mat:${projId}:${category}` 등의 ID 체계를 사용. 본 Loop에서:
- **`bl-ms:`, `bl-task:`**: MsBacklogSidebar 삭제로 **소스 소멸** — 관련 drop handler 정리
- **`cell-task:`, `cell-ms:`**: 새 PivotTaskCell/PivotMsSubRow에서 동일 ID 체계 사용 가능하나 **본 Loop 범위 밖** (task DnD는 후속 loop)
- **`mat:${projId}:${category}`**: 3×3 카드 기반 ID. 피벗 구조에선 사용 없음 → handler 제거

**본 Loop 범위**: DnD는 **전부 비활성화** (PivotTaskCell은 DnD 미구현). UnifiedGridView의 handler에서 bl-* / mat:* case branch 제거. 후속 loop에서 피벗 셀 간 DnD 재구현.

### 4.6 DELETE-5 검증 테이블

| 대상 | Import 제거 | JSX 제거 | Prop 체인 | 파일 삭제 | 검증 grep |
|------|------------|---------|----------|----------|----------|
| MsBacklogSidebar | UnifiedGridView.jsx:8 | UnifiedGridView.jsx:478 | UnifiedGridView 내부에서 사용된 props만 (외부 drill 없음) | ✓ | `grep -rn 'MsBacklogSidebar' src/` = 0건 |

---

## 5. 작업 순서

1. **designTokens.js 토큰 추가** — PILL, PIVOT 객체. 빌드 통과 확인 (TDZ 없음)
2. **PivotTaskCell.jsx 작성** (의존성 최하단) → unit 단위 스냅샷 빌드
3. **PivotUngroupedSubRow, PivotMsSubRow 작성**
4. **PivotProjectRow 작성**
5. **PivotMatrixTable 작성** (위 4개 조합)
6. **TeamMatrixGrid Wrapper 변환** — PivotMatrixTable 위임
7. **UnifiedGridView 수정** — MsBacklogSidebar import/렌더 제거
8. **MsBacklogSidebar 파일 삭제**
9. **빌드 & 런타임 확인** — 팀 매트릭스 뷰가 피벗 테이블로 렌더되는지
10. **DELETE-5 grep 검증**

---

## 6. 검증 절차

### 6.1 빌드
- `npm run build` — TDZ 에러 없이 성공

### 6.2 런타임 검증 (팀 매트릭스 뷰)

| 시나리오 | 기대 결과 |
|---------|----------|
| 프로젝트 20개, 멤버 5명 환경 진입 | 피벗 테이블 렌더. 가로 스크롤 작동, sticky 헤더/첫 컬럼 작동 |
| 모든 프로젝트 기본 상태 | 직속 task 있는 프로젝트만 자동 펼침, 나머지 접힘 (R27) |
| 접힌 프로젝트 카운트 | Primary 기준만 집계. 5건+ amber pill, 10건+ coral pill |
| 프로젝트 펼침 | MS sub-row + 직속 task sub-row (라벨 없음) 표시 |
| Primary + Secondary task | primary 멤버 셀 진하게, secondary 멤버 셀 연하게 동시 등장 (R30) |
| 셀 내 task 클릭 | inline 편집 input 활성. blur/Enter로 저장, Escape로 취소 |
| 체크박스 클릭 | done 토글 즉시 반영 |
| 빈 셀 hover | + 버튼 노출. 클릭 시 input → 입력 후 blur/Enter → 자동 필드로 task 생성 |
| 멤버 컬럼 헤더 클릭 | Members View 이동 |
| 새로고침 | 펼침 상태 유지 (collapseState.matrixPivot 영속) |
| 명시적 접힌 프로젝트 (직속 task 있음) | 여전히 접힘 유지 (명시적 > 자동) |
| 필터 전환 `미배정` | 셀 내 task 중 `assigneeId=null AND secondaryAssigneeId=null AND scope='team'`만 표시. 컬럼/행은 그대로 |

### 6.3 DELETE-5 검증
- `grep -rn 'MsBacklogSidebar' src/` = 0건

### 6.4 회귀 검증
- 개인 매트릭스 뷰 정상 (PersonalMatrixGrid 유지) — 기능 회귀 없음
- 주간 플래너 정상 (Personal/Team Weekly) — DndContext 내부 구조 변경에도 동작
- ProjectView 정상 (Loop 43 전이므로 "백로그" 여전히 노출)

---

## 7. Rollback 계획

- `git revert` — 신규 컴포넌트 5개 + 수정 4개 파일 되돌림
- MsBacklogSidebar.jsx 파일 git에서 복원
- DB 변경 없음 → 추가 조치 불필요

---

## 8. REQ-LOCK 커버리지 (Loop 42 spec §2 검증)

| ID | 요구사항 | diff 반영 위치 |
|----|---------|---------------|
| L42-R01 | rows=프로젝트, cols=팀원 | §4.1.1 PivotMatrixTable |
| L42-R02 | 컬럼 폭 (170/115/55) | §4.1.1 colgroup |
| L42-R03 | 팀 전체 멤버 항상 표시 | §4.1.1 members prop 그대로 |
| L42-R04 | 접힌 행: 카운트 1줄 | §4.1.2 PivotProjectRow |
| L42-R05 | 펼친 행: MS sub-row + 직속 sub-row | §4.1.1 tbody 구조 |
| L42-R06 | 셀 내 task: 체크박스 + 이름 | §4.1.4 |
| L42-R07 | Primary: text-primary, weight 500 | §4.1.4 style 분기 |
| L42-R08 | Secondary: text-tertiary, weight 400 | §4.1.4 style 분기 |
| L42-R09 (R30) | 양쪽 셀 중복 표시 | §4.1.4 cellTasks filter 둘 다 |
| L42-R10 | Primary만 카운트 | §4.1.2 countByMember |
| L42-R11 | 빈 셀 `·` | §4.1.4 empty branch |
| L42-R12 | 5+ amber, 10+ coral | §4.1.2 renderCountCell |
| L42-R13 | designTokens 토큰 추가 | §4.2 PILL, PIVOT |
| L42-R14 | sticky 첫 컬럼/헤더 | §4.1.1 position:sticky |
| L42-R15 | overflow-x: auto | §4.1.1 outer div |
| L42-R16 | keep-all 한국어 wrap | §4.1.4 div style |
| L42-R17 | 필터 (all/unassigned/assigned) | §4.1.1 filteredTasks memo |
| L42-R18 | DepthToggle 없음 | Loop 41에서 제거 완료 |
| L42-R19 | collapseState.matrixPivot | §4.5 |
| L42-R20 (R27) | 자동 펼침 + 명시 우선 | §4.1.1 isExpanded |
| L42-R21 | inline 편집 | §4.1.4 editingId |
| L42-R22 | 체크박스 done 토글 | §4.1.4 toggleDone |
| L42-R23 | 빈 셀 hover + 버튼, 자동 필드 | §4.1.4 handleAddNew |
| L42-R24 | 멤버 헤더 클릭 → Members View | §4.1.1 navigateToMembersView (라우팅 구현 필요) |
| L42-R25 | 합계 셀 클릭 → drawer | `PivotProjectRow`의 합계 `<td>`에 `onClick={() => openProjectTasksDrawer(project.id)}`. **drawer 신규 구현 회피** — 기존 `ProjectView`로 `setView('project')` + `setSelectedProjectId(project.id)` 라우팅 재사용. 전용 drawer는 후속 Loop. spec R25 최소 이행으로 정의 |
| L42-R26 | 직속 sub-row 라벨 없음 | §4.1.3 PivotUngroupedSubRow 빈 td |
| L42-R27 | MsBacklogSidebar 삭제 | §1.2, §4.4, §4.6 |
| L42-R28 | backlogFilter.js 삭제 | **Loop 43으로 이관** (BacklogPanel 의존) |
| L42-R29 | TeamMatrixGrid Wrapper | §4.3 |
| L42-R30 | UnifiedGridView 분기 제거 | §4.4 |

---

## 9. 알려진 리스크

| # | 리스크 | 완화 |
|---|------|------|
| R1 | Members View 라우트 (R24) 미존재 시 클릭이 no-op | 기존 `팀원` 메뉴 라우트 재사용. 라우트 명칭 확인 후 `navigate('/team/members?userId=X')` 형태로 연결 |
| R2 | 합계 셀 drawer (R25) 구현이 기존 openDetail과 다름 | drawer 컴포넌트 신규 구현 vs 기존 재사용 — diff 실행 시 결정. 최소 버전은 기존 ProjectView로 이동 |
| R3 | PivotTaskCell의 inline 편집과 hover + 버튼이 동시 트리거 | hover는 빈 셀 조건에서만. task 존재 시 hover 이벤트 없음 — 구현 시 엣지 검증 |
| R4 | `useStore.setCollapseValue` 시그니처 확인 필요 | Loop 41에서 건드리지 않는 기존 함수. 시그니처 불일치 시 구현 시 조정 |
| R5 | Secondary task가 Primary 셀엔 안 뜨는 케이스 (같은 사람이 primary도 secondary도 아닌 다른 사람) | filter 로직이 `assigneeId===memberId \|\| secondaryAssigneeId===memberId`로 명확. 문제 없음 |
| R6 | 가로 스크롤 시 sticky 첫 컬럼이 배경 투명해 뒤 내용 비침 | `background: '#fff'` 명시 (§4.1.1). MS sub-row는 `msSubRowBg` 명시 |
| R7 | backlogFilter.js 삭제가 Loop 43으로 이관됨 → spec L42-R28 부분 이행 | spec 수정 또는 Loop 43 spec에 추가 명시 필요 |
