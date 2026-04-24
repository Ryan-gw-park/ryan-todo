import { useMemo, useRef, useCallback, useState } from 'react'
import useStore from '../../../hooks/useStore'
import { COLOR, FONT, SPACE } from '../../../styles/designTokens'
import { getColor } from '../../../utils/colors'
import OutlinerEditor from '../../shared/OutlinerEditor'

/* ═══════════════════════════════════════════════
   FocusNotePanel (Loop-46)
   3번째 pane — 선택된 포커스 카드의 notes 편집

   - selectedFocusTaskId 구독 (store)
   - stale 방어: tasks.find(... && isFocus && !done && !deletedAt) 재검증 (F-40)
   - 헤더 task 제목 클릭 → openDetail (F-42)
   - DetailPanel L71-L81 debounce 800ms + optimistic update 패턴 복제 (F-38)
   - OutlinerEditor 수정 금지 — props만 연결 (N-13)
   ═══════════════════════════════════════════════ */
export default function FocusNotePanel({ tasks, projects }) {
  const selectedFocusTaskId = useStore(s => s.selectedFocusTaskId)
  const updateTask = useStore(s => s.updateTask)
  const openDetail = useStore(s => s.openDetail)

  const [titleHover, setTitleHover] = useState(false)
  const debounceRef = useRef(null)

  // F-40 stale 방어: 선택된 task가 여전히 유효한지 확인
  const selectedTask = useMemo(() => {
    if (!selectedFocusTaskId) return null
    return tasks.find(t =>
      t.id === selectedFocusTaskId &&
      t.isFocus === true &&
      !t.done &&
      !t.deletedAt
    ) || null
  }, [tasks, selectedFocusTaskId])

  const project = useMemo(() => {
    if (!selectedTask) return null
    return projects.find(p => p.id === selectedTask.projectId) || null
  }, [projects, selectedTask])

  const accentColor = useMemo(() => {
    if (project?.isSystem) return '#888780'
    return project ? getColor(project.color).dot : '#bbb'
  }, [project])

  // DetailPanel L71-L81 패턴 복제 (F-38)
  const handleNotesChange = useCallback((newNotes) => {
    if (!selectedTask) return
    const tid = selectedTask.id
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(tid, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === tid ? { ...t, notes: newNotes } : t)
    }))
  }, [selectedTask, updateTask])

  // F-39: empty state
  if (!selectedTask) {
    return (
      <div style={{
        position: 'sticky', top: 0, alignSelf: 'flex-start',
        padding: SPACE.cellPadding, minHeight: 200,
        borderLeft: `1px solid ${COLOR.border}`,
      }}>
        <div style={{
          padding: '40px 16px', textAlign: 'center',
          color: COLOR.textTertiary, fontSize: FONT.body,
          lineHeight: 1.6,
        }}>
          포커스 카드를 선택하면<br />노트가 여기에 표시됩니다
        </div>
      </div>
    )
  }

  // F-22 재활용: system project → "프로젝트 미지정"
  const projectLabel = project?.isSystem ? '프로젝트 미지정' : (project?.name || '')

  return (
    <div style={{
      position: 'sticky', top: 0, alignSelf: 'flex-start',
      padding: SPACE.cellPadding, minHeight: 200,
      borderLeft: `1px solid ${COLOR.border}`,
    }}>
      {/* Header — 제목 클릭 시 DetailPanel (F-42) */}
      <button
        onClick={() => openDetail(selectedTask)}
        onMouseEnter={() => setTitleHover(true)}
        onMouseLeave={() => setTitleHover(false)}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          background: 'transparent', border: 'none',
          padding: '8px 4px', marginBottom: 10,
          borderBottom: `1px solid ${COLOR.border}`,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
        title="클릭하여 상세 보기"
      >
        <div style={{
          fontSize: FONT.sectionTitle, fontWeight: 600,
          color: COLOR.textPrimary, lineHeight: 1.3,
          wordBreak: 'break-word',
          textDecoration: titleHover ? 'underline' : 'none',
        }}>
          {selectedTask.text}
        </div>
        {projectLabel && (
          <div style={{
            fontSize: FONT.caption, color: COLOR.textTertiary,
            marginTop: 4,
            fontStyle: project?.isSystem ? 'italic' : 'normal',
          }}>
            {projectLabel}
          </div>
        )}
      </button>

      {/* Notes editor (OutlinerEditor 수정 금지, props만 연결 — N-13) */}
      <OutlinerEditor
        notes={selectedTask.notes}
        onChange={handleNotesChange}
        accentColor={accentColor}
      />
    </div>
  )
}
