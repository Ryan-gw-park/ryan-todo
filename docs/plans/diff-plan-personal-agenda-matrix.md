# Diff Plan — 개인 할일 매트릭스 뷰 (프로젝트 × 아젠다)

> 입력: [`spec-personal-agenda-matrix.md`](./spec-personal-agenda-matrix.md) r2 + [`spec-personal-agenda-matrix-validation.md`](./spec-personal-agenda-matrix-validation.md)
> 작성: 2026-05-18
> 산출: 11개 커밋 (C1, C2, C3a, C3b, C4a, C4b, C5, C6, C7, C8, C8.5, C9, C10) 의 구체적 diff 명세
> 후속: DELETE-5 PR (별도, 본 plan 범위 외)

---

## 0. 변경 요약 (Bird's-eye)

### 신규 파일 (10개)
| 경로 | 책임 | 커밋 |
|---|---|---|
| `supabase/migrations/20260518000000_personal_agenda_matrix_tasks_agendas.sql` | DB 마이그레이션 | C1 |
| `src/components/views/grid/PersonalAgendaMatrixTable.jsx` | 매트릭스 본체 | C4a |
| `src/components/views/grid/cells/AgendaColHeader.jsx` | 컬럼 헤더 | C4a |
| `src/components/views/grid/cells/AgendaRowHeader.jsx` | 행 헤더 (milestone) | C4a |
| `src/components/views/grid/cells/AgendaMatrixCell.jsx` | 셀 (task 리스트 + drop) | C4b |
| `src/components/views/grid/cells/AgendaMatrixTaskCard.jsx` | task 카드 wrapper | C4b, C7, C8.5 |
| `src/components/views/grid/cells/AgendaInboxRow.jsx` | inbox 행 | C5 |
| `src/utils/dnd/cellKeys/personalAgenda.js` | cellKey 유틸 + getCellTasks | C4b |
| `src/components/views/grid/dnd/personalAgendaHandlers.js` | DnD 핸들러 (task/row drop) | C8, C9 |

### 수정 파일 (3개)
| 경로 | 변경 | 커밋 |
|---|---|---|
| `src/styles/designTokens.js` | AGENDA / HIGHLIGHT / MATRIX 토큰 추가 | C2 |
| `src/hooks/useStore.js` | hoveredTaskId 추가 + mapTask/taskToRow agendas 처리 | C3a, C3b |
| `src/components/views/personal-todo/PersonalTodoShell.jsx` | swap + dispatcher 등록 + handleDragEnd dispatch 호출 | C8, C9, C10 |

### 수정 안 함 (재사용)
- `SortableTaskCard.jsx`, `DroppableCell.jsx`, `InlineAdd.jsx`, `DetailPanel.jsx`, `MilestoneSelector.jsx`
- `UnifiedGridView.jsx` (외부 DndContext, team-matrix dispatcher는 그대로)
- `PersonalMatrixGrid.jsx`, `Sidebar.jsx`, `App.jsx`

---

## 1. DB 마이그레이션 (C1)

### 파일: `supabase/migrations/20260518000000_personal_agenda_matrix_tasks_agendas.sql`

```sql
-- Personal Agenda Matrix — Spec r2 C1
-- A안: tasks.agendas text[] 단일 컬럼

BEGIN;

-- 1. agendas 컬럼 추가 (기존 데이터 보호: DEFAULT '{}')
ALTER TABLE tasks
  ADD COLUMN agendas text[] NOT NULL DEFAULT '{}';

-- 2. 값 범위 제약 (4개 고정 아젠다 enum)
ALTER TABLE tasks
  ADD CONSTRAINT valid_agendas CHECK (
    agendas <@ ARRAY[
      'weekly_jason',
      'weekly_planning',
      'decision_needed',
      'personal'
    ]::text[]
  );

-- 3. GIN 인덱스 (셀 필터 쿼리 대비)
CREATE INDEX IF NOT EXISTS tasks_agendas_gin
  ON tasks USING GIN (agendas);

-- 4. RLS 정책 변경 없음 — agendas는 task 본체 컬럼이므로 기존 정책 자동 적용
-- 5. updated_at 트리거는 이미 적용되어 있음 (polling sync 호환)

COMMIT;
```

### 적용 명령 (사용자가 수동 실행)
```bash
# Supabase CLI
supabase db push

# 또는 Supabase Studio SQL editor에 위 SQL 붙여넣기
```

### 검증 SQL
```sql
-- 컬럼 존재 + 타입 + 기본값 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name='tasks' AND column_name='agendas';
-- Expected: agendas | ARRAY | '{}'::text[]

-- 제약 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname='valid_agendas';

-- 인덱스 확인
SELECT indexname FROM pg_indexes
WHERE tablename='tasks' AND indexname='tasks_agendas_gin';

-- 기존 task 영향 없음 확인
SELECT count(*) FROM tasks WHERE agendas IS NULL;  -- Expected: 0
SELECT count(*) FROM tasks WHERE agendas = '{}';    -- Expected: 전체 task 수
```

---

## 2. 디자인 토큰 (C2)

### 파일: `src/styles/designTokens.js`

**str_replace 앵커**: 기존 `PILL` 객체 (line 105-108) 직후 삽입.

```diff
 // ─── 카운트 pill (Loop 42, R13) ───
 export const PILL = {
   amber: { bg: '#FAEEDA', fg: '#854F0B', borderRadius: 10, padding: '1px 8px', fontWeight: 500 },
   coral: { bg: '#FAECE7', fg: '#993C1D', borderRadius: 10, padding: '1px 8px', fontWeight: 500 },
 };

+// ─── 아젠다 색상 (Spec r2 R-TOKEN-1) ───
+export const AGENDA = {
+  jasonWeekly:    { dot: '#7F77DD', chipBg: '#EEEDFE', chipText: '#3C3489' },
+  planningWeekly: { dot: '#1D9E75', chipBg: '#E1F5EE', chipText: '#085041' },
+  decisionNeeded: { dot: '#D85A30', chipBg: '#FAECE7', chipText: '#712B13' },
+  personal:       { dot: '#888780', chipBg: '#F1EFE8', chipText: '#444441' },
+};
+
+// ─── 크로스셀 하이라이트 (Spec r2 R-TOKEN-2) ───
+export const HIGHLIGHT = {
+  crossCell: {
+    bg:      '#FAEEDA',  // amber 50
+    outline: '#EF9F27',  // amber 400
+    text:    '#633806',  // amber 800
+  },
+};
+
+// ─── 매트릭스 추가 토큰 (Spec r2 R-TOKEN-3) ───
+export const MATRIX = {
+  inboxRowBg: '#FAF8F2',
+  stripedPattern: 'repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(0,0,0,0.015) 6px, rgba(0,0,0,0.015) 7px)',
+};
+
 // ─── 피벗 매트릭스 (Loop 42 / team-tasks-band-dnd) ───
 export const PIVOT = {
```

### 검증
- `npm run build` 통과
- `grep '#c4c2ba\|#d3d1c7' src/styles/designTokens.js` → 0건
- console: `import('./src/styles/designTokens').then(m => console.log(m.AGENDA.jasonWeekly.dot))` → `'#7F77DD'`

---

## 3. Zustand store (C3a, C3b)

### C3a — `src/hooks/useStore.js`: hoveredTaskId 추가

**str_replace 앵커**: store create() 인자 안의 UI state 영역. 검색 키워드: `detailTask:` 또는 `currentTeamId:` 인근.

**구체적 위치** (예시 — 실제 적용 전 grep 재확인):
```
useStore.js 어디든 단순 state 정의 영역에 추가. 권장 위치: detailTask 정의 옆.
```

**추가 코드**:
```js
// Spec r2 R-STORE-5: 크로스셀 hover 강조용
hoveredTaskId: null,
setHoveredTaskId: (id) => set({ hoveredTaskId: id }),
```

### C3b — `src/hooks/useStore.js`: mapTask / taskToRow

**mapTask 수정** (`useStore.js:185-209`):

```diff
 function mapTask(r) {
   return {
     id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
     done: r.done || false, dueDate: r.due_date || '', startDate: r.start_date || '',
     notes: r.notes || '', prevCategory: r.prev_category || '',
     sortOrder: r.sort_order || 0, alarm: r.alarm ?? null,
     ...
     isFocus: r.is_focus === true,
     focus_sort_order: r.focus_sort_order ?? 0,
+    // ↓ Spec r2 R-STORE-2: agendas N:M (text[]) ↓
+    agendas: r.agendas || [],
   }
 }
```

**taskToRow 수정** (`useStore.js:122-146`):

```diff
 function taskToRow(t) {
   const row = {
     id: t.id, text: t.text, project_id: t.projectId, category: t.category,
     ...
     is_focus: t.isFocus === true,
     focus_sort_order: t.focusSortOrder ?? 0,
+    // ↓ Spec r2 R-STORE-3: agendas N:M (text[]) ↓
+    agendas: t.agendas || [],
   }
   if (_alarmColExists) row.alarm = t.alarm ?? null
   return row
 }
```

### 검증 (C3a + C3b)
- `npm run build` 통과
- 브라우저 콘솔:
  ```js
  useStore.getState().hoveredTaskId         // null
  useStore.getState().setHoveredTaskId('x')
  useStore.getState().hoveredTaskId         // 'x'
  ```
- `useStore.getState().tasks[0]?.agendas` → `[]` (기존 task)
- 새 task 추가 후 Supabase에서 row 조회 → `agendas: []`

---

## 4. cellKey + getCellTasks 유틸 (C4b 일부)

### 파일: `src/utils/dnd/cellKeys/personalAgenda.js`

```js
/* Personal Agenda Matrix cellKey utility — Spec r2 R-DND-2, C4b
 *
 * cellKey 구조: { msId: uuid|null, agendaType: string }
 *   - msId = null  → inbox 행 (keyMilestoneId IS NULL)
 *   - msId = uuid  → 특정 key_milestone 행
 *
 * droppable id 규칙:
 *   - 'agenda-cell:{msId|inbox}:{agendaType}'           — cell 자체
 *   - 'agenda-cell-sortable:{msId|inbox}:{agendaType}'  — SortableContext
 *   - 'agenda-row:{msId|inbox}'                          — 행 헤더
 */

export const AGENDA_TYPES = ['weekly_jason', 'weekly_planning', 'decision_needed', 'personal']

export function makeCellKey(msId, agendaType) {
  return { msId: msId ?? null, agendaType }
}

export function makeCellId(msId, agendaType) {
  return `agenda-cell:${msId || 'inbox'}:${agendaType}`
}

export function makeSortableId(msId, agendaType) {
  return `agenda-cell-sortable:${msId || 'inbox'}:${agendaType}`
}

export function makeRowId(msId) {
  return `agenda-row:${msId || 'inbox'}`
}

export function parseCellId(idStr) {
  const s = String(idStr)
  const m = /^agenda-cell(?:-sortable)?:([^:]+):(.+)$/.exec(s)
  if (!m) return null
  return { msId: m[1] === 'inbox' ? null : m[1], agendaType: m[2] }
}

export function parseRowId(idStr) {
  const m = /^agenda-row:(.+)$/.exec(String(idStr))
  if (!m) return null
  return { msId: m[1] === 'inbox' ? null : m[1] }
}

export function sameCellKey(a, b) {
  return a && b && a.msId === b.msId && a.agendaType === b.agendaType
}

/**
 * Spec r2 R-COMP-6 / C4b: 셀 한 칸의 task 목록 + 정렬
 * @param {Array} tasks store.tasks
 * @param {{msId, agendaType}} cellKey
 * @param {{currentUserId, hideDone}} ctx
 */
export function getCellTasks(tasks, cellKey, ctx) {
  const { currentUserId, hideDone } = ctx
  return tasks
    .filter(t =>
      t.assigneeId === currentUserId &&
      !t.deletedAt &&
      (hideDone ? !t.done : true) &&
      (cellKey.msId === null
        ? t.keyMilestoneId == null
        : t.keyMilestoneId === cellKey.msId) &&
      Array.isArray(t.agendas) && t.agendas.includes(cellKey.agendaType)
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

/**
 * matrix 행으로 표시할 milestone 목록
 * 필터: 현재 사용자에게 할당된 미완료 task가 ≥1개 있는 milestone (변동 행 수)
 */
export function getVisibleMilestones(milestones, tasks, currentUserId) {
  const myMs = new Set(
    tasks
      .filter(t => t.assigneeId === currentUserId && !t.done && !t.deletedAt && t.keyMilestoneId)
      .map(t => t.keyMilestoneId)
  )
  return milestones
    .filter(m => myMs.has(m.id))
    .sort((a, b) => {
      // 상위 프로젝트별 그룹 → 내부 sort_order
      if (a.project_id !== b.project_id) {
        return String(a.project_id).localeCompare(String(b.project_id))
      }
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
}
```

---

## 5. 매트릭스 컴포넌트 (C4a, C4b, C5)

### C4a — `PersonalAgendaMatrixTable.jsx` (skeleton)

```jsx
import { useMemo } from 'react'
import useStore, { getCachedUserId } from '../../../hooks/useStore'
import { COLOR, FONT, SPACE, MATRIX } from '../../../styles/designTokens'
import { AGENDA_TYPES, getVisibleMilestones } from '../../../utils/dnd/cellKeys/personalAgenda'
import AgendaColHeader from './cells/AgendaColHeader'
import AgendaRowHeader from './cells/AgendaRowHeader'

/* PersonalAgendaMatrixTable — Spec r2 C4a (skeleton)
 * 행 = key_milestone (uuid), 열 = 4 agenda (고정)
 * D5 평탄화: milestone sub-row 없음
 */
export default function PersonalAgendaMatrixTable({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const visibleMs = useMemo(
    () => getVisibleMilestones(milestones, tasks, currentUserId),
    [milestones, tasks, currentUserId]
  )

  // grid: 200px(라벨) + 4 * 1fr (agenda 컬럼)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '200px repeat(4, minmax(160px, 1fr))',
      gap: 1,
      background: COLOR.divider,
      border: `1px solid ${COLOR.border}`,
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Header row */}
      <div style={{ background: '#fff', padding: SPACE.cellPadding ?? 8, fontWeight: 600, fontSize: FONT.label, color: COLOR.textSecondary }}>
        프로젝트 / 마일스톤
      </div>
      {AGENDA_TYPES.map(agendaType => (
        <AgendaColHeader key={agendaType} agendaType={agendaType} />
      ))}

      {/* (C5에서 AgendaInboxRow 삽입) */}

      {/* Milestone rows */}
      {visibleMs.map(ms => {
        const project = projects.find(p => p.id === ms.project_id)
        return (
          <RowFragment key={ms.id}>
            <AgendaRowHeader milestone={ms} project={project} />
            {AGENDA_TYPES.map(agendaType => (
              <div
                key={agendaType}
                style={{
                  background: MATRIX.stripedPattern,
                  minHeight: 60,
                  // (C4b에서 AgendaMatrixCell로 교체)
                }}
              />
            ))}
          </RowFragment>
        )
      })}
    </div>
  )
}

// react-fragment-with-key
function RowFragment({ children }) { return <>{children}</> }
```

### C4a — `AgendaColHeader.jsx`

```jsx
import { AGENDA } from '../../../../styles/designTokens'

const LABELS = {
  weekly_jason:    'Jason 위클리',
  weekly_planning: 'Planning 위클리',
  decision_needed: '의사결정 필요',
  personal:        '내 개인 할일',
}

export default function AgendaColHeader({ agendaType }) {
  const t = AGENDA[
    agendaType === 'weekly_jason' ? 'jasonWeekly' :
    agendaType === 'weekly_planning' ? 'planningWeekly' :
    agendaType === 'decision_needed' ? 'decisionNeeded' : 'personal'
  ]
  return (
    <div style={{
      background: '#fff',
      padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 6,
      fontWeight: 600, fontSize: 12, color: t.chipText,
    }}>
      <span style={{
        display: 'inline-block', width: 8, height: 8, borderRadius: 2,
        background: t.dot,
      }} />
      {LABELS[agendaType]}
    </div>
  )
}
```

### C4a — `AgendaRowHeader.jsx`

```jsx
import { COLOR, FONT } from '../../../../styles/designTokens'
import { getColor } from '../../../../utils/colors'

export default function AgendaRowHeader({ milestone, project }) {
  const color = project ? getColor(project.color) : null
  return (
    <div style={{
      background: '#fff',
      padding: '8px 12px',
      display: 'flex', flexDirection: 'column', gap: 2,
      position: 'sticky', left: 0, zIndex: 1,
      borderRight: `1px solid ${COLOR.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {color && <span style={{ width: 8, height: 8, borderRadius: 2, background: color.dot }} />}
        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{project?.name || '(no project)'}</span>
      </div>
      <span style={{
        fontSize: FONT.body, fontWeight: 600, color: COLOR.textPrimary,
        whiteSpace: 'normal', wordBreak: 'keep-all',  // R-CONST-6 준수
      }}>
        {milestone.title || '(제목 없음)'}
      </span>
    </div>
  )
}
```

### C4b — `AgendaMatrixCell.jsx`

```jsx
import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import useStore, { getCachedUserId } from '../../../../hooks/useStore'
import { MATRIX } from '../../../../styles/designTokens'
import { getCellTasks, makeCellId, makeSortableId } from '../../../../utils/dnd/cellKeys/personalAgenda'
import AgendaMatrixTaskCard from './AgendaMatrixTaskCard'

export default function AgendaMatrixCell({ cellKey, tasks, hideDone, onEmptyClick }) {
  const currentUserId = getCachedUserId()
  const cellTasks = getCellTasks(tasks, cellKey, { currentUserId, hideDone })

  const cellId = makeCellId(cellKey.msId, cellKey.agendaType)
  const sortableId = makeSortableId(cellKey.msId, cellKey.agendaType)

  const { setNodeRef, isOver } = useDroppable({
    id: cellId,
    data: { type: 'agenda-matrix-task', cellKey },
  })

  const isEmpty = cellTasks.length === 0

  return (
    <div
      ref={setNodeRef}
      onClick={isEmpty ? () => onEmptyClick?.(cellKey) : undefined}
      style={{
        background: isOver ? '#f5f4f0' : (isEmpty ? MATRIX.stripedPattern : '#fff'),
        minHeight: 60, padding: 6,
        cursor: isEmpty ? 'pointer' : 'default',
      }}
    >
      <SortableContext id={sortableId} items={cellTasks.map(t => `cell-task:${t.id}`)} strategy={verticalListSortingStrategy}>
        {cellTasks.map(task => (
          <AgendaMatrixTaskCard key={task.id} task={task} cellKey={cellKey} />
        ))}
      </SortableContext>
    </div>
  )
}
```

### C4b — `AgendaMatrixTaskCard.jsx` (wrapper, C7/C8.5에서 확장)

```jsx
import React from 'react'
import useStore from '../../../../hooks/useStore'
import { HIGHLIGHT, PILL, AGENDA } from '../../../../styles/designTokens'
import SortableTaskCard from '../../../dnd/SortableTaskCard'

/* AgendaMatrixTaskCard — Spec r2 R-COMP-8 (SortableTaskCard 수정 0건 wrapper)
 *   - C4b: ⭐ is_focus 뱃지 + category 칩 + 카드 마운트
 *   - C7: cross-cell hover 강조 (useStore selector)
 *   - C8.5: hover 시 우측 X 버튼 (단일 agenda 제거)
 */
const AgendaMatrixTaskCard = React.memo(function AgendaMatrixTaskCard({ task, cellKey }) {
  const isHovered = useStore(s => s.hoveredTaskId === task.id)
  const setHoveredTaskId = useStore(s => s.setHoveredTaskId)
  const updateTask = useStore(s => s.updateTask)
  const [showX, setShowX] = React.useState(false)

  const hoverStyle = isHovered ? {
    background: HIGHLIGHT.crossCell.bg,
    outline: `1px solid ${HIGHLIGHT.crossCell.outline}`,
    color: HIGHLIGHT.crossCell.text,
  } : undefined

  const handleRemoveAgenda = (e) => {
    e.stopPropagation()
    const next = (task.agendas || []).filter(a => a !== cellKey.agendaType)
    updateTask(task.id, { agendas: next })
  }

  const showCategoryChip = task.category && task.category !== 'today'

  return (
    <div
      onMouseEnter={() => { setHoveredTaskId(task.id); setShowX(true) }}
      onMouseLeave={() => { setHoveredTaskId(null); setShowX(false) }}
      style={{ position: 'relative', borderRadius: 4, ...hoverStyle }}
    >
      {/* ⭐ is_focus 뱃지 */}
      {task.isFocus && (
        <span style={{ position: 'absolute', left: 2, top: 2, fontSize: 10, color: '#D85A30', pointerEvents: 'none' }}>⭐</span>
      )}

      <SortableTaskCard task={task} />

      {/* category 칩 (today 외) */}
      {showCategoryChip && (
        <span style={{
          position: 'absolute', right: showX ? 22 : 4, top: 4,
          ...PILL.amber, fontSize: 9,
        }}>
          {task.category === 'next' ? '다음' : task.category === 'later' ? '나중' : task.category === 'backlog' ? '백로그' : task.category}
        </span>
      )}

      {/* C8.5: chip X 버튼 */}
      {showX && (
        <button
          onClick={handleRemoveAgenda}
          style={{
            position: 'absolute', right: 4, top: 4,
            background: 'transparent', border: 0, color: '#888780',
            fontSize: 12, cursor: 'pointer', padding: '0 4px',
          }}
          aria-label="아젠다 태그 제거"
        >×</button>
      )}
    </div>
  )
})

export default AgendaMatrixTaskCard
```

### C4b — `PersonalAgendaMatrixTable.jsx` (cell 마운트)

C4a의 빈 셀 `<div style={{ background: MATRIX.stripedPattern, ... }} />`를 다음으로 교체:

```jsx
import AgendaMatrixCell from './cells/AgendaMatrixCell'
import { makeCellKey } from '../../../utils/dnd/cellKeys/personalAgenda'

// ... 행 렌더링 안에서 ...
{AGENDA_TYPES.map(agendaType => (
  <AgendaMatrixCell
    key={agendaType}
    cellKey={makeCellKey(ms.id, agendaType)}
    tasks={tasks}
    hideDone={hideDone}
    onEmptyClick={onEmptyClick}  // C6에서 정의
  />
))}
```

### C5 — `AgendaInboxRow.jsx` (PersonalAgendaMatrixTable tbody 최상단 고정)

```jsx
import { useMemo } from 'react'
import { getCachedUserId } from '../../../../hooks/useStore'
import { COLOR, FONT, MATRIX } from '../../../../styles/designTokens'

export default function AgendaInboxRow({ tasks, children }) {
  const currentUserId = getCachedUserId()
  const inboxCount = useMemo(
    () => tasks.filter(t =>
      t.assigneeId === currentUserId &&
      t.keyMilestoneId == null &&
      !t.done && !t.deletedAt
    ).length,
    [tasks, currentUserId]
  )

  return (
    <>
      <div style={{
        background: MATRIX.inboxRowBg, padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 6,
        position: 'sticky', left: 0, zIndex: 1,
        borderRight: `1px solid ${COLOR.border}`,
      }}>
        <span style={{ fontSize: 14 }}>📥</span>
        <span style={{ fontSize: FONT.body, fontWeight: 600, color: COLOR.textPrimary }}>신규 할일</span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>{inboxCount}</span>
      </div>
      {children /* 4 cells (msId=null) — 부모(PersonalAgendaMatrixTable)에서 마운트 */}
    </>
  )
}
```

PersonalAgendaMatrixTable의 milestone rows 직전에 inbox row 추가:
```jsx
<AgendaInboxRow tasks={tasks}>
  {AGENDA_TYPES.map(agendaType => (
    <AgendaMatrixCell
      key={agendaType}
      cellKey={makeCellKey(null, agendaType)}
      tasks={tasks}
      hideDone={hideDone}
      onEmptyClick={onEmptyClick}
    />
  ))}
</AgendaInboxRow>
```

---

## 6. 셀 빈 영역 클릭 (C6)

### `PersonalAgendaMatrixTable.jsx` 추가
```jsx
const [activeCellKey, setActiveCellKey] = useState(null)
// onEmptyClick={setActiveCellKey} 전달
```

### `AgendaMatrixCell.jsx` 또는 cell 내부에 inlineAdd 분기
```jsx
import InlineAdd from '../../../shared/InlineAdd'

// 셀 props에 activeCellKey, setActiveCellKey 추가, 또는 cellKey 비교 후 InlineAdd 렌더
// instant project id 조회:
const instantProjectId = useStore(s =>
  (s.projects.find(p => p.systemKey === 'instant' || p.isSystem === true) || {}).id
)

// 활성 시 InlineAdd:
{isActive && (
  <InlineAdd
    projectId={
      cellKey.msId
        ? (milestones.find(m => m.id === cellKey.msId)?.project_id || instantProjectId)
        : instantProjectId
    }
    category="today"
    color={null}
    extraFields={{
      agendas: [cellKey.agendaType],
      keyMilestoneId: cellKey.msId,
    }}
  />
)}
```

(InlineAdd 컴포넌트가 onFinish callback을 props로 받는지 확인 필요 — C6 적용 시 시그니처 검토 후 ESC 핸들링 결정.)

---

## 7. DnD 핸들러 (C8, C9)

### 파일: `src/components/views/grid/dnd/personalAgendaHandlers.js`

```js
import {
  parseCellId, parseRowId, sameCellKey,
} from '../../../../utils/dnd/cellKeys/personalAgenda'

const TASK_ID_PREFIX = 'cell-task:'

function getTaskId(activeIdStr) {
  return activeIdStr.startsWith(TASK_ID_PREFIX)
    ? activeIdStr.slice(TASK_ID_PREFIX.length)
    : activeIdStr
}

/* C8 — cell-to-cell drag (agenda 추가 모드) */
export function handleAgendaMatrixTaskDrop(e, ctx) {
  const { active, over } = e
  if (!over) return
  const type = over.data?.current?.type
  if (type !== 'agenda-matrix-task') return  // dispatcher가 type 검증 후 호출하지만 방어

  const taskId = getTaskId(String(active.id))
  const task = ctx.tasks.find(t => t.id === taskId)
  if (!task) return

  const dstCellKey = over.data.current.cellKey
  const srcCellKey = active.data?.current?.cellKey || parseCellId(String(active.id))
  if (!dstCellKey) return

  // 같은 셀 재정렬 → reorderTasks
  if (srcCellKey && sameCellKey(srcCellKey, dstCellKey)) {
    // 셀 내 task 정렬은 sortOrder 기반. arrayMove 후 reorderTasks 호출.
    // (구현 디테일: useSortable's over.id는 다른 task id) — getCellTasks(ctx.tasks, srcCellKey, ctx) 후 arrayMove
    // ctx.reorderTasks(reordered) 호출
    return
  }

  // 다른 셀 → agendaType 추가 (R-DND-4, R-DND-5)
  const patch = {}
  patch.agendas = Array.from(new Set([
    ...(task.agendas || []),
    dstCellKey.agendaType,
  ]))

  // 다른 milestone 행이면 keyMilestoneId 변경 (R-DND-5)
  // 행=key_milestone → projectId 미변경 → R5 우회 불필요
  if (!srcCellKey || srcCellKey.msId !== dstCellKey.msId) {
    patch.keyMilestoneId = dstCellKey.msId  // null = inbox
  }

  ctx.updateTask(task.id, patch)
}

/* C9 — row-header drag (milestone 재할당) */
export function handleAgendaMatrixRowDrop(e, ctx) {
  const { active, over } = e
  if (!over) return
  if (over.data?.current?.type !== 'agenda-matrix-row') return

  const taskId = getTaskId(String(active.id))
  const task = ctx.tasks.find(t => t.id === taskId)
  if (!task) return

  const dstMsId = over.data.current.msId  // null = inbox
  if (task.keyMilestoneId === dstMsId) return  // no-op

  ctx.updateTask(task.id, { keyMilestoneId: dstMsId })
}
```

---

## 8. PersonalTodoShell 통합 (C8, C9, C10)

### `src/components/views/personal-todo/PersonalTodoShell.jsx` 수정

**Step A — import 추가 (모듈 최상단)**:
```diff
 import { canMoveTaskToProject } from '../../../utils/dnd/guards'
+import { dispatch as dispatchDrop, registerHandler } from '../../../utils/dnd/dispatcher'
+import {
+  handleAgendaMatrixTaskDrop,
+  handleAgendaMatrixRowDrop,
+} from '../grid/dnd/personalAgendaHandlers'
+
+// Spec r2 R-DND-1: PersonalTodoShell 모듈 최상단 등록 (inner DndContext에서 dispatch 호출)
+registerHandler('agenda-matrix-task', handleAgendaMatrixTaskDrop)
+registerHandler('agenda-matrix-row', handleAgendaMatrixRowDrop)
```

**Step B — handleDragEnd 시작부에 dispatchDrop 호출 추가** (`PersonalTodoShell.jsx:82`):

```diff
   const handleDragEnd = useCallback((e) => {
     const { active, over } = e
     const activeIdStr = String(active?.id || '')

     if (!over) return  // F-24 revised: 포커스 해제는 × 버튼만

     const overId = String(over.id)

+    // ═══ Spec r2 B2: agenda-matrix dispatcher (inner context) ═══
+    const ctx = {
+      tasks, projects, milestones, currentUserId,
+      updateTask, reorderTasks,
+    }
+    if (dispatchDrop(e, ctx)) return
+
     // ═══ 1) 백로그 → 포커스 패널 (F-23) ═══
     if (activeIdStr.startsWith('bl-task:')) {
       ...
```

**Step C — useCallback deps 갱신**:
```diff
-  }, [focusTasks, projects, tasks, currentUserId, updateTask, reorderFocusTasks, reorderTasks, setExpanded])
+  }, [focusTasks, projects, tasks, milestones, currentUserId, updateTask, reorderFocusTasks, reorderTasks, setExpanded])
```

**Step D — C10 swap** (`PersonalTodoShell.jsx:9`):
```diff
-import PersonalTodoListTable from './PersonalTodoListTable'
+import PersonalAgendaMatrixTable from '../grid/PersonalAgendaMatrixTable'
```

**Step E — JSX swap** (`PersonalTodoShell.jsx:207`):
```diff
         <div style={{ minWidth: 0 }}>
-          <PersonalTodoListTable
+          <PersonalAgendaMatrixTable
             projects={projects}
             tasks={tasks}
             milestones={milestones}
           />
         </div>
```

**Step F — gridTemplateColumns** (`PersonalTodoShell.jsx:201`):
```diff
-        gridTemplateColumns: 'minmax(420px, 1.5fr) minmax(280px, 1fr)',
+        gridTemplateColumns: 'minmax(420px, 2fr) minmax(280px, 1fr)',
```

**총 6개 변경** (A~F). 그 외 부분 (DndContext, FocusColumn, FocusPanel, sensors, 기존 분기) 수정 0건.

---

## 9. 작업 순서 (직렬)

| # | 커밋 | 변경 파일 | 빌드 검증 |
|---|---|---|---|
| 1 | C1 | `supabase/migrations/20260518000000_...sql` (신규) | Supabase 마이그 적용 |
| 2 | C2 | `designTokens.js` | `npm run build` |
| 3 | C3a | `useStore.js` (hoveredTaskId) | `npm run build` |
| 4 | C3b | `useStore.js` (mapTask/taskToRow) | `npm run build` |
| 5 | C4a | `PersonalAgendaMatrixTable.jsx`, `AgendaColHeader.jsx`, `AgendaRowHeader.jsx` (신규) | 빌드 + 임시 마운트 시각 확인 |
| 6 | C4b | `AgendaMatrixCell.jsx`, `AgendaMatrixTaskCard.jsx`, `personalAgenda.js` (신규) | 빌드 + task 표시 확인 |
| 7 | C5 | `AgendaInboxRow.jsx` (신규) + PersonalAgendaMatrixTable 수정 | inbox row 표시 |
| 8 | C6 | AgendaMatrixCell + PersonalAgendaMatrixTable 수정 | 빈 셀 클릭 → InlineAdd |
| 9 | C7 | AgendaMatrixTaskCard hover 강조 | hover 시 동시 강조 |
| 10 | C8 | `personalAgendaHandlers.js` (신규) + PersonalTodoShell.jsx (Step A, B, C) | 셀↔셀 드래그 동작 |
| 11 | C8.5 | AgendaMatrixTaskCard X 버튼 | X 클릭 → 단일 태그 제거 |
| 12 | C9 | personalAgendaHandlers.js 확장 + AgendaRowHeader/AgendaInboxRow droppable | 행 헤더 drop 동작 |
| 13 | C10 | PersonalTodoShell.jsx (Step D, E, F) | 사이드바 "할일" → 매트릭스 마운트 |

---

## 10. 검증 절차 (각 커밋 후)

### 빌드 검증
```bash
cd ryan-todo
npm run build
```

### 자동 검증 (커밋 마다)
- `grep '#c4c2ba\|#d3d1c7' src/styles/designTokens.js` → 0
- `grep -n 'updateTask({' src/` → 0 (signature 위반 없음)
- `grep -n '^const [A-Z]* = COLOR\.' src/` → 0 (Vite TDZ)

### UI 검증 (C5 이후)
1. dev 서버 기동 (`npm run dev`) → 사이드바 "할일" 메뉴 클릭 (개인 모드)
2. 왼쪽: 매트릭스, 오른쪽: FocusPanel 확인
3. C5: inbox row 최상단 고정 확인
4. C6: 빈 셀 클릭 → InlineAdd 활성화 → Enter → 신규 task 해당 셀에 즉시 표시
5. C7: 동일 task가 여러 셀에 있을 때 hover → 모두 동시 강조
6. C8: 셀 A의 task를 셀 B로 드래그 → task.agendas에 B의 agendaType 추가, A 유지
7. C8.5: 카드 hover → X 클릭 → 그 셀에서만 사라짐
8. C9: inbox의 task → milestone X 행 헤더 drop → X로 이동
9. 회귀: 우측 FocusPanel 정상 동작 (백로그→포커스 드래그가 매트릭스 task에도 작동하는지 — 매트릭스 task의 active.id는 `cell-task:`라 `bl-task:` 분기 미진입 → 영향 없음 확인)

### Supabase 검증 (C1 후)
- Studio에서 컬럼/제약/인덱스 존재 확인
- 임의 task 1건에 `UPDATE tasks SET agendas = ARRAY['weekly_jason'] WHERE id = ...` → 매트릭스에 즉시 표시 (polling 10s)

---

## 11. 위험 요소 / 미해결

| # | 위험 | 대응 |
|---|---|---|
| W1 | C8의 "같은 셀 재정렬" 코드가 의사코드 — 실제 active.id가 다른 task의 cell-task:id일 수 있음. `getCellTasks` 후 arrayMove 호출 + reorderTasks 시그니처 정확히 확인 필요 | C8 적용 시 PersonalTodoShell L114-142의 reorder 패턴 참조 |
| W2 | InlineAdd가 onFinish callback prop을 받지 않을 경우 ESC 비활성 등 UX 깎임 | C6 적용 직전 InlineAdd.jsx 시그니처 read → 미지원 시 InlineAdd wrapper 신설 |
| W3 | `getColor(project.color)` API 시그니처 검증 미완 | C4a 적용 직전 `src/utils/colors.js` read |
| W4 | dispatchDrop(e, ctx) 호출 시점에서 outer dispatcher와 inner dispatcher가 같은 HANDLERS map을 공유하므로, outer에서 등록된 `team-matrix-*` 핸들러가 inner에서도 호출됨. 하지만 inner DndContext의 active/over는 매트릭스 cell만 가지므로 type='team-matrix-task'는 inner에서 발생 안 함 → 충돌 없음. 단, 등록되지 않은 type일 때 false 반환되어 fallback 실행 — 정상 동작 | 모니터링: C8 적용 후 기존 백로그/포커스 드래그 회귀 0 |
| W5 | matrix 행 수가 0일 때 (사용자가 어떤 milestone에도 task 없음) UX | inbox row만 표시 (C5의 기본 동작) — 의도된 비어있는 상태 |
| W6 | `milestones` store에 `project_id` 등이 snake_case로 들어있음 (mapTask 같은 매핑 없음). 코드에서 직접 `m.project_id` 사용 — Existing pattern과 일치 ✓ | 변경 불필요 |

---

## 12. 후속 (별도 PR)

### DELETE-5 PR (spec §3 참조)
- `PersonalTodoListTable.jsx`, `PersonalTodoProjectGroup.jsx`, `PersonalTodoTaskRow.jsx` 삭제
- 사용처 grep 후 0건 확인
- 본 plan 범위 외

---

**다음 단계**: 본 diff plan 검토 → 사용자 승인 → `/execute personal-agenda-matrix` 또는 커밋별 수동 진행. C1 → C10 직렬, 각 커밋 후 빌드 + UI 검증.
