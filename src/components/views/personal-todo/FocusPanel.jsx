import { useMemo } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { getCachedUserId } from '../../../hooks/useStore'
import { COLOR, FONT, SPACE } from '../../../styles/designTokens'
import FocusCard from './cells/FocusCard'
import FocusQuickAddInput from './cells/FocusQuickAddInput'

/* ═══════════════════════════════════════════════
   FocusPanel (Loop-45)
   우측 sticky 포커스 패널

   - F-14: position: sticky; top: 0
   - F-15: assigneeId === userId && isFocus && !done && !deletedAt
   - F-16: focusSortOrder ASC, updatedAt DESC tiebreak
   - F-23: useDroppable id = 'focus-panel:root' (백로그 → 포커스 drop)
   - F-25: SortableContext 내부 재정렬은 Shell의 onDragEnd에서 reorderFocusTasks 호출
   - F-27/F-28: '즉시' project id는 props로 주입 (Shell이 조회)

   시그니처:
     <FocusPanel projects={projects} tasks={tasks} milestones={milestones} />
   ═══════════════════════════════════════════════ */
export default function FocusPanel({ projects, tasks, milestones }) {
  const currentUserId = getCachedUserId()
  const { setNodeRef, isOver } = useDroppable({ id: 'focus-panel:root' })

  // '즉시' 프로젝트 id 조회 — Stage 1 seed 완료 가정 (user_id + systemKey='instant')
  const instantProjectId = useMemo(() => {
    const p = projects.find(x => x.userId === currentUserId && x.systemKey === 'instant')
    return p?.id || null
  }, [projects, currentUserId])

  const focusTasks = useMemo(() => {
    const mine = tasks.filter(t =>
      t.assigneeId === currentUserId &&
      t.isFocus === true &&
      !t.done &&
      !t.deletedAt
    )
    return mine.sort((a, b) => {
      const oa = a.focusSortOrder ?? 0
      const ob = b.focusSortOrder ?? 0
      if (oa !== ob) return oa - ob
      return (b.updatedAt || '').localeCompare(a.updatedAt || '')
    })
  }, [tasks, currentUserId])

  const projectById = useMemo(() => {
    const m = new Map()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  const msById = useMemo(() => {
    const m = new Map()
    for (const x of milestones) m.set(x.id, x)
    return m
  }, [milestones])

  const totalCount = focusTasks.length
  const cardIds = useMemo(() => focusTasks.map(t => `focus-card:${t.id}`), [focusTasks])

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        padding: SPACE.cellPadding,
        minHeight: 200,
        background: isOver ? COLOR.bgHover : 'transparent',
        borderLeft: `1px solid ${COLOR.border}`,
        transition: 'background 0.15s',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 10, paddingBottom: 6,
        borderBottom: `1px solid ${COLOR.border}`,
      }}>
        <span style={{ fontSize: FONT.sectionTitle, fontWeight: 600, color: COLOR.textPrimary }}>
          포커스
        </span>
        <span style={{ fontSize: FONT.caption, color: COLOR.textTertiary }}>
          {totalCount}건
        </span>
      </div>

      {/* Quick add */}
      <FocusQuickAddInput
        instantProjectId={instantProjectId}
        currentUserId={currentUserId}
      />

      {/* Focus cards (sortable within panel) */}
      <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
        {focusTasks.map(task => (
          <FocusCard
            key={task.id}
            task={task}
            project={projectById.get(task.projectId)}
            milestone={task.keyMilestoneId ? msById.get(task.keyMilestoneId) : null}
          />
        ))}
      </SortableContext>

      {/* Empty state */}
      {totalCount === 0 && (
        <div style={{
          padding: '24px 12px', textAlign: 'center',
          color: COLOR.textTertiary, fontSize: FONT.body,
          lineHeight: 1.6,
        }}>
          포커스 할일이 없습니다<br />
          왼쪽 할일을 드래그하거나<br />위 입력창에 바로 추가하세요
        </div>
      )}
    </div>
  )
}
