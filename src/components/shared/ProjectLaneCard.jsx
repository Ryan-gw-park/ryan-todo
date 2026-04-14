import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { COLOR, FONT, CHECKBOX } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { computeMilestoneCount } from '../../utils/milestoneProgress'
import InlineAdd from './InlineAdd'
import MiniAvatar from '../views/grid/shared/MiniAvatar'
import MilestoneRow from '../views/grid/cells/MilestoneRow'
import TaskAssigneeChip from '../project/TaskAssigneeChip'
import StackedAvatar from './StackedAvatar'
import DualAssigneeSelector from './DualAssigneeSelector'

/* ═══ Helpers ═══ */
function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function getMemberInfo(userId, members, memberColorMap) {
  if (!userId) return null
  const m = (members || []).find(mem => mem.userId === userId)
  const color = (memberColorMap && memberColorMap[userId]) ? memberColorMap[userId].dot : '#888'
  return m ? { name: m.displayName || '?', color, userId } : { name: '?', color: '#888', userId }
}

/* ═══ ProjectLaneCard — 공용 프로젝트 카드 (12f) ═══ */
export default function ProjectLaneCard({
  project, tasks, milestones, members, memberColorMap,
  mode, groupBy, filter, truncate, expanded, onToggleExpand,
  collapsed, onToggleCollapse, dragHandleProps,
}) {
  // Store 직접 접근 (I1)
  const updateTask = useStore(s => s.updateTask)
  const addTask = useStore(s => s.addTask)
  const toggleDone = useStore(s => s.toggleDone)
  const openDetail = useStore(s => s.openDetail)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const storeToggleCollapse = useStore(s => s.toggleCollapse)
  const openModal = useStore(s => s.openModal)
  const allTasks = useStore(s => s.tasks)
  const allMilestones = useStore(s => s.milestones)
  const collapseState = useStore(s => s.collapseState)

  // MS 편집 — 카드 내부 local state (W1)
  const [editingMsId, setEditingMsId] = useState(null)
  // Task 편집 — 카드 내부 local state
  const [editingId, setEditingId] = useState(null)

  const handleEditFinish = useCallback((taskId, value) => {
    setEditingId(null)
    if (value && value.trim()) updateTask(taskId, { text: value.trim() })
  }, [updateTask])

  const handleMsEditFinish = useCallback((msId, value) => {
    setEditingMsId(null)
    if (value !== null && value !== undefined && value.trim()) {
      useStore.getState().updateMilestone(msId, { title: value.trim() })
    }
  }, [])

  const c = getColor(project.color)
  const isTruncated = truncate !== null && truncate !== undefined
  const isCol = collapsed

  // 잘라내기 — scrollHeight 측정 (I2)
  const cardRef = useRef(null)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    if (!isTruncated || expanded) { setIsOverflowing(false); return }
    const el = cardRef.current
    if (!el) return
    // 다음 프레임에서 측정 (렌더 완료 후)
    requestAnimationFrame(() => {
      setIsOverflowing(el.scrollHeight > el.clientHeight)
    })
  }, [tasks, milestones, expanded, filter, groupBy, isTruncated])

  const cardMaxHeight = isTruncated && !expanded ? 'min(600px, 70vh)' : 'none'

  // 프로젝트 tasks (이미 필터된 상태로 전달됨)
  const projTasks = tasks
  const projActiveCount = projTasks.filter(t => !t.done).length
  const projMs = (milestones || []).filter(m => m.project_id === project.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // 참여자 칩 (team/project 모드만)
  const memberCounts = useMemo(() => {
    if (mode === 'personal') return []
    const counts = {}
    projTasks.forEach(t => {
      const key = t.assigneeId || '__unassigned__'
      counts[key] = (counts[key] || 0) + 1
    })
    const unassignedCount = counts['__unassigned__'] || 0
    delete counts['__unassigned__']
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([uid, cnt]) => ({ userId: uid, count: cnt }))
    if (unassignedCount > 0) sorted.push({ userId: '__unassigned__', count: unassignedCount })
    return sorted
  }, [projTasks, mode])

  // MS collapse key (팀: teamMatrixMs, 개인: matrixMs, 프로젝트: matrixMs)
  const msCollapseKey = mode === 'team' ? 'teamMatrixMs' : 'matrixMs'
  const msCollapsed = collapseState[msCollapseKey] || {}
  const toggleMsCollapse = useCallback((msId) => storeToggleCollapse(msCollapseKey, msId), [storeToggleCollapse, msCollapseKey])

  // showAssigneeBadge: team과 project에서만
  const showAssignee = mode !== 'personal'

  return (
    <div style={{
      background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
      marginBottom: expanded ? 0 : 12, overflow: 'hidden', position: 'relative',
    }}>
      {/* Lane 헤더 */}
      <div
        {...(dragHandleProps || {})}
        onClick={onToggleCollapse}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', cursor: dragHandleProps ? 'grab' : 'pointer',
          background: COLOR.bgSurface,
          borderBottom: isCol ? 'none' : `1px solid ${COLOR.border}`,
        }}
      >
        <span style={{
          fontSize: 10, color: COLOR.textSecondary, width: 10,
          display: 'inline-block', textAlign: 'center',
          transform: isCol ? 'rotate(-90deg)' : 'rotate(0)',
          transition: 'transform 0.15s',
        }}>▾</span>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: c.dot, flexShrink: 0 }} />
        <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{project.name}</span>
        <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projActiveCount}건</span>
        <div style={{ flex: 1 }} />
        {/* 참여자 칩 */}
        {memberCounts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {memberCounts.map(mc => {
              const isUnassigned = mc.userId === '__unassigned__'
              const mem = !isUnassigned ? (members || []).find(m => m.userId === mc.userId) : null
              const mColor = !isUnassigned && memberColorMap?.[mc.userId] ? memberColorMap[mc.userId].dot : '#bbb'
              return (
                <div key={mc.userId} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MiniAvatar name={isUnassigned ? '?' : (mem?.displayName || '?')} size={16} color={isUnassigned ? '#bbb' : mColor} />
                  <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{mc.count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lane 본문 (잘라내기 적용) */}
      {!isCol && (
        <div
          ref={cardRef}
          style={{
            padding: '8px 14px',
            maxHeight: cardMaxHeight,
            overflow: 'hidden',
            position: 'relative',
            transition: 'max-height 0.2s ease',
          }}
        >
          {groupBy === 'owner' ? (
            <OwnerGroupView
              projTasks={projTasks} projMs={projMs} milestones={allMilestones}
              members={members || []} memberColorMap={memberColorMap || {}}
              proj={project} c={c} allTasks={allTasks}
              editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
              toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
              addTask={addTask} showAssignee={showAssignee}
            />
          ) : (
            <MsGroupView
              projTasks={projTasks} projMs={projMs} milestones={allMilestones}
              members={members || []} memberColorMap={memberColorMap || {}}
              proj={project} c={c} allTasks={allTasks}
              msCollapsed={msCollapsed} toggleMsCollapse={toggleMsCollapse}
              editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
              editingMsId={editingMsId} onStartMsEdit={setEditingMsId}
              handleMsEditFinish={handleMsEditFinish} cancelMsEdit={() => setEditingMsId(null)}
              handleMsDelete={(msId, title) => {
                const confirm = window.confirm(`"${title || '제목 없음'}"을(를) 삭제하시겠습니까?`)
                if (confirm) useStore.getState().deleteMilestone(msId)
              }}
              toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
              addTask={addTask} addMilestoneInProject={addMilestoneInProject}
              openModal={openModal} showAssignee={showAssignee}
              truncate={truncate} expanded={expanded}
            />
          )}

          {/* Overflow indicator (gradient + 더 보기) */}
          {isOverflowing && !expanded && (
            <>
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 50,
                background: 'linear-gradient(to bottom, transparent, #fff)',
                pointerEvents: 'none',
              }} />
              <div onClick={e => { e.stopPropagation(); onToggleExpand?.() }} style={{
                position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
                fontSize: 11, padding: '4px 12px', background: '#f0efe8', borderRadius: 12,
                cursor: 'pointer', zIndex: 1,
              }}>+ 더 보기</div>
            </>
          )}
        </div>
      )}

      {/* 접기 버튼 (확장 상태) */}
      {expanded && onToggleExpand && isTruncated && (
        <div style={{ textAlign: 'center', padding: '6px 0', borderTop: `1px solid ${COLOR.border}` }}>
          <button onClick={e => { e.stopPropagation(); onToggleExpand() }} style={{
            fontSize: 11, padding: '2px 12px', background: '#f0efe8', borderRadius: 6,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: COLOR.textSecondary,
          }}>접기 ▲</button>
        </div>
      )}
    </div>
  )
}

/* ═══ C안: MS 그룹 뷰 ═══ */
function MsGroupView({
  projTasks, projMs, milestones, members, memberColorMap, proj, c, allTasks,
  msCollapsed, toggleMsCollapse,
  editingId, setEditingId, handleEditFinish,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit, handleMsDelete,
  toggleDone, openDetail, updateTask, addTask, addMilestoneInProject, openModal,
  showAssignee, truncate, expanded,
}) {
  const [addingMsMode, setAddingMsMode] = useState(false)
  const [newMsTitle, setNewMsTitle] = useState('')

  const msGroups = useMemo(() => {
    const groups = []
    projMs.forEach(ms => {
      const msTasks = projTasks.filter(t => t.keyMilestoneId === ms.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
      groups.push({ ms, tasks: msTasks })
    })
    return groups
  }, [projMs, projTasks])

  const ungroupedTasks = useMemo(() =>
    projTasks.filter(t => !t.keyMilestoneId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [projTasks]
  )

  const handleAddMs = async () => {
    if (!newMsTitle.trim()) { setAddingMsMode(false); return }
    await addMilestoneInProject(proj.id, { title: newMsTitle.trim() })
    setNewMsTitle('')
    setAddingMsMode(false)
  }

  const tasksPerGroup = truncate?.tasksPerGroup || Infinity
  const shouldSlice = truncate && !expanded

  return (
    <>
      {msGroups.map(g => {
        const isMsCol = !!msCollapsed[g.ms.id]
        const cnt = computeMilestoneCount(g.ms.id, allTasks)
        const displayTasks = shouldSlice ? g.tasks.slice(0, tasksPerGroup) : g.tasks
        const hiddenTaskCount = g.tasks.length - displayTasks.length
        return (
          <div key={g.ms.id} style={{ marginBottom: 6 }}>
            <MilestoneRow
              ms={g.ms} taskCount={g.tasks.length}
              aliveCount={cnt.alive} totalCount={cnt.total}
              accentColor={c.dot} isEmpty={g.tasks.length === 0}
              collapsed={isMsCol}
              onToggleCollapse={() => toggleMsCollapse(g.ms.id)}
              isEditing={editingMsId === g.ms.id}
              onStartEdit={() => onStartMsEdit && onStartMsEdit(g.ms.id)}
              onFinishEdit={(value) => handleMsEditFinish && handleMsEditFinish(g.ms.id, value)}
              onCancelEdit={() => cancelMsEdit && cancelMsEdit()}
              onDelete={() => handleMsDelete && handleMsDelete(g.ms.id, g.ms.title)}
              onOpenDetail={() => openModal({ type: 'milestoneDetail', milestoneId: g.ms.id, returnTo: null })}
              interactive
              ownerInfo={g.ms.owner_id ? {
                primary: getMemberInfo(g.ms.owner_id, members, memberColorMap),
                secondary: g.ms.secondary_owner_id ? getMemberInfo(g.ms.secondary_owner_id, members, memberColorMap) : null,
              } : null}
            />
            {!isMsCol && (
              <div style={{ paddingLeft: 22 }}>
                {displayTasks.map(t => (
                  <CardTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
                    editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                    toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                    showAssignee={showAssignee} />
                ))}
                {hiddenTaskCount > 0 && (
                  <div style={{ fontSize: 11, color: COLOR.textTertiary, padding: '2px 0 4px', cursor: 'default' }}>+ {hiddenTaskCount}개 더</div>
                )}
                <InlineAdd projectId={proj.id} category="today" color={c}
                  extraFields={{ keyMilestoneId: g.ms.id, scope: 'team' }} compact />
              </div>
            )}
          </div>
        )
      })}

      {/* Dashed + 마일스톤 추가 */}
      {addingMsMode ? (
        <div style={{ margin: '6px 0', padding: '4px 0' }}>
          <input autoFocus value={newMsTitle}
            onChange={e => setNewMsTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAddMs(); if (e.key === 'Escape') setAddingMsMode(false) }}
            onBlur={handleAddMs}
            placeholder="마일스톤 이름..."
            style={{ width: '100%', fontSize: 12, border: `1px solid ${COLOR.border}`, borderRadius: 6, padding: '6px 10px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      ) : (
        <DashedSlot label="+ 마일스톤 추가" onClick={() => setAddingMsMode(true)} />
      )}

      {/* 기타 섹션 */}
      <div style={{ marginTop: 8 }}>
        <div style={{ padding: '4px 8px', fontSize: 11, fontWeight: 500, color: COLOR.textTertiary, background: 'rgba(0,0,0,0.025)', borderRadius: 3, marginBottom: 2 }}>기타</div>
        <div style={{ paddingLeft: 22 }}>
          {(shouldSlice ? ungroupedTasks.slice(0, tasksPerGroup) : ungroupedTasks).map(t => (
            <CardTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
              editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
              toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
              showAssignee={showAssignee} />
          ))}
          {shouldSlice && ungroupedTasks.length > tasksPerGroup && (
            <div style={{ fontSize: 11, color: COLOR.textTertiary, padding: '2px 0 4px' }}>+ {ungroupedTasks.length - tasksPerGroup}개 더</div>
          )}
          <InlineAdd projectId={proj.id} category="today" color={c}
            extraFields={{ keyMilestoneId: null, scope: 'team' }} compact />
        </div>
      </div>
    </>
  )
}

/* ═══ B안: 담당자별 그룹 뷰 ═══ */
function OwnerGroupView({
  projTasks, projMs, milestones, members, memberColorMap, proj, c, allTasks,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, updateTask, addTask, showAssignee,
}) {
  const ownerGroups = useMemo(() => {
    const groups = {}
    projTasks.forEach(t => {
      const key = t.assigneeId || '__unassigned__'
      if (!groups[key]) groups[key] = []
      groups[key].push(t)
    })
    const unassigned = groups['__unassigned__'] || []
    delete groups['__unassigned__']
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    const result = []
    if (unassigned.length > 0) result.push({ userId: '__unassigned__', tasks: unassigned })
    sorted.forEach(([uid, tasks]) => result.push({ userId: uid, tasks }))
    return result
  }, [projTasks])

  const getMsName = (keyMilestoneId) => {
    if (!keyMilestoneId) return '기타'
    const ms = milestones.find(m => m.id === keyMilestoneId)
    return ms?.title || '기타'
  }

  return (
    <>
      {ownerGroups.map(g => {
        const isUnassigned = g.userId === '__unassigned__'
        const mem = !isUnassigned ? members.find(m => m.userId === g.userId) : null
        const mColor = !isUnassigned && memberColorMap[g.userId] ? memberColorMap[g.userId].dot : '#bbb'
        const displayName = isUnassigned ? '미배정' : (mem?.displayName || '?')

        return (
          <div key={g.userId} style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 4px', borderBottom: `0.5px solid ${COLOR.border}`, marginBottom: 2,
            }}>
              <MiniAvatar name={isUnassigned ? '?' : displayName} size={18} color={isUnassigned ? '#bbb' : mColor} />
              <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.textPrimary }}>{displayName}</span>
              <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{g.tasks.length}</span>
            </div>
            {g.tasks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => (
              <CardTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
                editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                msTag={getMsName(t.keyMilestoneId)} showAssignee={false} />
            ))}
            <InlineAdd projectId={proj.id} category="today" color={c}
              extraFields={{ keyMilestoneId: null, scope: isUnassigned ? 'team' : 'assigned', ...(isUnassigned ? {} : { assigneeId: g.userId }) }} compact />
          </div>
        )
      })}
      {ownerGroups.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>할일이 없습니다</div>
      )}
    </>
  )
}

/* ═══ CardTaskRow — 카드 내부 task 행 ═══ */
function CardTaskRow({ task, members, memberColorMap, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, updateTask, msTag, showAssignee = true }) {
  const [hover, setHover] = useState(false)
  const [showPopover, setShowPopover] = useState(false)
  const isEditing = editingId === task.id

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 4px', marginBottom: 1, borderRadius: 4,
        background: hover && !isEditing ? COLOR.bgHover : 'transparent',
      }}
    >
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input autoFocus defaultValue={task.text}
            onBlur={e => handleEditFinish(task.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleEditFinish(task.id, e.target.value) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
          />
        ) : (
          <span onClick={() => setEditingId(task.id)} style={{
            fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
            lineHeight: 1.4, cursor: 'text', display: 'block',
            whiteSpace: 'normal', wordBreak: 'break-word',
            textDecoration: task.done ? 'line-through' : 'none',
          }}>{task.text || '(제목 없음)'}</span>
        )}
      </div>

      {/* 부담당 mini badge */}
      {task.secondaryAssigneeId && showAssignee && (
        <span style={{ fontSize: 10, padding: '1px 5px', background: 'rgba(0,0,0,0.04)', borderRadius: 3, color: COLOR.textTertiary, flexShrink: 0 }}>
          +부 {getMemberInfo(task.secondaryAssigneeId, members, memberColorMap)?.name || '?'}
        </span>
      )}

      {/* MS 태그 (B안) */}
      {msTag && (
        <span style={{ fontSize: 11, color: COLOR.textTertiary, background: COLOR.bgSurface, padding: '1px 6px', borderRadius: 3, flexShrink: 0, whiteSpace: 'nowrap' }}>■ {msTag}</span>
      )}

      {/* 담당자 배지 */}
      {!msTag && showAssignee && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {task.secondaryAssigneeId ? (
            <StackedAvatar
              primary={getMemberInfo(task.assigneeId, members, memberColorMap)}
              secondary={getMemberInfo(task.secondaryAssigneeId, members, memberColorMap)}
              size={14} onClick={() => setShowPopover(p => !p)}
            />
          ) : (
            <TaskAssigneeChip taskId={task.id} assigneeId={task.assigneeId} members={members}
              onChangeAssignee={(userId) => updateTask(task.id, { assigneeId: userId, scope: userId ? 'assigned' : 'team' })}
              size={14} />
          )}
          {showPopover && (
            <DualAssigneeSelector mode="popover" primaryId={task.assigneeId} secondaryId={task.secondaryAssigneeId}
              members={members}
              onChangePrimary={(id) => { updateTask(task.id, { assigneeId: id, scope: id ? 'assigned' : 'team' }); setShowPopover(false) }}
              onChangeSecondary={(id) => { updateTask(task.id, { secondaryAssigneeId: id }); setShowPopover(false) }}
              onClose={() => setShowPopover(false)} />
          )}
        </div>
      )}

      {hover && !isEditing && (
        <div onClick={e => { e.stopPropagation(); openDetail(task) }} style={{
          width: 16, height: 16, borderRadius: 3, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: 0.4,
        }}>
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="#666" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  )
}

/* ═══ Dashed 슬롯 ═══ */
function DashedSlot({ label, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: 32, margin: '6px 0', borderRadius: 6,
        border: `1px dashed ${COLOR.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: COLOR.textTertiary,
        opacity: hover ? 1 : 0.4, cursor: 'pointer', transition: 'opacity 0.15s',
      }}
    >{label}</div>
  )
}
