import { useState, useMemo, useCallback } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { COLOR, FONT, CHECKBOX } from '../../../../styles/designTokens'
import useStore from '../../../../hooks/useStore'
import { getColor, getColorByIndex } from '../../../../utils/colors'
import { computeMilestoneCount } from '../../../../utils/milestoneProgress'
import InlineAdd from '../../../shared/InlineAdd'
import MiniAvatar from '../shared/MiniAvatar'
import MilestoneRow from '../cells/MilestoneRow'
import TaskAssigneeChip from '../../../project/TaskAssigneeChip'
import StackedAvatar from '../../../shared/StackedAvatar'
import DualAssigneeSelector from '../../../shared/DualAssigneeSelector'

/* ═══ Helpers ═══ */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/* ═══ SortableLaneCard (12b) ═══ */
function SortableLaneCard({ projId, section, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `project-lane:${projId}`,
    data: { section, projectId: projId, type: 'project-lane' },
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </div>
  )
}

/* ═══ TaskRow (팀 매트릭스 전용 — 담당자 배지 포함) ═══ */
function getMemberInfo(userId, members, memberColorMap) {
  if (!userId) return null
  const m = members.find(mem => mem.userId === userId)
  return m ? { name: m.displayName || '?', color: memberColorMap[userId]?.dot || '#888', userId } : { name: '?', color: '#888', userId }
}

function TeamTaskRow({ task, members, memberColorMap, editingId, setEditingId, handleEditFinish, toggleDone, openDetail, updateTask, msTag }) {
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
      {/* Checkbox */}
      <div onClick={e => { e.stopPropagation(); toggleDone(task.id) }} style={{
        width: CHECKBOX.size, height: CHECKBOX.size, borderRadius: CHECKBOX.radius, flexShrink: 0, cursor: 'pointer', marginTop: 1,
        border: task.done ? 'none' : `1.5px solid ${CHECKBOX.borderColor}`,
        background: task.done ? CHECKBOX.checkedBg : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {task.done && <svg width={8} height={8} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEditing ? (
          <input
            autoFocus defaultValue={task.text}
            onBlur={e => handleEditFinish(task.id, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); handleEditFinish(task.id, e.target.value) }
              if (e.key === 'Escape') setEditingId(null)
            }}
            onMouseDown={e => e.stopPropagation()}
            style={{ width: '100%', fontSize: FONT.body, border: 'none', outline: 'none', background: 'transparent', color: COLOR.textPrimary, fontFamily: 'inherit', padding: 0 }}
          />
        ) : (
          <span
            onClick={() => setEditingId(task.id)}
            style={{
              fontSize: FONT.body, color: task.done ? COLOR.textTertiary : COLOR.textPrimary,
              lineHeight: 1.4, cursor: 'text', display: 'block',
              whiteSpace: 'normal', wordBreak: 'break-word',
              textDecoration: task.done ? 'line-through' : 'none',
            }}
          >{task.text || '(제목 없음)'}</span>
        )}
      </div>

      {/* MS 태그 (B안에서만 표시) */}
      {msTag && (
        <span style={{
          fontSize: 11, color: COLOR.textTertiary,
          background: COLOR.bgSurface, padding: '1px 6px', borderRadius: 3,
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>■ {msTag}</span>
      )}

      {/* 담당자 배지 (B안이 아닐 때만) */}
      {!msTag && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {task.secondaryAssigneeId ? (
            <StackedAvatar
              primary={getMemberInfo(task.assigneeId, members, memberColorMap)}
              secondary={getMemberInfo(task.secondaryAssigneeId, members, memberColorMap)}
              size={14}
              onClick={() => setShowPopover(p => !p)}
            />
          ) : (
            <TaskAssigneeChip
              taskId={task.id}
              assigneeId={task.assigneeId}
              members={members}
              onChangeAssignee={(userId) => updateTask(task.id, { assigneeId: userId, scope: userId ? 'assigned' : 'team' })}
              size={14}
            />
          )}
          {showPopover && (
            <DualAssigneeSelector
              mode="popover"
              primaryId={task.assigneeId}
              secondaryId={task.secondaryAssigneeId}
              members={members}
              onChangePrimary={(id) => { updateTask(task.id, { assigneeId: id, scope: id ? 'assigned' : 'team' }); setShowPopover(false) }}
              onChangeSecondary={(id) => { updateTask(task.id, { secondaryAssigneeId: id }); setShowPopover(false) }}
              onClose={() => setShowPopover(false)}
            />
          )}
        </div>
      )}

      {/* Detail arrow */}
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

/* ═══════════════════════════════════════════════════════
   TeamMatrixGrid v2 — 12c: 플랫 리스트 + MS 그룹 + 담당자 배지
   ═══════════════════════════════════════════════════════ */
export default function TeamMatrixGrid({
  projects, tasks, members, collapsed, toggleCollapse: toggleProjectCollapse,
  editingId, setEditingId, handleEditFinish,
  toggleDone, openDetail, activeId, currentTeamId,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit,
  handleMsDelete,
  groupByOwner,
}) {
  const milestones = useStore(s => s.milestones)
  const allTasks = useStore(s => s.tasks)
  const addTask = useStore(s => s.addTask)
  const updateTask = useStore(s => s.updateTask)
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const collapseState = useStore(s => s.collapseState)
  const storeToggleCollapse = useStore(s => s.toggleCollapse)
  const openModal = useStore(s => s.openModal)
  const teamMsCollapsed = collapseState.teamMatrixMs || {}
  const toggleTeamMsCollapse = useCallback((msId) => storeToggleCollapse('teamMatrixMs', msId), [storeToggleCollapse])

  // 멤버 색상 매핑 (stable sort by userId)
  const sortedMembers = useMemo(() => [...members].sort((a, b) => (a.userId || '').localeCompare(b.userId || '')), [members])
  const memberColorMap = useMemo(() => {
    const map = {}
    sortedMembers.forEach((m, i) => { map[m.userId] = getColorByIndex(i) })
    return map
  }, [sortedMembers])

  if (members.length === 0) {
    return <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>팀원 정보를 불러오는 중...</div>
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <SortableContext items={projects.map(p => `project-lane:${p.id}`)} strategy={verticalListSortingStrategy}>
        {projects.map(proj => {
          const c = getColor(proj.color)
          const projTasks = tasks.filter(t => t.projectId === proj.id && t.teamId === currentTeamId && !t.done && !t.deletedAt)
          const projActiveCount = projTasks.length
          const isCol = collapsed[proj.id]
          const projMs = milestones.filter(m => m.project_id === proj.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          const section = proj.teamId ? 'team' : 'personal'

          // 참여자 칩 (task 수 내림차순, 미배정 맨 뒤)
          // 참여자 칩 (useMemo 아님 — 루프 안에서 hook 호출 불가, plain 계산)
          const counts = {}
          projTasks.forEach(t => {
            const key = t.assigneeId || '__unassigned__'
            counts[key] = (counts[key] || 0) + 1
          })
          const unassignedCount = counts['__unassigned__'] || 0
          delete counts['__unassigned__']
          const memberCounts = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([uid, cnt]) => ({ userId: uid, count: cnt }))
          if (unassignedCount > 0) memberCounts.push({ userId: '__unassigned__', count: unassignedCount })

          return (
            <SortableLaneCard key={proj.id} projId={proj.id} section={section}>
              {({ attributes, listeners }) => (
                <div style={{
                  background: '#fff', border: `1px solid ${COLOR.border}`, borderRadius: 10,
                  marginBottom: 12, overflow: 'hidden',
                }}>
                  {/* Lane 헤더 */}
                  <div
                    {...attributes}
                    {...listeners}
                    onClick={() => toggleProjectCollapse(proj.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px', cursor: 'grab',
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
                    <span style={{ fontSize: FONT.label, fontWeight: 600, color: COLOR.textPrimary }}>{proj.name}</span>
                    <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{projActiveCount}건</span>
                    <div style={{ flex: 1 }} />
                    {/* 참여자 칩 */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {memberCounts.map(mc => {
                        const isUnassigned = mc.userId === '__unassigned__'
                        const mem = !isUnassigned ? members.find(m => m.userId === mc.userId) : null
                        const mColor = !isUnassigned && memberColorMap[mc.userId] ? memberColorMap[mc.userId].dot : '#bbb'
                        return (
                          <div key={mc.userId} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MiniAvatar name={isUnassigned ? '?' : (mem?.displayName || '?')} size={16} color={isUnassigned ? '#bbb' : mColor} />
                            <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>{mc.count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Lane 본문 */}
                  {!isCol && (
                    <div style={{ padding: '8px 14px' }}>
                      {groupByOwner ? (
                        /* ═══ B안: 담당자별 그룹 ═══ */
                        <OwnerGroupView
                          projTasks={projTasks} projMs={projMs} milestones={milestones}
                          members={members} memberColorMap={memberColorMap}
                          proj={proj} c={c} allTasks={allTasks}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                          addTask={addTask}
                        />
                      ) : (
                        /* ═══ C안: MS 그룹 + 플랫 리스트 ═══ */
                        <MsGroupView
                          projTasks={projTasks} projMs={projMs} milestones={milestones}
                          members={members} memberColorMap={memberColorMap}
                          proj={proj} c={c} allTasks={allTasks}
                          teamMsCollapsed={teamMsCollapsed}
                          toggleTeamMsCollapse={toggleTeamMsCollapse}
                          editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                          editingMsId={editingMsId} onStartMsEdit={onStartMsEdit}
                          handleMsEditFinish={handleMsEditFinish} cancelMsEdit={cancelMsEdit}
                          handleMsDelete={handleMsDelete}
                          toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                          addTask={addTask} addMilestoneInProject={addMilestoneInProject}
                          openModal={openModal}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </SortableLaneCard>
          )
        })}
      </SortableContext>

      {projects.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>표시할 프로젝트가 없습니다</div>
      )}
    </div>
  )
}

/* ═══ C안: MS 그룹 뷰 ═══ */
function MsGroupView({
  projTasks, projMs, milestones, members, memberColorMap, proj, c, allTasks,
  teamMsCollapsed, toggleTeamMsCollapse,
  editingId, setEditingId, handleEditFinish,
  editingMsId, onStartMsEdit, handleMsEditFinish, cancelMsEdit, handleMsDelete,
  toggleDone, openDetail, updateTask, addTask, addMilestoneInProject, openModal,
}) {
  const [addingMsMode, setAddingMsMode] = useState(false)
  const [newMsTitle, setNewMsTitle] = useState('')

  // MS별 task 그룹핑
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

  return (
    <>
      {/* MS 그룹 */}
      {msGroups.map(g => {
        const msCollapsed = !!teamMsCollapsed[g.ms.id]
        const cnt = computeMilestoneCount(g.ms.id, allTasks)
        return (
          <div key={g.ms.id} style={{ marginBottom: 6 }}>
            <MilestoneRow
              ms={g.ms}
              taskCount={g.tasks.length}
              aliveCount={cnt.alive}
              totalCount={cnt.total}
              accentColor={c.dot}
              isEmpty={g.tasks.length === 0}
              collapsed={msCollapsed}
              onToggleCollapse={() => toggleTeamMsCollapse(g.ms.id)}
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
            {!msCollapsed && (
              <div style={{ paddingLeft: 22 }}>
                {g.tasks.map(t => (
                  <TeamTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
                    editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                    toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask} />
                ))}
                <InlineAdd projectId={proj.id} category="today" color={c}
                  extraFields={{ keyMilestoneId: g.ms.id, scope: 'team' }} compact />
              </div>
            )}
          </div>
        )
      })}

      {/* Dashed + 마일스톤 추가 슬롯 */}
      {addingMsMode ? (
        <div style={{ margin: '6px 0', padding: '4px 0' }}>
          <input
            autoFocus
            value={newMsTitle}
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
        <div style={{
          padding: '4px 8px', fontSize: 11, fontWeight: 500, color: COLOR.textTertiary,
          background: 'rgba(0,0,0,0.025)', borderRadius: 3, marginBottom: 2,
        }}>기타</div>
        <div style={{ paddingLeft: 22 }}>
          {ungroupedTasks.map(t => (
            <TeamTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
              editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
              toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask} />
          ))}
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
  toggleDone, openDetail, updateTask, addTask,
}) {
  // 12d: 담당자별 그룹 — primary/secondary 분리 배열
  const ownerGroups = useMemo(() => {
    const groups = {}
    // 정담당 그룹핑
    projTasks.forEach(t => {
      const key = t.assigneeId || '__unassigned__'
      if (!groups[key]) groups[key] = { primary: [], secondary: [] }
      groups[key].primary.push(t)
    })
    // 부담당 그룹핑 (별도 배열)
    projTasks.forEach(t => {
      if (t.secondaryAssigneeId) {
        const key = t.secondaryAssigneeId
        if (!groups[key]) groups[key] = { primary: [], secondary: [] }
        groups[key].secondary.push(t)
      }
    })
    // 정렬: 미배정 먼저, 나머지 정담당 task 수 내림차순
    const unassigned = groups['__unassigned__'] || { primary: [], secondary: [] }
    delete groups['__unassigned__']
    const sorted = Object.entries(groups).sort((a, b) => b[1].primary.length - a[1].primary.length)
    const result = []
    if (unassigned.primary.length > 0) result.push({ userId: '__unassigned__', ...unassigned })
    sorted.forEach(([uid, g]) => result.push({ userId: uid, ...g }))
    return result
  }, [projTasks])

  // MS 이름 lookup
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
        const primaryCount = g.primary.length
        const secondaryCount = g.secondary.length

        return (
          <div key={g.userId} style={{ marginBottom: 8 }}>
            {/* Sub-section 헤더 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 4px', borderBottom: `0.5px solid ${COLOR.border}`, marginBottom: 2,
            }}>
              <MiniAvatar name={isUnassigned ? '?' : displayName} size={18} color={isUnassigned ? '#bbb' : mColor} />
              <span style={{ fontSize: 12, fontWeight: 600, color: COLOR.textPrimary }}>{displayName}</span>
              <span style={{ fontSize: FONT.tiny, color: COLOR.textTertiary }}>
                {primaryCount}{secondaryCount > 0 ? ` +부 ${secondaryCount}` : ''}
              </span>
            </div>
            {/* 정담당 Task 리스트 */}
            {g.primary.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => (
              <TeamTaskRow key={t.id} task={t} members={members} memberColorMap={memberColorMap}
                editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                msTag={getMsName(t.keyMilestoneId)} />
            ))}
            {/* 부담당 Task 리스트 (muted) */}
            {secondaryCount > 0 && g.secondary.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map(t => {
              const primaryMem = t.assigneeId ? members.find(m => m.userId === t.assigneeId) : null
              return (
                <div key={`${t.id}-secondary`} style={{ opacity: 0.55, boxShadow: 'inset 2px 0 0 #e8e6df', paddingLeft: 2 }}>
                  <TeamTaskRow task={t} members={members} memberColorMap={memberColorMap}
                    editingId={editingId} setEditingId={setEditingId} handleEditFinish={handleEditFinish}
                    toggleDone={toggleDone} openDetail={openDetail} updateTask={updateTask}
                    msTag={getMsName(t.keyMilestoneId)} />
                  <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 3, marginLeft: 22, color: COLOR.textTertiary }}>
                    정 {primaryMem?.displayName || '미배정'}
                  </span>
                </div>
              )
            })}
            <InlineAdd projectId={proj.id} category="today" color={c}
              extraFields={{ keyMilestoneId: null, scope: isUnassigned ? 'team' : 'assigned', ...(isUnassigned ? {} : { assigneeId: g.userId }) }} compact />
          </div>
        )
      })}
      {ownerGroups.length === 0 && (
        <div style={{ padding: 20, textAlign: 'center', color: COLOR.textTertiary, fontSize: FONT.body }}>
          할일이 없습니다
        </div>
      )}
    </>
  )
}

/* ═══ Dashed 슬롯 ═══ */
function DashedSlot({ label, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 32, margin: '6px 0', borderRadius: 6,
        border: `1px dashed ${COLOR.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: COLOR.textTertiary,
        opacity: hover ? 1 : 0.4,
        cursor: 'pointer', transition: 'opacity 0.15s',
      }}
    >{label}</div>
  )
}
