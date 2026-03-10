import { useState } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { SettingsIcon } from '../shared/Icons'
import TaskItem from '../shared/TaskItem'
import InlineAdd from '../shared/InlineAdd'

export default function MatrixView() {
  const { projects, tasks, setShowProjectMgr } = useStore()
  const isMobile = window.innerWidth < 768
  const LW = isMobile ? 72 : 92
  const COL_GAP = isMobile ? 8 : 10
  const COL_MIN = isMobile ? 180 : 0

  const [doneCollapsed, setDoneCollapsed] = useState({})

  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  return (
    <div style={{ padding: isMobile ? '20px 0 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, padding: isMobile ? '0 16px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0, letterSpacing: '-0.02em' }}>매트릭스 뷰</h1>
            <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{dateStr}</p>
          </div>
          <button onClick={() => setShowProjectMgr(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e0e0', background: 'white', cursor: 'pointer', color: '#888', fontSize: 12, fontFamily: 'inherit', fontWeight: 500, transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#37352f' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#888' }}>
            <SettingsIcon /> 프로젝트 관리
          </button>
        </div>

        <div style={{ overflowX: 'auto', padding: isMobile ? '0 12px' : 0 }}>
          <div style={{ display: 'flex', gap: COL_GAP, minWidth: isMobile ? LW + projects.length * (COL_MIN + COL_GAP) : 'auto' }}>

            {/* Category label column */}
            <div style={{ width: LW, flexShrink: 0, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4, background: 'white' } : {}) }}>
              {/* Empty space for header row alignment */}
              <div style={{ height: 52 }} />

              {CATEGORIES.map(cat => {
                const isDone = cat.key === 'done'
                return (
                  <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'center' : 'flex-end', justifyContent: 'flex-start', paddingTop: 14, paddingRight: isMobile ? 0 : 10, minHeight: isDone ? 50 : 90 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#999' : '#555', marginTop: 4, textAlign: isMobile ? 'center' : 'right', lineHeight: 1.3 }}>{cat.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Project columns */}
            {projects.map(p => {
              const c = getColor(p.color)
              const pt = tasks.filter(t => t.projectId === p.id)

              return (
                <div key={p.id} style={{ flex: 1, minWidth: COL_MIN, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  {/* Project header */}
                  <div style={{ background: c.header, borderBottom: `2.5px solid ${c.dot}`, padding: isMobile ? '10px 10px' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
                  </div>

                  {/* Category cells */}
                  {CATEGORIES.map((cat, ri) => {
                    const isDoneRow = cat.key === 'done'
                    const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key)
                    const isCollapsed = isDoneRow && doneCollapsed[p.id] !== false && catTasks.length > 0

                    return (
                      <div key={cat.key} style={{ padding: isMobile ? 8 : '10px 14px', background: isDoneRow ? '#fcfcfc' : c.card, borderBottom: ri < CATEGORIES.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', minHeight: isDoneRow ? 50 : 90, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: isDoneRow ? '#aaa' : c.dot, background: isDoneRow ? '#f0f0f0' : c.header, borderRadius: 8, padding: '1px 7px', fontWeight: 600 }}>{catTasks.length}건</span>
                          {isDoneRow && catTasks.length > 0 && (
                            <button onClick={() => setDoneCollapsed(prev => ({ ...prev, [p.id]: !isCollapsed }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 10, fontFamily: 'inherit', padding: '0 4px' }}>
                              {isCollapsed ? '펼치기' : '접기'}
                            </button>
                          )}
                        </div>
                        <div style={{ flex: 1, minHeight: 20 }}>
                          {isDoneRow && isCollapsed
                            ? <div style={{ fontSize: 11, color: '#ccc', padding: '2px 0' }}>완료 {catTasks.length}건</div>
                            : catTasks.map(task => <TaskItem key={task.id} task={task} color={c} compact={isDoneRow} />)
                          }
                        </div>
                        {!isDoneRow && <InlineAdd projectId={p.id} category={cat.key} color={c} />}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
