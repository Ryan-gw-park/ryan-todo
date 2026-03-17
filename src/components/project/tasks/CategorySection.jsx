import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import useStore from '../../../hooks/useStore'
import { CATEGORIES } from '../../../utils/colors'
import OutlinerTaskNode from './OutlinerTaskNode'
import AddTaskButton from './AddTaskButton'

/* ── Category section — manages inter-task navigation ── */
const CategorySection = forwardRef(function CategorySection({ cat, catTasks, projectId, color, expanded, toggleExpand, memberMap, onExitSectionDown, onExitSectionUp }, ref) {
  const { addTask, updateTask, deleteTask, collapseState, toggleCollapse } = useStore()
  const taskRefs = useRef({})
  const addBtnRef = useRef(null)
  const pendingFocusRef = useRef(null)
  const isDoneCat = cat.key === 'done'  // UI 행 렌더링용 (CATEGORIES 배열의 done 항목)
  const sectionKey = `${projectId}:${cat.key}`
  const sectionCollapsed = collapseState.projectSection?.[sectionKey]
  const isMobile = window.innerWidth < 768

  /* Expose focusFirst / focusLast to parent for cross-category nav */
  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (isDoneCat) return false
      if (catTasks.length > 0) {
        taskRefs.current[catTasks[0].id]?.focusTitle('start')
        return true
      }
      // No tasks → activate add button
      if (addBtnRef.current?.activate) {
        addBtnRef.current.activate()
        return true
      }
      return false
    },
    focusLast: () => {
      if (isDoneCat) return false
      if (catTasks.length > 0) {
        taskRefs.current[catTasks[catTasks.length - 1].id]?.focusLast()
        return true
      }
      if (addBtnRef.current?.activate) {
        addBtnRef.current.activate()
        return true
      }
      return false
    },
  }))

  /* Focus a newly created task after re-render */
  useEffect(() => {
    if (pendingFocusRef.current) {
      const { idx, pos } = pendingFocusRef.current
      pendingFocusRef.current = null
      const task = catTasks[idx]
      if (task) {
        setTimeout(() => taskRefs.current[task.id]?.focusTitle(pos), 40)
      }
    }
  })

  const handleSwap = useCallback((i, dir) => {
    const j = i + dir
    if (j < 0 || j >= catTasks.length) return
    const a = catTasks[i], b = catTasks[j]
    const aOrder = a.sortOrder, bOrder = b.sortOrder
    updateTask(a.id, { sortOrder: bOrder })
    updateTask(b.id, { sortOrder: aOrder })
    setTimeout(() => taskRefs.current[a.id]?.focusTitle('end'), 50)
  }, [catTasks, updateTask])

  const handleTitleEnter = useCallback((i, afterText) => {
    const task = catTasks[i]
    const nextTask = catTasks[i + 1]
    const sortOrder = nextTask
      ? (task.sortOrder + nextTask.sortOrder) / 2
      : task.sortOrder + 1
    addTask({ text: afterText, projectId, category: cat.key, sortOrder })
    pendingFocusRef.current = { idx: i + 1, pos: 'start' }
  }, [catTasks, addTask, projectId, cat.key])

  const handleTitleBackspace = useCallback((i) => {
    const task = catTasks[i]
    if (!task.text && catTasks.length <= 1) return
    deleteTask(task.id)
    if (i > 0) {
      setTimeout(() => taskRefs.current[catTasks[i - 1].id]?.focusTitle('end'), 40)
    }
  }, [catTasks, deleteTask])

  /* Handle exit down from last task — go to add button, then next section */
  const handleTaskExitDown = useCallback((i) => {
    if (i < catTasks.length - 1) {
      taskRefs.current[catTasks[i + 1].id]?.focusTitle('start')
    } else if (!isDoneCat && addBtnRef.current?.activate) {
      addBtnRef.current.activate()
    } else {
      onExitSectionDown?.()
    }
  }, [catTasks, isDoneCat, onExitSectionDown])

  const handleTaskExitUp = useCallback((i) => {
    if (i > 0) {
      taskRefs.current[catTasks[i - 1].id]?.focusLast()
    } else {
      onExitSectionUp?.()
    }
  }, [catTasks, onExitSectionUp])

  /* Handle add button down arrow → next section. Returns true if focus moved. */
  const handleAddExitDown = useCallback(() => {
    return onExitSectionDown?.() || false
  }, [onExitSectionDown])

  /* Handle add button up arrow → last task in this section, or previous section */
  const handleAddExitUp = useCallback(() => {
    if (catTasks.length > 0) {
      taskRefs.current[catTasks[catTasks.length - 1].id]?.focusLast()
      return true
    }
    return onExitSectionUp?.() || false
  }, [catTasks, onExitSectionUp])

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: `2px solid ${isDoneCat ? '#e0e0e0' : color.dot}20`, marginBottom: 8 }}>
        <span style={{ fontSize: isMobile ? 13 : 14 }}>{cat.emoji}</span>
        <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600, color: isDoneCat ? '#999' : '#37352f' }}>{cat.label}</span>
        <span style={{ fontSize: 11, color: isDoneCat ? '#aaa' : color.dot, background: isDoneCat ? '#f0f0f0' : color.header, borderRadius: 8, padding: '1px 8px', fontWeight: 600 }}>{catTasks.length}</span>
        {!isDoneCat && catTasks.length > 0 && (
          <button
            onClick={() => toggleCollapse('projectSection', sectionKey)}
            title={sectionCollapsed ? '모든 노트 펼치기' : '모든 노트 접기'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, display: 'flex', marginLeft: 'auto' }}
            onMouseEnter={e => e.currentTarget.style.color = color.dot}
            onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              {sectionCollapsed ? (
                <>
                  <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <>
                  <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              )}
            </svg>
          </button>
        )}
      </div>
      <div style={{ paddingLeft: 4 }}>
        {catTasks.length === 0 && isDoneCat && <div style={{ fontSize: 12, color: '#ccc', padding: '4px 16px' }}>아직 완료된 항목이 없습니다</div>}
        {catTasks.map((task, i) => (
          <OutlinerTaskNode
            key={task.id}
            ref={el => taskRefs.current[task.id] = el}
            task={task}
            color={color}
            expanded={expanded}
            toggleExpand={toggleExpand}
            memberMap={memberMap}
            sectionCollapsed={sectionCollapsed}
            onExitUp={() => handleTaskExitUp(i)}
            onExitDown={() => handleTaskExitDown(i)}
            onTitleEnter={(afterText) => handleTitleEnter(i, afterText)}
            onTitleBackspace={() => handleTitleBackspace(i)}
            onSwapUp={() => handleSwap(i, -1)}
            onSwapDown={() => handleSwap(i, 1)}
          />
        ))}
        {!isDoneCat && <AddTaskButton ref={addBtnRef} projectId={projectId} category={cat.key} color={color} onExitDown={handleAddExitDown} onExitUp={handleAddExitUp} />}
      </div>
    </div>
  )
})

export default CategorySection
