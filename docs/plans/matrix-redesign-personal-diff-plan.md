# Loop 44 — 개인 매트릭스 시간 피벗 Diff Plan

> **Phase**: Personal Matrix Redesign
> **Date**: 2026-04-15
> **Spec**: [matrix-redesign-personal-spec.md](./matrix-redesign-personal-spec.md) (R03/R04/§4.3 수정 반영)
> **Recon**: [matrix-redesign-personal-recon.md](./matrix-redesign-personal-recon.md)
> **Depends on**: Loop 41 (MS L1 flat), Loop 42 (PivotMatrixTable 구조 참조)
> **Independent of**: Loop 43

---

## 0. 선제 확정사항

recon 결과 spec 3건이 이미 교정됨:
- **R03**: 시간 컬럼 = `today` / `next` / `backlog` (실제 enum)
- **R04**: NULL fallback 무의미 — `mapTask`가 강제 변환
- **§4.3**: `usePivotExpandState(scope='personal')` 사용

**구현 옵션 결정**: Option A (신규 5 컴포넌트) 채택. Option C(PivotTaskCell filterFn prop)는 `memberId` 시맨틱과 섞이는 게 가독성 저하 — 개인용 전용 컴포넌트 분리가 명료.

---

## 1. 변경할 파일 목록

### 1.1 신규 파일 (5개)

| 파일 | 역할 | 예상 줄수 |
|------|------|---------|
| `src/components/views/grid/PersonalPivotMatrixTable.jsx` | 메인. sticky, localStorage 펼침, 시간 컬럼 3개 | ~180 |
| `src/components/views/grid/cells/PersonalPivotProjectRow.jsx` | 프로젝트 행. 시간 컬럼별 카운트, pill 재사용 | ~95 |
| `src/components/views/grid/cells/PersonalPivotMsSubRow.jsx` | MS sub-row | ~60 |
| `src/components/views/grid/cells/PersonalPivotTimeCell.jsx` | 한 셀(MS × time) task 리스트 + inline 편집 + 빈 셀 +버튼 | ~130 |
| `src/components/views/grid/cells/PersonalPivotUngroupedSubRow.jsx` | keyMilestoneId=null sub-row (라벨 없음) | ~55 |

### 1.2 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| [src/components/views/grid/grids/PersonalMatrixGrid.jsx](../../src/components/views/grid/grids/PersonalMatrixGrid.jsx) (123줄) | **Wrapper 전환**: 내부 전체 교체 → PersonalPivotMatrixTable에 위임. todayFilter state/JSX/localStorage 전부 제거. SortableContext 제거 (피벗 테이블 내부엔 DnD 없음). 외부 props 시그니처 유지 |
| [src/hooks/usePivotExpandState.js](../../src/hooks/usePivotExpandState.js) (~30줄) | `scope = 'team'` 파라미터 추가. localStorage 키 `'matrixPivotExpanded'`(team) / `'personalMatrixPivotExpanded'`(personal) 분기 |
| [src/components/views/grid/PivotMatrixTable.jsx](../../src/components/views/grid/PivotMatrixTable.jsx):17 | `usePivotExpandState()` → `usePivotExpandState('team')` (명시 전달) |
| [src/utils/colors.js](../../src/utils/colors.js):21 | `CATEGORIES[0].label: '오늘 할일'` → `'지금 할일'`. `shortLabel: '오늘'` → `'지금'` |
| [src/components/layout/MobileTopBar.jsx](../../src/components/layout/MobileTopBar.jsx):8 | `today: '오늘 할일'` → `'지금 할일'` |
| [src/components/modals/MilestoneDetailModal.jsx](../../src/components/modals/MilestoneDetailModal.jsx):15 | `today: { ..., label: '오늘' }` → `label: '지금'` |
| [src/components/shared/HelpPage.jsx](../../src/components/shared/HelpPage.jsx) 여러 곳 | "오늘 할일" → "지금 할일" 사용자 노출 문자열 일괄 변경 (본문/tip/표) |
| [src/utils/timelineUtils.js](../../src/utils/timelineUtils.js):434 | `catLabel` 객체 `today: '오늘 할일'` → `'지금 할일'` (W2) |
| [src/hooks/useMatrixConfig.js](../../src/hooks/useMatrixConfig.js):39 | category label `'오늘 할일'` → `'지금 할일'` (W3) |

### 1.3 변경 없음

- `useStore.js` — collapseState에 신규 키 추가 불필요 (§4.3 수정 반영)
- DB schema — 마이그레이션 없음
- `UnifiedGridView.jsx` — PersonalMatrixGrid가 내부에서 위임하므로 변경 불필요 (spec R24)
- 팀 매트릭스 (PivotMatrixTable + cells) — scope 파라미터 전달만 (behavior 불변)
- `grid/constants.js`의 `CATS` `'later'` — dead code 가능성 있으나 본 Loop 범위 밖
- DB category enum `'today'`, 코드 변수명 `today` 등 — 라벨만 변경

---

## 2. DB 마이그레이션

**없음.** category enum 값 유지(`'today'`/`'next'`/`'backlog'`). 사용자 라벨만 "지금 할일/다음 할일/남은 할일"로 노출.

---

## 3. API 변경

**없음.** 기존 store 메서드 사용 (`addTask`, `updateTask`, `toggleDone`).

`addTask` 호출 시 개인 프로젝트에선 [useStore.js:536](../../src/hooks/useStore.js#L536) `if (isPersonalProject) { t.scope = 'private'; t.teamId = null; t.assigneeId = userId }` 강제 보정이 최종 실행. Loop 44의 `assigneeId: currentUserId` 명시 전달과 일치하므로 결과 동일. **W1 정정**: C3 fix가 아니라 이 강제 보정 라인이 최종 보장자.

팀 프로젝트 생성 시는 C3 fix 경로 적용. `scope`는 `addTask` 내부 `teamDefaults`에서 `task.scope || 'assigned'` 사용. Loop 44에선 `scope`를 명시하지 않아도 팀 프로젝트면 'assigned', 개인 프로젝트면 'private'로 강제되어 문제 없음.

---

## 4. 프론트엔드 변경 상세

### 4.1 usePivotExpandState hook 확장

**⚠️ 구현 주의 (I2)**: 현 파일 [usePivotExpandState.js:7](../../src/hooks/usePivotExpandState.js#L7)은 모듈-레벨 `const KEY = 'matrixPivotExpanded'`를 `readLS()/writeLS()`가 클로저 참조한다. scope 도입 시 이 구조를 **함수 내부 변수**로 이동해야 동작. 모듈-레벨 상수 삭제 필수.

```js
// src/hooks/usePivotExpandState.js (전체 교체)
import { useState, useCallback } from 'react'

const KEYS = {
  team: 'matrixPivotExpanded',
  personal: 'personalMatrixPivotExpanded',
}

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') }
  catch { return {} }
}

function writeLS(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)) } catch {}
}

export default function usePivotExpandState(scope = 'team') {
  const KEY = KEYS[scope] || KEYS.team
  const [pivotCollapsed, setState] = useState(() => readLS(KEY))
  const setPivotCollapsed = useCallback((pid, value) => {
    setState(prev => {
      const next = { ...prev, [pid]: value }
      writeLS(KEY, next)
      return next
    })
  }, [KEY])
  return { pivotCollapsed, setPivotCollapsed }
}
```

**호환성**: 기존 호출자(PivotMatrixTable)는 `usePivotExpandState()` → default 'team' → 기존 키 `'matrixPivotExpanded'` 유지. 기 저장 상태 손실 없음. 명시 전달하도록 업데이트(§1.2).

### 4.2 PersonalPivotMatrixTable

```js
// src/components/views/grid/PersonalPivotMatrixTable.jsx
import React, { useMemo, useCallback } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import usePivotExpandState from '../../../hooks/usePivotExpandState'
import { COLOR, PIVOT } from '../../../styles/designTokens'
import PersonalPivotProjectRow from './cells/PersonalPivotProjectRow'
import PersonalPivotMsSubRow from './cells/PersonalPivotMsSubRow'
import PersonalPivotUngroupedSubRow from './cells/PersonalPivotUngroupedSubRow'

export const TIME_COLUMNS = [
  { key: 'today',   label: '지금 할일' },
  { key: 'next',    label: '다음 할일' },
  { key: 'backlog', label: '남은 할일' },
]

export default function PersonalPivotMatrixTable({ projects, tasks, milestones }) {
  const { pivotCollapsed, setPivotCollapsed } = usePivotExpandState('personal')
  const currentUserId = getCachedUserId()

  // tasks는 이미 UnifiedGridView에서 `myTasks`로 사전 필터됨 (assigneeId 기준).
  // 여기선 미완료/미삭제 추가 필터만 적용.
  // (assigneeId 재필터는 idempotent — 이중 적용해도 결과 동일이라 안전)
  const myTasks = useMemo(() =>
    tasks.filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt),
    [tasks, currentUserId]
  )

  // useCallback으로 감싸 PersonalPivotProjectRow의 onToggle이 매 렌더마다
  // 새 참조를 받지 않도록 (W4 반영)
  const isExpanded = useCallback((pid) => {
    const explicit = pivotCollapsed[pid]
    if (explicit === true) return true
    if (explicit === false) return false
    return myTasks.some(t => t.projectId === pid && t.keyMilestoneId == null)
  }, [pivotCollapsed, myTasks])

  const toggleProject = useCallback((pid) => {
    setPivotCollapsed(pid, !isExpanded(pid))
  }, [isExpanded, setPivotCollapsed])

  const minWidth = PIVOT.colWidthProject + TIME_COLUMNS.length * PIVOT.colWidthMember + PIVOT.colWidthTotal

  return (
    <div style={{ width: '100%', overflowX: 'auto', overflowY: 'auto', maxHeight: '100%' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: PIVOT.colWidthProject }} />
          {TIME_COLUMNS.map(c => <col key={c.key} style={{ width: PIVOT.colWidthMember }} />)}
          <col style={{ width: PIVOT.colWidthTotal }} />
        </colgroup>
        <thead>
          <tr>
            <th /* sticky left+top, z:4 */>프로젝트 · 마일스톤</th>
            {TIME_COLUMNS.map(c => (
              <th key={c.key} /* sticky top, z:3 */>{c.label}</th>
            ))}
            <th /* sticky top, z:3 */>합계</th>
          </tr>
        </thead>
        <tbody>
          {projects.map(p => {
            const projTasks = myTasks.filter(t => t.projectId === p.id)
            const projMilestones = milestones.filter(m =>
              (m.project_id || m.projectId) === p.id
            )
            const ungrouped = projTasks.filter(t => t.keyMilestoneId == null)
            const expanded = isExpanded(p.id)
            return (
              <React.Fragment key={p.id}>
                <PersonalPivotProjectRow
                  project={p}
                  tasks={projTasks}
                  isExpanded={expanded}
                  onToggle={() => toggleProject(p.id)}
                />
                {expanded && projMilestones.map(ms => (
                  <PersonalPivotMsSubRow
                    key={`ms-${ms.id}`}
                    milestone={ms}
                    tasks={projTasks.filter(t => t.keyMilestoneId === ms.id)}
                    currentUserId={currentUserId}
                  />
                ))}
                {expanded && ungrouped.length > 0 && (
                  <PersonalPivotUngroupedSubRow
                    key={`ungr-${p.id}`}
                    project={p}
                    tasks={ungrouped}
                    currentUserId={currentUserId}
                  />
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

### 4.3 PersonalPivotProjectRow

```js
// cells/PersonalPivotProjectRow.jsx
import { TIME_COLUMNS } from '../PersonalPivotMatrixTable'  // 또는 별도 파일
import { COLOR, PILL, PIVOT } from '../../../../styles/designTokens'

export default function PersonalPivotProjectRow({ project, tasks, isExpanded, onToggle }) {
  const countByCol = TIME_COLUMNS.reduce((acc, col) => {
    acc[col.key] = tasks.filter(t => t.category === col.key).length
    return acc
  }, {})
  const total = tasks.length

  return (
    <tr onClick={onToggle} /* 동일 스타일 */>
      <td /* sticky left */>
        {isExpanded ? '▼' : '▶'} {project.name} <span>{total}건</span>
      </td>
      {TIME_COLUMNS.map(col => (
        <td key={col.key}><CountCell n={countByCol[col.key]} /></td>
      ))}
      <td>{total}</td>
    </tr>
  )
}

// CountCell: Loop 42의 PivotProjectRow 내부 CountCell과 동일 (amber/coral pill)
```

**중복 고려**: `CountCell` 헬퍼는 Loop 42 PivotProjectRow와 동일. 공통 추출 가능하나 본 Loop 범위 밖 — **후속 refactor**로 넘김. 인라인 복제(5+줄) 또는 shared 모듈 분리는 diff 실행 시 결정 (복제가 간단).

### 4.4 PersonalPivotMsSubRow + PersonalPivotUngroupedSubRow

Loop 42의 Pivot*SubRow와 구조 동일. 차이:
- `members` prop 대신 `TIME_COLUMNS` 순회
- `PivotTaskCell` 대신 `PersonalPivotTimeCell`
- `project.id`가 ungrouped에선 필요 (milestoneId = null 전달)

### 4.5 PersonalPivotTimeCell

```js
// cells/PersonalPivotTimeCell.jsx
import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, PIVOT, SPACE } from '../../../../styles/designTokens'

export default function PersonalPivotTimeCell({ tasks, timeCol, projectId, milestoneId, currentUserId }) {
  const updateTask = useStore(s => s.updateTask)
  const addTask = useStore(s => s.addTask)
  const toggleDone = useStore(s => s.toggleDone)

  const [editingId, setEditingId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const [hover, setHover] = useState(false)

  const cellTasks = tasks.filter(t => t.category === timeCol.key)

  const handleEditFinish = (id, v) => {
    setEditingId(null)
    const text = (v ?? '').trim()
    if (text) updateTask(id, { text })
  }

  const handleAddNew = (v) => {
    setAddingNew(false)
    const text = (v ?? '').trim()
    if (!text) return
    addTask({
      text,
      projectId,
      assigneeId: currentUserId,
      secondaryAssigneeId: null,
      keyMilestoneId: milestoneId || null,
      category: timeCol.key,  // 'today' | 'next' | 'backlog'
      // teamId은 addTask 내부에서 프로젝트 소속으로 자동 결정.
      // 개인 프로젝트면 useStore.js:536 강제 보정(scope='private', teamId=null, assigneeId=userId)로 덮임.
      // 팀 프로젝트면 teamDefaults의 scope='assigned', assigneeId=userId 유지.
    })
  }

  if (cellTasks.length === 0) {
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
           style={{ textAlign: 'center', padding: SPACE.cellPadding, minHeight: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {addingNew
          ? <input autoFocus onBlur={e => handleAddNew(e.target.value)}
                   onKeyDown={e => {
                     if (e.key === 'Enter') handleAddNew(e.target.value)
                     if (e.key === 'Escape') setAddingNew(false)
                   }} />
          : hover
            ? <button onClick={() => setAddingNew(true)}>+</button>
            : <span style={{ color: PIVOT.emptyCellColor, fontSize: PIVOT.emptyCellFontSize }}>{PIVOT.emptyCellMarker}</span>}
      </div>
    )
  }

  return (
    <div style={{ padding: SPACE.cellPadding }}>
      {cellTasks.map(task => {
        const isEditing = editingId === task.id
        return (
          <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: COLOR.textPrimary, fontWeight: 500 }}>
            <input type="checkbox" checked={!!task.done} onChange={() => toggleDone(task.id)} />
            {isEditing
              ? <input autoFocus defaultValue={task.text}
                       onBlur={e => handleEditFinish(task.id, e.target.value)}
                       onKeyDown={e => {
                         if (e.key === 'Enter') handleEditFinish(task.id, e.target.value)
                         if (e.key === 'Escape') setEditingId(null)
                       }} />
              : <span onClick={() => setEditingId(task.id)} style={{ cursor: 'pointer', flex: 1 }}>{task.text}</span>}
          </div>
        )
      })}
    </div>
  )
}
```

**Primary/Secondary 구분 없음**: 개인 뷰에선 본인 task만 보이므로 전부 같은 weight(500) + textPrimary.

### 4.6 PersonalMatrixGrid Wrapper 변환

```jsx
// src/components/views/grid/grids/PersonalMatrixGrid.jsx (변경 후, ~20줄)
import useStore from '../../../../hooks/useStore'
import PersonalPivotMatrixTable from '../PersonalPivotMatrixTable'

export default function PersonalMatrixGrid({ projects, myTasks }) {
  const milestones = useStore(s => s.milestones)
  return (
    <PersonalPivotMatrixTable
      projects={projects}
      tasks={myTasks}
      milestones={milestones}
    />
  )
}
```

**외부 시그니처 유지**: UnifiedGridView의 호출부는 변경 없음. 사용하지 않는 props(`collapsed`, `toggleCollapse`, `toggleDone`, `openDetail`, `activeId`, `matrixMsCollapsed`, `toggleMatrixMsCollapse`, `handleMsDelete`, `matrixDoneCollapsed`, `toggleMatrixDoneCollapse`)는 **무시**. PersonalPivotMatrixTable이 필요한 store 메서드를 직접 구독.

**삭제 대상**: todayFilter state(37-47), toggleTodayFilter(41-47), getFilteredTasks(50-54), allFilteredCount(56-59), 필터 토글 버튼 JSX(63-73), 빈 상태 블록(75-84), SortableContext + SortableLaneCard(9-21, 87-114). **localStorage `'personalTodayFilter'` 키는 그대로 둠** (사용자 브라우저에 잔존 — 해롭지 않음, 이후 자연 소멸).

### 4.7 "오늘" → "지금 할일" 라벨 일괄 변경 (R25)

| 파일:줄 | Before | After |
|---------|--------|-------|
| `colors.js:21` | `label: '오늘 할일', shortLabel: '오늘'` | `label: '지금 할일', shortLabel: '지금'` |
| `MobileTopBar.jsx:8` | `today: '오늘 할일'` | `today: '지금 할일'` |
| `MilestoneDetailModal.jsx:15` | `label: '오늘'` | `label: '지금'` |
| `HelpPage.jsx:82` | `"나에게 배정된 할일. 오늘 할일 / 다음 할일로 구분"` | `"... 지금 할일 / 다음 할일로 구분"` |
| `HelpPage.jsx:89` | `"오늘할일"` | `"지금 할일"` |
| `HelpPage.jsx:96` | `"내 오늘/다음"` | `"내 지금/다음"` |
| `HelpPage.jsx:102` | `'"오늘 할일"로 올릴지'` | `'"지금 할일"로 올릴지'` |
| `HelpPage.jsx:116` | `"오늘/다음"` | `"지금/다음"` |
| `HelpPage.jsx:124` | `"오늘 할일 / 다음 할일"` | `"지금 할일 / 다음 할일"` |

**변경 제외**:
- DB enum `'today'`
- 코드 변수명 `today`, `todayStr`, `todayLine`, `isToday`
- 색상 토큰 `todayLine` (COLOR.todayLine)
- CSS 클래스/ID 중 `today` 포함된 것

**검증 grep**:
```bash
grep -rn '오늘' src/ --include='*.jsx' --include='*.js'
# 결과가 코드 변수/주석/DB enum만 남아야 함
```

### 4.8 DELETE-5 검증 테이블 (diff 실행 시 포함)

| 대상 | 범위 | 검증 grep |
|------|------|---------|
| `personalTodayFilter` localStorage 참조 | PersonalMatrixGrid | `grep -rn 'personalTodayFilter' src/` = 0건 |
| `todayFilter` state/함수 | PersonalMatrixGrid | `grep -rn 'todayFilter\|toggleTodayFilter' src/components/views/grid/grids/` = 0건 |
| `SortableLaneCard` (PersonalMatrixGrid 내부) | 로컬 함수 | 파일 내 grep = 0건 |
| 사용자 노출 "오늘" | src/ | 위 §4.7 grep 기준 변수/주석만 남음 |

---

## 5. 작업 순서

1. **usePivotExpandState hook 확장** — scope 파라미터 추가. 기존 호출자 호환 유지
2. **PivotMatrixTable.jsx** — `usePivotExpandState('team')` 명시 (behavior 불변)
3. **PersonalPivotTimeCell** 신규 생성
4. **PersonalPivotMsSubRow + PersonalPivotUngroupedSubRow** 신규 생성
5. **PersonalPivotProjectRow** 신규 생성 (CountCell 인라인 또는 Loop 42 것 복제)
6. **PersonalPivotMatrixTable** 조립 (TIME_COLUMNS export)
7. **PersonalMatrixGrid Wrapper 전환**
8. **라벨 변경 6개 파일** — colors.js, MobileTopBar, MilestoneDetailModal, HelpPage
9. **빌드 확인** (`npm run build`)
10. **DELETE-5 grep 검증**
11. **commit**

---

## 6. 검증 절차

### 6.1 빌드
- `npm run build` 성공 (TDZ 없음)

### 6.2 런타임 (개인 매트릭스)

| 시나리오 | 기대 |
|---------|------|
| 개인 매트릭스 진입 | 피벗 테이블 렌더. 3 시간 컬럼(지금/다음/남은). today 필터 토글 사라짐 |
| 프로젝트 20개 · 자기 task 다양 | 팀 + 개인 프로젝트 전체 행 표시 (task 0건이어도) |
| 프로젝트 기본 상태 | `keyMilestoneId=null` 직속 task 있는 프로젝트 자동 펼침 |
| 접힌 행 | 시간 컬럼별 카운트. 5+ amber, 10+ coral pill |
| 펼친 행 | MS sub-row + 직속 task sub-row(라벨 없음) |
| 셀 내 task | 전부 weight 500, textPrimary. 체크박스 + 제목 |
| 셀 내 task 클릭 | inline 편집 (Enter 저장, Escape 취소, blur 저장) |
| 체크박스 클릭 | done 토글 즉시 반영 (`!t.done` 필터로 셀에서 사라짐) |
| 빈 셀 hover | + 버튼. 클릭 → input → 생성 시 `category: timeCol.key`, `assigneeId: 본인`, `keyMilestoneId: sub-row MS 또는 null` |
| 새로고침 | 펼침 상태 복원 (`localStorage['personalMatrixPivotExpanded']`) |
| 팀 매트릭스 (회귀) | 기존 동작 유지. `localStorage['matrixPivotExpanded']` 키 보존 |
| 모바일 TopBar | "지금 할일" 라벨 노출 |
| MilestoneDetailModal | 카테고리 칩 "지금" 노출 |
| HelpPage | "지금 할일" 문구 |

### 6.3 DELETE-5 검증
§4.8 표의 grep 명령 전부 0건

### 6.4 회귀
- 팀 매트릭스 (Loop 42) 정상 — 펼침 상태 localStorage 분리 덕에 영향 없음
- 주간 플래너 (Personal/Team Weekly) 변경 없음
- ProjectView (Loop 43) 변경 없음
- Timeline — 변경 없음

---

## 7. Rollback

- `git revert` — 신규 5 + 수정 6 파일 모두 되돌림
- localStorage `'personalMatrixPivotExpanded'` 키는 잔존하나 무해
- `'personalTodayFilter'` 키 복원되지 않아도 기본값(ON)으로 복구 (localStorage 없을 때 기본값 true) — 기존 사용자 경험과 동일

---

## 8. REQ-LOCK 커버리지 (spec §2)

| ID | 구현 위치 |
|----|---------|
| L44-R01 | §4.2 PersonalPivotMatrixTable |
| L44-R02 | §4.2 colgroup (today/next/backlog) |
| L44-R03 | §4.2 TIME_COLUMNS |
| L44-R04 | **N/A** — mapTask가 NULL을 backlog로 변환 (spec 교정 반영) |
| L44-R05 | §4.2 `projects` prop 그대로 사용 |
| L44-R06 | §4.2 기존 정렬 그대로 (getOrderedProjects) |
| L44-R07 | §4.3 PersonalPivotProjectRow countByCol |
| L44-R08 | §4.2 tbody 구조 |
| L44-R09 | §4.5 PersonalPivotTimeCell |
| L44-R10 | §4.5 `assigneeId === currentUserId` 필터 |
| L44-R11 | §4.5 hover + empty 분기 |
| L44-R12 | §4.5 handleAddNew — assigneeId 본인, category timeCol.key 자동 |
| L44-R13 | §4.3 CountCell — Loop 42 PILL 토큰 재사용 |
| L44-R14 | §4.2 sticky position |
| L44-R15 | 기본 스타일 (Loop 42 tokens와 동일) |
| L44-R16 | §4.6 todayFilter 전체 제거 |
| L44-R17 | §4.1 `usePivotExpandState('personal')` |
| L44-R18 | §4.2 isExpanded 자동 판정 |
| L44-R19 | §4.5 editingId |
| L44-R20 | §4.5 toggleDone |
| L44-R21 | DnD 없음 확인 (기존 동작 유지) |
| L44-R22 | §4.4 PersonalPivotUngroupedSubRow (라벨 없음) |
| L44-R23 | §4.6 PersonalMatrixGrid Wrapper |
| L44-R24 | UnifiedGridView 변경 없음 |
| L44-R25 | §4.7 라벨 변경 6 파일 |

---

## 9. 알려진 리스크

| # | 리스크 | 완화 |
|---|------|------|
| R1 | `useMemo([tasks, currentUserId])`에서 currentUserId가 `getCachedUserId()` 동기 캐시 — 부팅 초기 null 가능 | loadAll 완료 후 보장. 초기 null일 때 `myTasks=[]` → 빈 상태 표시 (해롭지 않음). `useStore`에서 userId 셀렉터 추가 가능하나 본 Loop 범위 밖 |
| R2 | `usePivotExpandState` default 'team' 유지로 Loop 42 호출자 behavior 불변. 단 명시 전달로 변경하면 가독성 상승 | §1.2 `usePivotExpandState('team')` 명시 권장 |
| R3 | HelpPage 라벨 변경이 모호 — "오늘/다음" 같은 짧은 조합은 문맥 없이 변경하면 어색 | 각 줄 확인하며 판단 — "지금/다음" 자연스러움 확인 |
| R4 | PersonalPivotProjectRow의 CountCell 중복 코드 (Loop 42와 5+줄) | 본 Loop에선 복제. 후속 refactor로 `shared/CountPill.jsx` 추출 |
| R5 | UnifiedGridView에서 PersonalMatrixGrid에 넘기는 unused props | 시그니처만 유지, 내부 무시. 경고 없음 (React가 extra prop 허용) |
| R6 | SortableContext 제거로 팀 프로젝트 재정렬(`project-lane` drag)이 개인 매트릭스에서 불가 | 개인 매트릭스에선 원래 재정렬 의미 약함. 후속 loop에서 사이드바 재정렬 경로 보강 검토 |
| R7 | mapTask 기본값 `'backlog'`에 의존 — 미래에 제거되면 R04 전제 깨짐 | 본 Loop에선 현 상태에 의존. 제거 시 UI fallback 추가 필요 |

---

**Diff Plan 작성 완료. 다음 단계: `/execute matrix-redesign-personal`로 실행하세요.**
