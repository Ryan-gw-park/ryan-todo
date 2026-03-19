import { useState, useMemo, useCallback, useRef } from 'react'
import useStore from '../../hooks/useStore'
import { collectLeaves, getNodePath, countTasksRecursive } from '../../utils/milestoneTree'

const S = {
  textPrimary: '#37352f',
  textSecondary: '#6b6a66',
  textTertiary: '#a09f99',
  border: '#e8e6df',
}

function Check({ done, onClick }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
        border: done ? 'none' : '1.5px solid #ccc',
        background: done ? '#2383e2' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {done && (
        <svg width={8} height={8} viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

function TaskRow({ task, color, onToggle, onOpen }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 14px 6px 28px',
        borderBottom: `0.5px solid ${S.border}`,
        cursor: 'pointer', transition: 'background 0.08s',
      }}
      onClick={() => onOpen(task.id)}
      onMouseEnter={e => e.currentTarget.style.background = '#fafaf8'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <Check done={task.done} onClick={() => onToggle(task.id)} />
      <span style={{
        flex: 1, fontSize: 12.5, lineHeight: 1.35,
        color: task.done ? S.textTertiary : S.textPrimary,
        textDecoration: task.done ? 'line-through' : 'none',
      }}>{task.text}</span>
      {task.dueDate && (
        <span style={{ fontSize: 10, color: S.textTertiary, flexShrink: 0 }}>{task.dueDate}</span>
      )}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.2, flexShrink: 0 }}>
        <path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ═══ 인라인 할일 추가 ═══ */
function InlineAddTask({ msId, projectId, onDone }) {
  const addTask = useStore(s => s.addTask)
  const inputRef = useRef(null)
  const [text, setText] = useState('')

  const submit = useCallback(async () => {
    const val = text.trim()
    if (!val) { onDone?.(); return }
    await addTask({
      text: val,
      projectId,
      keyMilestoneId: msId,
      category: 'backlog',
    })
    setText('')
    // 계속 입력 가능하도록 포커스 유지
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [text, addTask, projectId, msId, onDone])

  return (
    <div style={{ padding: '6px 14px 6px 28px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px solid #e8e6df', flexShrink: 0 }} />
      <input
        ref={inputRef}
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); submit() }
          if (e.key === 'Escape') { e.preventDefault(); onDone?.() }
        }}
        onBlur={submit}
        onMouseDown={e => e.stopPropagation()}
        placeholder="할일 입력..."
        style={{
          flex: 1, fontSize: 12.5, border: 'none', outline: 'none',
          background: 'transparent', color: S.textPrimary, fontFamily: 'inherit', padding: 0,
        }}
      />
    </div>
  )
}

/* ═══ Main: ProjectTaskPanel ═══ */
export default function ProjectTaskPanel({
  tree, milestones, tasks, selectedLeafId, rightMode, onModeChange,
  projectId, pkmId, color,
}) {
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)

  const [addingTaskMsId, setAddingTaskMsId] = useState(null)

  // 전체 할일: 트리의 모든 리프 + 직접 연결된 할일
  const allGroupedTasks = useMemo(() => {
    const groups = []
    const walk = (nodes, path, nodeColor) => {
      nodes.forEach(n => {
        const c = n.color || nodeColor
        const hasChildren = n.children && n.children.length > 0
        const currentPath = [...path, n.title]
        // 직접 연결된 할일 (하이브리드 노드 포함)
        const nodeTasks = tasks.filter(t => t.keyMilestoneId === n.id)
        if (nodeTasks.length > 0) {
          groups.push({
            msId: n.id,
            path: currentPath.join(' > '),
            color: c,
            tasks: nodeTasks,
          })
        }
        if (hasChildren) walk(n.children, currentPath, c)
      })
    }
    walk(tree, [], color?.dot || '#888')
    return groups
  }, [tree, tasks, color])

  const allTaskCount = useMemo(() => allGroupedTasks.reduce((sum, g) => sum + g.tasks.length, 0), [allGroupedTasks])

  // 선택된 리프의 할일
  const selectedTasks = useMemo(() => {
    if (!selectedLeafId) return []
    return tasks.filter(t => t.keyMilestoneId === selectedLeafId)
  }, [tasks, selectedLeafId])

  // 선택된 리프 정보
  const selectedMs = useMemo(() => {
    if (!selectedLeafId) return null
    return milestones.find(m => m.id === selectedLeafId)
  }, [milestones, selectedLeafId])

  const selectedPath = useMemo(() => {
    if (!selectedLeafId) return ''
    return getNodePath(selectedLeafId, milestones)
  }, [selectedLeafId, milestones])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 모드 토글 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderBottom: `0.5px solid ${S.border}`, background: '#fafaf8', flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: S.textSecondary }}>할일</span>
        <div style={{ display: 'flex', gap: 2, background: '#fff', borderRadius: 6, padding: 2, marginLeft: 8 }}>
          {['전체', '선택'].map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                border: 'none', borderRadius: 5, padding: '3px 12px', fontSize: 11,
                fontFamily: 'inherit', cursor: 'pointer',
                fontWeight: rightMode === m ? 600 : 400,
                background: rightMode === m ? '#f0efeb' : 'transparent',
                color: rightMode === m ? S.textPrimary : S.textTertiary,
              }}
            >
              {m === '전체' ? '전체 할일' : '선택 항목'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: S.textTertiary, marginLeft: 'auto' }}>
          {rightMode === '전체' ? `${allTaskCount}건` : selectedTasks.length > 0 ? `${selectedTasks.length}건` : ''}
        </span>
      </div>

      {/* 할일 목록 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rightMode === '전체' ? (
          /* ─── 전체 할일 모드 ─── */
          allGroupedTasks.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: S.textTertiary, fontSize: 12 }}>
              할일이 없습니다
            </div>
          ) : (
            allGroupedTasks.map((group, gi) => (
              <div key={group.msId}>
                {/* 그룹 헤더 */}
                <div style={{
                  padding: '8px 14px 4px',
                  fontSize: 11, fontWeight: 600, color: group.color,
                  display: 'flex', alignItems: 'center', gap: 5,
                  borderTop: gi > 0 ? `0.5px solid ${S.border}` : 'none',
                  background: `${group.color}06`,
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                  <span>{group.path}</span>
                </div>
                {/* 할일 행 */}
                {group.tasks.map(t => (
                  <TaskRow key={t.id} task={t} color={group.color} onToggle={toggleDone} onOpen={openDetail} />
                ))}
                {/* 인라인 추가 */}
                {addingTaskMsId === group.msId ? (
                  <InlineAddTask msId={group.msId} projectId={projectId} onDone={() => setAddingTaskMsId(null)} />
                ) : (
                  <div style={{ padding: '4px 14px 4px 28px' }}>
                    <span
                      onClick={() => setAddingTaskMsId(group.msId)}
                      style={{ fontSize: 11, color: S.textTertiary, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.color = S.textPrimary}
                      onMouseLeave={e => e.currentTarget.style.color = S.textTertiary}
                    >
                      + 할일 추가
                    </span>
                  </div>
                )}
              </div>
            ))
          )
        ) : (
          /* ─── 선택 항목 모드 ─── */
          !selectedLeafId ? (
            <div style={{ padding: 24, textAlign: 'center', color: S.textTertiary, fontSize: 12, fontStyle: 'italic' }}>
              ← 왼쪽 트리에서 항목을 선택하세요
            </div>
          ) : (
            <div>
              {/* 선택된 리프 헤더 */}
              <div style={{
                padding: '10px 14px', borderBottom: `0.5px solid ${S.border}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: selectedMs?.color || color?.dot, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary }}>{selectedPath}</span>
                {selectedTasks.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                    <div style={{ width: 36, height: 3, borderRadius: 2, background: '#e8e6df' }}>
                      <div style={{
                        width: `${selectedTasks.filter(t => t.done).length / selectedTasks.length * 100}%`,
                        height: 3, borderRadius: 2, background: selectedMs?.color || color?.dot,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: S.textTertiary }}>
                      {selectedTasks.filter(t => t.done).length}/{selectedTasks.length}
                    </span>
                  </div>
                )}
              </div>

              {/* 할일 목록 */}
              {selectedTasks.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: S.textTertiary, marginBottom: 6 }}>연결된 할일이 없습니다</div>
                  <div style={{ fontSize: 11, color: S.textTertiary }}>아래에서 추가하세요</div>
                </div>
              ) : (
                selectedTasks.map(t => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    color={selectedMs?.color || color?.dot}
                    onToggle={toggleDone}
                    onOpen={openDetail}
                  />
                ))
              )}

              {/* 인라인 추가 */}
              {addingTaskMsId === selectedLeafId ? (
                <InlineAddTask msId={selectedLeafId} projectId={projectId} onDone={() => setAddingTaskMsId(null)} />
              ) : (
                <div style={{ padding: '8px 14px' }}>
                  <span
                    onClick={() => setAddingTaskMsId(selectedLeafId)}
                    style={{ fontSize: 11, color: S.textTertiary, cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = S.textPrimary}
                    onMouseLeave={e => e.currentTarget.style.color = S.textTertiary}
                  >
                    + 할일 추가
                  </span>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {/* 백로그 영역 */}
      <BacklogSection tasks={tasks} projectId={projectId} onToggle={toggleDone} onOpen={openDetail} />
    </div>
  )
}

/* ═══ 백로그: MS 미연결 할일 ═══ */
function BacklogSection({ tasks, projectId, onToggle, onOpen }) {
  const [open, setOpen] = useState(false)
  const backlogTasks = useMemo(() => {
    return tasks.filter(t => t.projectId === projectId && !t.keyMilestoneId && !t.deletedAt)
  }, [tasks, projectId])

  if (backlogTasks.length === 0) return null

  return (
    <div style={{ borderTop: `1.5px dashed ${S.border}`, flexShrink: 0 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 12, color: S.textTertiary }}>⊙</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: S.textTertiary }}>백로그</span>
        <span style={{ fontSize: 11, color: S.textTertiary }}>{backlogTasks.length}건</span>
        <span style={{ fontSize: 9, color: S.textTertiary, marginLeft: 'auto' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && backlogTasks.map(t => (
        <TaskRow key={t.id} task={t} color="#a09f99" onToggle={onToggle} onOpen={onOpen} />
      ))}
    </div>
  )
}
