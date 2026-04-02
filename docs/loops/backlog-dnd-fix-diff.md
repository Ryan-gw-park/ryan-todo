# 백로그 DnD 배정 버그 수정 — 구현 Diff

## 진단 결과

| # | 원인 | 위치 |
|---|------|------|
| B1 | `MsBacklogSidebar`가 `<DndContext>` **바깥**에 렌더링되어 dnd-kit 드롭 영역과 통신 불가 | UnifiedGridView.jsx L252/L255 |
| B2 | 백로그 아이템이 네이티브 HTML `draggable`을 사용하고, dnd-kit `useDraggable`을 사용하지 않음 | MsBacklogSidebar.jsx L211/L258 |
| B3 | `handleDragEnd`에 백로그 MS/할일 드롭 처리 로직 부재 | UnifiedGridView.jsx L120-155 |

## 수정 요약

| 파일 | 변경 |
|---|---|
| `MsBacklogSidebar.jsx` | 네이티브 `draggable` → dnd-kit `useDraggable` 래퍼로 교체 |
| `UnifiedGridView.jsx` | Sidebar를 DndContext 안으로 이동, handleDragEnd에 백로그 드롭 로직 추가, DragOverlay 업데이트 |

## ID 규칙

| 드래그 소스 | ID 형식 | 예시 |
|---|---|---|
| 그리드 내 할일 | `{taskId}` (기존) | `abc-123` |
| 백로그 MS | `bl-ms:{msId}` | `bl-ms:ms-456` |
| 백로그 할일 | `bl-task:{taskId}` | `bl-task:abc-789` |

---

## Commit 1: 백로그 DnD 수정

### Diff A — `src/components/common/MsBacklogSidebar.jsx` : dnd-kit import 추가

**str_replace #1**

```javascript
<<<<<<< OLD
import { useState, useMemo } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
=======
import { useState, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { COLOR, FONT } from '../../styles/designTokens'
>>>>>>> NEW
```

### Diff B — `src/components/common/MsBacklogSidebar.jsx` : MS 아이템을 dnd-kit draggable로 교체

**str_replace #2**

```javascript
<<<<<<< OLD
                  {msList.map(ms => {
                    const parentPath = getParentPath(ms)
                    const tc = getTaskCount(ms.id)
                    return (
                      <div key={ms.id} draggable style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 8px', marginBottom: 3, borderRadius: 5,
                        background: `${c.dot}08`, border: `0.5px solid ${c.dot}18`,
                        cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.background = `${c.dot}15`; e.currentTarget.style.borderColor = `${c.dot}40` }}
                        onMouseLeave={e => { e.currentTarget.style.background = `${c.dot}08`; e.currentTarget.style.borderColor = `${c.dot}18` }}
                      >
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: COLOR.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ms.title || '(제목 없음)'}
                          </div>
                          {parentPath && (
                            <div style={{ fontSize: 8.5, color: COLOR.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {parentPath}
                            </div>
                          )}
                        </div>
                        {tc > 0 && <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{tc}</span>}
                      </div>
                    )
                  })}
=======
                  {msList.map(ms => (
                    <BacklogMsItem key={ms.id} ms={ms} dotColor={c.dot} getParentPath={getParentPath} getTaskCount={getTaskCount} />
                  ))}
>>>>>>> NEW
```

### Diff C — `src/components/common/MsBacklogSidebar.jsx` : 할일 아이템을 dnd-kit draggable로 교체

**str_replace #3**

```javascript
<<<<<<< OLD
                  {taskList.map(task => (
                    <div key={task.id} draggable style={{
                      display: 'flex', alignItems: 'flex-start', gap: 5,
                      padding: '4px 8px', marginBottom: 3, borderRadius: 5,
                      background: `${c.dot}06`, border: `0.5px solid ${c.dot}15`,
                      cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${c.dot}12`; e.currentTarget.style.borderColor = `${c.dot}35` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `${c.dot}06`; e.currentTarget.style.borderColor = `${c.dot}15` }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: 2, flexShrink: 0, marginTop: 1,
                        border: `1.5px solid ${COLOR.textTertiary}`, background: '#fff',
                      }} />
                      <span style={{
                        flex: 1, fontWeight: 400, color: COLOR.textPrimary, lineHeight: 1.4,
                        whiteSpace: 'normal', wordBreak: 'break-word',
                      }}>
                        {task.text}
                      </span>
                      {task.dueDate && (
                        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
                      )}
                    </div>
                  ))}
=======
                  {taskList.map(task => (
                    <BacklogTaskItem key={task.id} task={task} dotColor={c.dot} />
                  ))}
>>>>>>> NEW
```

### Diff D — `src/components/common/MsBacklogSidebar.jsx` : 파일 끝에 dnd-kit 래퍼 컴포넌트 추가

**str_replace #4** — 파일 마지막 `}` 뒤에 추가

```javascript
<<<<<<< OLD
      {/* Hint */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${COLOR.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 셀로 드래그하여 {contentType === 'ms' ? 'MS' : '할일'} 배정</span>
      </div>
    </div>
  )
}
=======
      {/* Hint */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${COLOR.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: 10, color: COLOR.textTertiary }}>← 셀로 드래그하여 {contentType === 'ms' ? 'MS' : '할일'} 배정</span>
      </div>
    </div>
  )
}

/* ─── Draggable backlog items (dnd-kit) ─── */

function BacklogMsItem({ ms, dotColor, getParentPath, getTaskCount }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `bl-ms:${ms.id}` })
  const parentPath = getParentPath(ms)
  const tc = getTaskCount(ms.id)
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 8px', marginBottom: 3, borderRadius: 5,
        background: hover ? `${dotColor}15` : `${dotColor}08`,
        border: `0.5px solid ${hover ? `${dotColor}40` : `${dotColor}18`}`,
        cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, color: COLOR.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ms.title || '(제목 없음)'}
        </div>
        {parentPath && (
          <div style={{ fontSize: 8.5, color: COLOR.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {parentPath}
          </div>
        )}
      </div>
      {tc > 0 && <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{tc}</span>}
    </div>
  )
}

function BacklogTaskItem({ task, dotColor }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `bl-task:${task.id}` })
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={setNodeRef} {...attributes} {...listeners}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 5,
        padding: '4px 8px', marginBottom: 3, borderRadius: 5,
        background: hover ? `${dotColor}12` : `${dotColor}06`,
        border: `0.5px solid ${hover ? `${dotColor}35` : `${dotColor}15`}`,
        cursor: 'grab', fontSize: 11, transition: 'all 0.1s',
        opacity: isDragging ? 0.3 : 1,
      }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: 2, flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${COLOR.textTertiary}`, background: '#fff',
      }} />
      <span style={{
        flex: 1, fontWeight: 400, color: COLOR.textPrimary, lineHeight: 1.4,
        whiteSpace: 'normal', wordBreak: 'break-word',
      }}>
        {task.text}
      </span>
      {task.dueDate && (
        <span style={{ fontSize: 9, color: COLOR.textTertiary, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>
      )}
    </div>
  )
}
>>>>>>> NEW
```

---

### Diff E — `src/components/views/UnifiedGridView.jsx` : store에서 updateMilestone 추가

**str_replace #5**

```javascript
<<<<<<< OLD
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally } = useStore()
=======
  const { projects, tasks, updateTask, moveTaskTo, reorderTasks, toggleDone, openDetail, addTask, sortProjectsLocally, updateMilestone } = useStore()
>>>>>>> NEW
```

### Diff F — `src/components/views/UnifiedGridView.jsx` : activeTask를 activeItem으로 교체 (MS/할일 공용)

**str_replace #6**

```javascript
<<<<<<< OLD
  const [activeId, setActiveId] = useState(null)
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null
=======
  const [activeId, setActiveId] = useState(null)
  const activeItem = useMemo(() => {
    if (!activeId) return null
    const id = String(activeId)
    if (id.startsWith('bl-ms:')) {
      const ms = milestones.find(m => m.id === id.slice(6))
      return ms ? { type: 'ms', data: ms } : null
    }
    const taskId = id.startsWith('bl-task:') ? id.slice(8) : id
    const task = tasks.find(t => t.id === taskId)
    return task ? { type: 'task', data: task } : null
  }, [activeId, tasks, milestones])
>>>>>>> NEW
```

### Diff G — `src/components/views/UnifiedGridView.jsx` : handleDragEnd에 백로그 드롭 로직 추가

**str_replace #7**

```javascript
<<<<<<< OLD
  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const task = tasks.find(t => t.id === active.id)
    if (!task) return
    const overId = String(over.id)

    // Parse drop zone ID → extract patch
    // Format: "mat:projId:category" | "tmat:projId:memberId" | "pw:projId:dateStr" | "tw:memberId:dateStr"
    const parts = overId.split(':')
    if (parts.length < 3) return

    const mode = parts[0]
    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(active.id, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(active.id, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(active.id, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(active.id, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask])
=======
  const handleDragEnd = useCallback((e) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const activeIdStr = String(active.id)
    const overId = String(over.id)

    // Parse drop zone ID → extract patch
    // Format: "mat:projId:category" | "tmat:projId:memberId" | "pw:projId:dateStr" | "tw:memberId:dateStr"
    const parts = overId.split(':')
    if (parts.length < 3) return
    const mode = parts[0]

    // ─── Backlog MS drop → owner 배정 ───
    if (activeIdStr.startsWith('bl-ms:')) {
      const msId = activeIdStr.slice(6)
      if (mode === 'tmat') {
        const [, , targetMemberId] = parts
        updateMilestone(msId, { owner_id: targetMemberId })
      }
      // mat/pw/tw에는 MS 드롭 미적용
      return
    }

    // ─── Task drop (그리드 내부 or 백로그) ───
    const taskId = activeIdStr.startsWith('bl-task:') ? activeIdStr.slice(8) : activeIdStr
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (mode === 'mat') {
      // Personal matrix: project + category
      const [, targetProjId, targetCat] = parts
      if (task.projectId === targetProjId && task.category === targetCat) return
      moveTaskTo(taskId, targetProjId, targetCat)
    } else if (mode === 'tmat') {
      // Team matrix: project + assignee
      const [, targetProjId, targetMemberId] = parts
      if (task.projectId === targetProjId && task.assigneeId === targetMemberId) return
      updateTask(taskId, { projectId: targetProjId, assigneeId: targetMemberId, scope: 'assigned' })
    } else if (mode === 'pw') {
      // Personal weekly: project + date
      const [, , targetDate] = parts
      if (task.dueDate === targetDate) return
      updateTask(taskId, { dueDate: targetDate })
    } else if (mode === 'tw') {
      // Team weekly: member + date
      const [, targetMemberId, targetDate] = parts
      if (task.assigneeId === targetMemberId && task.dueDate === targetDate) return
      updateTask(taskId, { assigneeId: targetMemberId, dueDate: targetDate, scope: 'assigned' })
    }
  }, [tasks, moveTaskTo, updateTask, updateMilestone])
>>>>>>> NEW
```

### Diff H — `src/components/views/UnifiedGridView.jsx` : DragOverlay + MsBacklogSidebar를 DndContext 안으로 이동

**str_replace #8**

```javascript
<<<<<<< OLD
            <DragOverlay dropAnimation={null}>
              {activeTask ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${CHECKBOX.borderColor}`, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeTask.text}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Sidebar */}
          <MsBacklogSidebar projects={displayProjects} milestones={milestones} tasks={tasks} />
=======
            {/* Sidebar — DndContext 안에 위치해야 dnd-kit DnD 통신 가능 */}
            <MsBacklogSidebar projects={displayProjects} milestones={milestones} tasks={tasks} />

            <DragOverlay dropAnimation={null}>
              {activeItem?.type === 'task' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, border: `1.5px solid ${CHECKBOX.borderColor}`, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.text}</span>
                </div>
              ) : activeItem?.type === 'ms' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                  background: '#fff', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  border: '1px solid rgba(0,0,0,0.06)', transform: 'rotate(2deg)', cursor: 'grabbing', maxWidth: 240,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLOR.textTertiary, flexShrink: 0 }} />
                  <span style={{ fontSize: FONT.body, fontWeight: 500, color: COLOR.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeItem.data.title || '(제목 없음)'}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
>>>>>>> NEW
```

---

## DELETE-5 검증

### 삭제 대상

| 삭제 대상 | ① import | ② caller | ③ props | ④ deps | ⑤ types | 처리 |
|-----------|----------|----------|---------|--------|---------|------|
| `activeTask` 변수 (UnifiedGridView) | N/A | DragOverlay L241 → `activeItem`으로 교체 | N/A | `tasks`, `activeId` → `activeItem`이 동일 의존성 사용 | N/A | ✅ |
| 네이티브 `draggable` attr (MsBacklogSidebar L211, L258) | N/A | 인라인 → 제거됨, `BacklogMsItem`/`BacklogTaskItem`으로 대체 | `onMouseEnter`/`onMouseLeave` → 컴포넌트 내부 hover state로 대체 | N/A | N/A | ✅ |

### 잔여 import 검증
- [x] `useDraggable` — MsBacklogSidebar에 추가, `BacklogMsItem`/`BacklogTaskItem`에서 사용 → ✅
- [x] `useMemo` — UnifiedGridView에 기존 import, `activeItem`에서 추가 사용 → ✅
- [x] `updateMilestone` — UnifiedGridView에 추가, `handleDragEnd`에서 사용 → ✅
- [x] `FONT` — MsBacklogSidebar import에 존재하나 본문 미사용 → **기존 상태 유지** (이번 diff 범위 아님)

### 잔여 변수 검증
- [x] `activeTask` → `activeItem`으로 완전 교체, 잔여 참조 0건 ✅

---

## Claude Code 프롬프트

```
아래 diff를 순서대로 적용하라. 해석이나 판단 없이 지시 그대로만 이행하라.

파일 1: src/components/common/MsBacklogSidebar.jsx — str_replace #1~#4
파일 2: src/components/views/UnifiedGridView.jsx — str_replace #5~#8

각 str_replace 적용 후 파일 저장.
모든 적용 완료 후:
  npm run build
  빌드 성공 시: git add -A && git commit -m "fix: backlog DnD — integrate dnd-kit draggable + add MS/task drop handlers" && git push origin main
  빌드 실패 시: 에러 내용만 보고 (수정 금지)
```
