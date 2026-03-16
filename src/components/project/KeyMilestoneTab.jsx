import { useState, useRef, useEffect, useMemo } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectKeyMilestone } from '../../hooks/useProjectKeyMilestone'
import { useKeyMilestones } from '../../hooks/useKeyMilestones'
import { useKeyDeliverables } from '../../hooks/useKeyDeliverables'
import { useKeyLinks } from '../../hooks/useKeyLinks'
import { useKeyPolicies } from '../../hooks/useKeyPolicies'
import useStore from '../../hooks/useStore'
import { CheckIcon } from '../shared/Icons'

// ─── 유틸 ───
function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

// ─── 메인 컴포넌트 ───
export default function KeyMilestoneTab({ projectId }) {
  const { pkm, loading } = useProjectKeyMilestone(projectId)

  if (loading) return <KmSkeleton />
  if (!pkm) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <MilestoneRows pkmId={pkm.id} projectId={projectId} />
      </div>
      <div style={{ borderTop: '0.5px solid #e8e6df', flexShrink: 0, background: '#fafaf8' }}>
        <CollapsibleSection icon="🔗" title="참조 문서" pkmId={pkm.id} projectId={projectId} type="links" />
        <CollapsibleSection icon="✓" title="합의된 정책" pkmId={pkm.id} projectId={projectId} type="policies" />
      </div>
    </div>
  )
}

function KmSkeleton() {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center' }}>
      <div style={{ fontSize: 13 }}>Key Milestone 로딩 중...</div>
    </div>
  )
}

// ─── 마일스톤 행들 (DnD 순서 변경 지원) ───
function MilestoneRows({ pkmId, projectId }) {
  const { milestones, add, update, remove, reorder } = useKeyMilestones(pkmId, projectId)
  const deliverableHook = useKeyDeliverables(pkmId, projectId)
  const allTasks = useStore(s => s.tasks)
  const [leftWidth, setLeftWidth] = useState(50) // 좌측 패널 비율 (%)

  const tasks = useMemo(() =>
    allTasks.filter(t => t.projectId === projectId && !t.deletedAt),
    [allTasks, projectId]
  )

  const handleMilestoneDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = milestones.findIndex(m => m.id === active.id)
    const newIndex = milestones.findIndex(m => m.id === over.id)
    const reordered = arrayMove(milestones, oldIndex, newIndex)
    reorder(reordered.map((m, i) => ({ ...m, sort_order: i })))
  }

  return (
    <>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleMilestoneDragEnd}>
        <SortableContext items={milestones.map(m => m.id)} strategy={verticalListSortingStrategy}>
          {milestones.map(m => (
            <SortableMilestoneRow
              key={m.id}
              milestone={m}
              deliverables={deliverableHook.getByMilestone(m.id)}
              tasks={tasks}
              onUpdateMilestone={update}
              onDeleteMilestone={remove}
              onAddDeliverable={deliverableHook.add}
              onUpdateDeliverable={deliverableHook.update}
              onDeleteDeliverable={deliverableHook.remove}
              projectId={projectId}
              leftWidth={leftWidth}
              setLeftWidth={setLeftWidth}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div style={{ padding: '10px 20px', borderTop: milestones.length > 0 ? '0.5px solid #eeedea' : 'none' }}>
        <AddButton label="+ 마일스톤 추가" onClick={add} />
      </div>

      {milestones.length === 0 && (
        <div style={{ padding: '40px 22px', color: '#b4b2a9', textAlign: 'center', fontSize: 14 }}>
          마일스톤을 추가하여 프로젝트 일정을 관리하세요
        </div>
      )}
    </>
  )
}

// ─── Sortable 마일스톤 행 래퍼 ───
function SortableMilestoneRow(props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.milestone.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <MilestoneRow {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

// ─── 마일스톤 행 (좌: 마일스톤+결과물 | 우: Task) ───
function MilestoneRow({
  milestone, deliverables, tasks, projectId,
  onUpdateMilestone, onDeleteMilestone,
  onAddDeliverable, onUpdateDeliverable, onDeleteDeliverable,
  leftWidth, setLeftWidth, dragHandleProps,
}) {
  const [hovered, setHovered] = useState(false)
  const rowRef = useRef(null)

  // 이 마일스톤에 연결된 Task (keyMilestoneId 사용)
  const milestoneTasks = useMemo(() => {
    return tasks.filter(t => t.keyMilestoneId === milestone.id)
  }, [tasks, milestone.id])

  const handleDrag = (e) => {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = Math.min(Math.max((x / rect.width) * 100, 25), 75) // 25% ~ 75% 제한
    setLeftWidth(percent)
  }

  const handleMouseDown = (e) => {
    e.preventDefault()
    const onMouseMove = (ev) => handleDrag(ev)
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', borderBottom: '0.5px solid #eeedea', minHeight: 60, position: 'relative' }}
    >
      {/* 좌측: 마일스톤 + 결과물 */}
      <div style={{ width: `${leftWidth}%`, flexShrink: 0, padding: '14px 20px 12px' }}>
        <MilestoneHeader
          milestone={milestone}
          onUpdate={onUpdateMilestone}
          onDelete={onDeleteMilestone}
          hovered={hovered}
          dragHandleProps={dragHandleProps}
        />
        <DeliverableArea
          deliverables={deliverables}
          milestoneId={milestone.id}
          onAdd={onAddDeliverable}
          onUpdate={onUpdateDeliverable}
          onDelete={onDeleteDeliverable}
        />
      </div>

      {/* 리사이즈 핸들 */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: 5, cursor: 'col-resize', flexShrink: 0,
          background: 'transparent', position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 1, height: '100%', background: '#eeedea',
          transition: 'background .15s',
        }} />
      </div>

      {/* 우측: Task 목록 */}
      <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <TaskPanel
          tasks={milestoneTasks}
          milestoneId={milestone.id}
          projectId={projectId}
        />
      </div>
    </div>
  )
}

// ─── 마일스톤 헤더 ───
function MilestoneHeader({ milestone, onUpdate, onDelete, hovered, dragHandleProps }) {
  const [editingTitle, setEditingTitle] = useState(!milestone.title)
  const [title, setTitle] = useState(milestone.title || '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [description, setDescription] = useState(milestone.description || '')
  const titleRef = useRef(null)

  useEffect(() => {
    if (editingTitle && titleRef.current) titleRef.current.focus()
  }, [editingTitle])

  const handleTitleBlur = () => {
    if (!title.trim()) {
      if (!milestone.title) { onDelete(milestone.id); return }
      setTitle(milestone.title)
    } else if (title !== milestone.title) {
      onUpdate(milestone.id, { title })
    }
    setEditingTitle(false)
  }

  const handleDescBlur = () => {
    if (description !== milestone.description) {
      onUpdate(milestone.id, { description })
    }
    setEditingDesc(false)
  }

  const handleDateChange = (field, value) => {
    onUpdate(milestone.id, { [field]: value || null })
  }

  const daysLeft = daysUntil(milestone.end_date)
  const isUrgent = daysLeft !== null && daysLeft <= 7 && daysLeft >= 0

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {/* 드래그 핸들 */}
      <div
        {...dragHandleProps}
        style={{
          cursor: 'grab', color: '#9a9892', fontSize: 12, flexShrink: 0, marginTop: 3,
          opacity: hovered ? 1 : 0.5, transition: 'opacity .1s',
        }}
      >
        ⠿
      </div>
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: milestone.color || '#1D9E75', marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 제목 */}
        {editingTitle ? (
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTitle(milestone.title || ''); setEditingTitle(false) } }}
            placeholder="마일스톤 제목..."
            style={{ fontSize: 15, fontWeight: 600, border: 'none', outline: 'none', width: '100%', background: 'transparent', color: '#2C2C2A' }}
          />
        ) : (
          <div onClick={() => setEditingTitle(true)} style={{ fontSize: 15, fontWeight: 600, cursor: 'text', color: '#2C2C2A' }}>
            {milestone.title || <span style={{ color: '#b4b2a9' }}>마일스톤 제목...</span>}
          </div>
        )}

        {/* 설명 */}
        {editingDesc ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescBlur}
            onKeyDown={e => { if (e.key === 'Escape') { setDescription(milestone.description || ''); setEditingDesc(false) } }}
            autoFocus
            placeholder="설명..."
            style={{ fontSize: 12, border: 'none', outline: 'none', width: '100%', background: 'transparent', color: '#a09f99', resize: 'none', marginTop: 2, minHeight: 32 }}
          />
        ) : (
          <div onClick={() => setEditingDesc(true)} style={{ fontSize: 12, color: '#a09f99', cursor: 'text', marginTop: 2 }}>
            {milestone.description || <span style={{ color: '#b4b2a9' }}>설명 추가...</span>}
          </div>
        )}

        {/* 날짜 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 12, color: '#6b6a66' }}>
          <DateBadge
            value={milestone.start_date}
            onChange={v => handleDateChange('start_date', v)}
            urgent={isUrgent}
          />
          <span style={{ color: '#c2c0b6', fontSize: 11 }}>→</span>
          <DateBadge
            value={milestone.end_date}
            onChange={v => handleDateChange('end_date', v)}
            urgent={isUrgent}
          />
          {daysLeft !== null && (
            <span style={{ fontSize: 11, fontWeight: 500, color: isUrgent ? '#BA7517' : '#b4b2a9', marginLeft: 2 }}>
              D{daysLeft >= 0 ? `-${daysLeft}` : `+${Math.abs(daysLeft)}`}
            </span>
          )}
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={() => onDelete(milestone.id)}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 12, color: '#c2c0b6', padding: 0, width: 20, height: 20,
          borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity .12s, background .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fce8e8'; e.currentTarget.style.color = '#c53030' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c2c0b6' }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── 날짜 배지 ───
function DateBadge({ value, onChange, urgent }) {
  const inputRef = useRef(null)

  return (
    <span
      onClick={() => inputRef.current?.showPicker?.() || inputRef.current?.click()}
      style={{
        padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
        background: urgent ? '#FAEEDA' : '#f5f4f0',
        color: urgent ? '#854F0B' : '#6b6a66',
        fontWeight: urgent ? 500 : 400,
        border: '0.5px solid transparent',
        transition: 'all .1s',
        position: 'relative',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#d3d1c7'; e.currentTarget.style.background = urgent ? '#FAEEDA' : '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = urgent ? '#FAEEDA' : '#f5f4f0' }}
    >
      {value ? formatDate(value) : '날짜 선택'}
      <input
        ref={inputRef}
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
      />
    </span>
  )
}

// ─── 결과물 영역 ───
function DeliverableArea({ deliverables, milestoneId, onAdd, onUpdate, onDelete }) {
  return (
    <div style={{ marginTop: 10, paddingLeft: 17 }}>
      {deliverables.map((d, idx) => (
        <DeliverableLine
          key={d.id}
          deliverable={d}
          index={idx + 1}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
      <AddButton label="+ 결과물 추가" onClick={() => onAdd(milestoneId)} small />
    </div>
  )
}

// ─── 상태 태그 설정 ───
const STATUS_CYCLE = [null, '진행중', '완료', '대기']
const STATUS_STYLES = {
  '진행중': { bg: '#FAEEDA', color: '#854F0B' },
  '완료': { bg: '#EAF3DE', color: '#3B6D11' },
  '대기': { bg: '#f0efe8', color: '#6b6a66' },
}

// ─── 결과물 1줄 항목 ───
function DeliverableLine({ deliverable, index, onUpdate, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [editingTitle, setEditingTitle] = useState(!deliverable.title)
  const [title, setTitle] = useState(deliverable.title || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (editingTitle && inputRef.current) inputRef.current.focus()
  }, [editingTitle])

  const handleBlur = () => {
    if (!title.trim()) {
      if (!deliverable.title) { onDelete(deliverable.id); return }
      setTitle(deliverable.title)
    } else if (title !== deliverable.title) {
      onUpdate(deliverable.id, { title })
    }
    setEditingTitle(false)
  }

  const cycleStatus = () => {
    const currentIndex = STATUS_CYCLE.indexOf(deliverable.tag_label || null)
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length
    const nextStatus = STATUS_CYCLE[nextIndex]
    const style = nextStatus ? STATUS_STYLES[nextStatus] : null
    onUpdate(deliverable.id, {
      tag_label: nextStatus,
      tag_bg: style?.bg || null,
      tag_text_color: style?.color || null,
    })
  }

  const statusStyle = deliverable.tag_label ? STATUS_STYLES[deliverable.tag_label] : null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}
    >
      <span style={{ fontSize: 11, color: '#b4b2a9', fontWeight: 600, minWidth: 14 }}>{index}</span>
      {editingTitle ? (
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTitle(deliverable.title || ''); setEditingTitle(false) } }}
          placeholder="결과물 제목..."
          style={{ flex: 1, fontSize: 13, border: 'none', outline: 'none', background: 'transparent', color: '#2C2C2A' }}
        />
      ) : (
        <span onClick={() => setEditingTitle(true)} style={{ flex: 1, fontSize: 13, color: '#2C2C2A', cursor: 'text' }}>
          {deliverable.title || <span style={{ color: '#b4b2a9' }}>결과물 제목...</span>}
        </span>
      )}
      {/* 상태 태그 또는 + 상태 버튼 */}
      {deliverable.tag_label ? (
        <span
          onClick={cycleStatus}
          style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500, flexShrink: 0,
            background: statusStyle?.bg || '#f0efe8',
            color: statusStyle?.color || '#a09f99',
            cursor: 'pointer', transition: 'opacity .1s',
          }}
        >
          {deliverable.tag_label}
        </span>
      ) : (
        <span
          onClick={cycleStatus}
          style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500, flexShrink: 0,
            background: '#f5f4f0', color: '#b4b2a9', cursor: 'pointer',
            opacity: hovered ? 1 : 0, transition: 'opacity .12s',
          }}
        >
          + 상태
        </span>
      )}
      <button
        onClick={() => onDelete(deliverable.id)}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 12, color: '#c2c0b6', padding: 0, width: 20, height: 20,
          borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0, transition: 'opacity .12s, background .12s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#fce8e8'; e.currentTarget.style.color = '#c53030' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c2c0b6' }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Task 패널 (우측) ───
function TaskPanel({ tasks: rawTasks, milestoneId, projectId }) {
  const { addTask, updateTask, deleteTask, toggleDone, openDetail, reorderTasks } = useStore()

  // sort_order 기준 정렬
  const tasks = useMemo(() =>
    [...rawTasks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [rawTasks]
  )

  // + Task 추가 클릭 시: 빈 Task 생성 후 상세패널 열기
  const handleAddTask = () => {
    const taskId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()
    addTask({
      id: taskId,
      text: '',
      projectId,
      keyMilestoneId: milestoneId,
      category: 'today',
      sortOrder: Date.now(),
    })
    // 상세패널 자동 열기
    setTimeout(() => {
      const created = useStore.getState().tasks.find(t => t.id === taskId)
      if (created) openDetail(created)
    }, 50)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)

    // sort_order 업데이트
    reorderTasks(reordered.map((t, i) => ({ ...t, sortOrder: i })))
  }

  if (tasks.length === 0) {
    return (
      <>
        <div style={{ fontSize: 12, color: '#BA7517', padding: '3px 4px' }}>Task 없음</div>
        <AddButton label="+ Task 추가" onClick={handleAddTask} small />
      </>
    )
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {tasks.map(t => (
          <SortableTaskRow
            key={t.id}
            task={t}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onToggleDone={toggleDone}
          />
        ))}
      </SortableContext>
      <AddButton label="+ Task 추가" onClick={handleAddTask} small />
    </DndContext>
  )
}

// ─── Sortable Task 행 (TodayView 패턴 적용) ───
function SortableTaskRow({ task, onUpdate, onDelete, onToggleDone }) {
  const { openDetail } = useStore()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const [hovered, setHovered] = useState(false)
  const [text, setText] = useState(task.text)
  const isDone = task.category === 'done'

  useEffect(() => { setText(task.text) }, [task.text])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleSave = () => {
    const trimmed = text.trim()
    if (trimmed && trimmed !== task.text) {
      onUpdate(task.id, { text: trimmed })
    }
    if (!trimmed) setText(task.text)
  }

  const handleKeyDown = (e) => {
    // Enter: 저장
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
      e.target.blur()
    }
    // Backspace on empty: 삭제
    if (e.key === 'Backspace' && text === '') {
      e.preventDefault()
      onDelete(task.id)
    }
    // Escape: 취소
    if (e.key === 'Escape') {
      setText(task.text)
      e.target.blur()
    }
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
          borderRadius: 6, transition: 'background .1s', position: 'relative',
          background: isDragging ? 'rgba(0,0,0,0.02)' : hovered ? '#f5f4f0' : 'transparent',
        }}
      >
        {/* 드래그 핸들 */}
        <div
          {...listeners}
          {...attributes}
          style={{
            cursor: 'grab', color: '#9a9892', fontSize: 11, flexShrink: 0,
            opacity: hovered ? 1 : 0.5, transition: 'opacity .1s',
          }}
        >
          ⠿
        </div>
        {/* 체크박스 (TodayView CheckIcon 사용) */}
        <div onClick={e => { e.stopPropagation(); onToggleDone(task.id) }} style={{ paddingTop: 1, flexShrink: 0, cursor: 'pointer' }}>
          <CheckIcon checked={isDone} />
        </div>
        {/* 제목 input (항상 편집 가능) */}
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1, fontSize: 13, border: 'none', outline: 'none',
            background: 'transparent', color: isDone ? '#b4b2a9' : '#37352f',
            textDecoration: isDone ? 'line-through' : 'none',
            fontFamily: 'inherit', padding: '2px 0', lineHeight: '19px',
          }}
          placeholder="할일 입력..."
        />
        {/* 상세보기 버튼 (호버 시 표시) */}
        <button
          onClick={e => { e.stopPropagation(); openDetail(task) }}
          style={{
            position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
            opacity: hovered ? 1 : 0, transition: 'opacity 0.15s',
            width: 22, height: 22, borderRadius: 4, background: 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#999', cursor: 'pointer', border: 'none', padding: 0, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = '#555' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = '#999' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
    </div>
  )
}

// ─── 하단 접힌 섹션 ───
function CollapsibleSection({ icon, title, pkmId, projectId, type }) {
  const [open, setOpen] = useState(false)
  const linksHook = useKeyLinks(pkmId, projectId)
  const policiesHook = useKeyPolicies(pkmId, projectId)
  const hookResult = type === 'links' ? linksHook : policiesHook
  const { items, add, update, remove } = hookResult

  return (
    <>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 20px', cursor: 'pointer', userSelect: 'none',
          borderBottom: open ? '0.5px solid #e8e6df' : 'none',
        }}
      >
        <span style={{ fontSize: 10, color: '#a09f99', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>▸</span>
        <span style={{ fontSize: 12, color: '#a09f99', fontWeight: 500 }}>{icon} {title}</span>
        <span style={{ fontSize: 10, background: '#eeedea', borderRadius: 999, padding: '0 5px', color: '#b4b2a9' }}>{items.length}</span>
      </div>
      {open && (
        <div style={{ padding: '0 20px 10px 36px' }}>
          {items.map(item => type === 'links'
            ? <LinkItem key={item.id} item={item} onUpdate={update} onDelete={remove} />
            : <PolicyItem key={item.id} item={item} onUpdate={update} onDelete={remove} />
          )}
          <AddButton label="+ 추가" onClick={add} small />
        </div>
      )}
    </>
  )
}

// ─── 참조 문서 항목 ───
function LinkItem({ item, onUpdate, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [title, setTitle] = useState(item.title || '')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', cursor: 'pointer' }}
    >
      <span style={{ color: '#378ADD', fontSize: 12, marginTop: 1, flexShrink: 0 }}>↗</span>
      <div style={{ flex: 1 }}>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title !== item.title) onUpdate(item.id, { title }) }}
          placeholder="문서 제목..."
          style={{ fontSize: 12, color: '#378ADD', border: 'none', outline: 'none', background: 'transparent', width: '100%' }}
        />
        {item.description && <div style={{ fontSize: 11, color: '#b4b2a9' }}>{item.description}</div>}
      </div>
      <button
        onClick={() => onDelete(item.id)}
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 12, color: '#c2c0b6', padding: 0, width: 20, height: 20,
          opacity: hovered ? 1 : 0, transition: 'opacity .12s', flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── 합의된 정책 항목 ───
function PolicyItem({ item, onUpdate, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [title, setTitle] = useState(item.title || '')

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: '4px 0' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {item.tag_label && (
          <span style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3, fontWeight: 500,
            background: item.tag_type === 'external' ? '#E6F1FB' : '#EAF3DE',
            color: item.tag_type === 'external' ? '#185FA5' : '#3B6D11',
          }}>
            {item.tag_label}
          </span>
        )}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={() => { if (title !== item.title) onUpdate(item.id, { title }) }}
          placeholder="정책 제목..."
          style={{ flex: 1, fontSize: 12, border: 'none', outline: 'none', background: 'transparent', color: '#2C2C2A' }}
        />
        <button
          onClick={() => onDelete(item.id)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 12, color: '#c2c0b6', padding: 0, width: 20, height: 20,
            opacity: hovered ? 1 : 0, transition: 'opacity .12s', flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
      {item.description && <div style={{ fontSize: 11, color: '#a09f99', marginTop: 1, marginLeft: item.tag_label ? 0 : 0 }}>{item.description}</div>}
    </div>
  )
}

// ─── 추가 버튼 ───
function AddButton({ label, onClick, small }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontSize: small ? 12 : 13, color: hovered ? '#6b6a66' : '#b4b2a9',
        padding: small ? '3px 0' : '6px 0', textAlign: 'left',
        transition: 'color .12s', display: 'flex', alignItems: 'center', gap: 3,
      }}
    >
      {label}
    </button>
  )
}
