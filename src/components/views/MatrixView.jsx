import { useState } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { SettingsIcon } from '../shared/Icons'
import TaskItem from '../shared/TaskItem'
import InlineAdd from '../shared/InlineAdd'

export default function MatrixView() {
  const { projects, tasks, setShowProjectMgr } = useStore()
  const isMobile = window.innerWidth < 768
  const RLW = isMobile ? 68 : 96
  const CMW = isMobile ? 180 : 0

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
          <div style={{ minWidth: isMobile ? RLW + projects.length * CMW : 'auto', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e5e5', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            {/* Header row */}
            <div style={{ display: 'flex' }}>
              <div style={{ width: RLW, flexShrink: 0, background: '#f9f9f9', borderRight: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 4 } : {}) }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#bbb' }}>프로젝트 →</span>
              </div>
              {projects.map((p, i) => {
                const c = getColor(p.color)
                const pt = tasks.filter(t => t.projectId === p.id)
                return (
                  <div key={p.id} style={{ flex: 1, minWidth: CMW, background: c.header, borderRight: i < projects.length-1 ? '1px solid rgba(0,0,0,0.06)' : 'none', borderBottom: `2.5px solid ${c.dot}`, padding: isMobile ? 10 : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: c.text, whiteSpace: 'nowrap' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.55)', borderRadius: 10, padding: '1px 8px', fontWeight: 600, flexShrink: 0 }}>{pt.length}</span>
                  </div>
                )
              })}
            </div>

            {/* Category rows */}
            {CATEGORIES.map((cat, ri) => {
              const isDoneRow = cat.key === 'done'
              return (
                <div key={cat.key} style={{ display: 'flex', borderBottom: ri < CATEGORIES.length-1 ? '1px solid #e5e5e5' : 'none' }}>
                  <div style={{ width: RLW, flexShrink: 0, background: isDoneRow ? '#f5f5f5' : '#f9f9f9', borderRight: '1px solid #e5e5e5', padding: isMobile ? '12px 6px' : '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 4, ...(isMobile ? { position: 'sticky', left: 0, zIndex: 3 } : {}) }}>
                    <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isDoneRow ? '#999' : '#666', textAlign: 'center', lineHeight: 1.3 }}>{cat.label}</span>
                  </div>
                  {projects.map((p, ci) => {
                    const c = getColor(p.color)
                    const catTasks = tasks.filter(t => t.projectId === p.id && t.category === cat.key)
                    const isCollapsed = isDoneRow && doneCollapsed[p.id] !== false && catTasks.length > 0

                    return (
                      <div key={p.id} style={{ flex: 1, minWidth: CMW, padding: isMobile ? 8 : '10px 14px', background: isDoneRow ? '#fcfcfc' : c.card, borderRight: ci < projects.length-1 ? '1px solid rgba(0,0,0,0.04)' : 'none', minHeight: isDoneRow ? 50 : 90, display: 'flex', flexDirection: 'column' }}>
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
