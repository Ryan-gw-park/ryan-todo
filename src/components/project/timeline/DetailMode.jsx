import { useMemo } from 'react'
import { useProjectTimelineData } from '../../../hooks/useProjectTimelineData'
import useStore from '../../../hooks/useStore'
import { CheckIcon } from '../../shared/Icons'

// Date utilities
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function isDateInWeek(dateStr, weekStart) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const ws = new Date(weekStart)
  const we = new Date(ws)
  we.setDate(ws.getDate() + 6)
  return date >= ws && date <= we
}

// Generate week columns
function generateWeekColumns() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setMonth(start.getMonth() - 1)
  const end = new Date(today)
  end.setMonth(end.getMonth() + 3)

  const columns = []
  let cursor = new Date(start)
  cursor.setDate(cursor.getDate() - cursor.getDay() + 1)

  while (cursor < end) {
    const weekStart = new Date(cursor)
    const isThisWeek = isDateInWeek(today.toISOString().split('T')[0], weekStart)
    const month = cursor.getMonth() + 1
    const weekOfMonth = Math.ceil(cursor.getDate() / 7)

    columns.push({
      weekStart: weekStart.toISOString().split('T')[0],
      label: `${month}/${weekOfMonth}주`,
      isToday: isThisWeek,
    })
    cursor.setDate(cursor.getDate() + 7)
  }
  return columns
}

// Calculate bar position based on milestone dates
function calcMilestoneBar(ms, columns) {
  if (!ms.start_date && !ms.end_date) return null
  const start = ms.start_date || ms.end_date
  const end = ms.end_date || ms.start_date

  let startIdx = columns.findIndex(c => isDateInWeek(start, c.weekStart))
  let endIdx = columns.findIndex(c => isDateInWeek(end, c.weekStart))

  if (startIdx < 0 && new Date(start) < new Date(columns[0].weekStart)) startIdx = 0
  if (endIdx < 0 && new Date(end) > new Date(columns[columns.length - 1].weekStart)) endIdx = columns.length - 1
  if (startIdx < 0 && endIdx < 0) return null

  const s = Math.max(0, startIdx)
  const e = Math.min(columns.length - 1, endIdx < 0 ? columns.length - 1 : endIdx)

  return {
    left: (s / columns.length) * 100,
    width: (Math.max(1, e - s + 1) / columns.length) * 100,
  }
}

// Today line
function TodayLine({ columns }) {
  const todayIdx = columns.findIndex(c => c.isToday)
  if (todayIdx < 0) return null
  const left = ((todayIdx + 0.5) / columns.length) * 100

  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0,
      left: `${left}%`, width: 1.5,
      background: '#378ADD', zIndex: 1, opacity: 0.45,
    }} />
  )
}

// Skeleton loading
function Skeleton() {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center', fontSize: 14 }}>
      로딩 중...
    </div>
  )
}

export default function DetailMode({ projectId }) {
  const {
    milestones, deliverables, loading,
    getDeliverablesByMilestone, getTasksByMilestone,
  } = useProjectTimelineData(projectId)

  const { addTask, toggleDone, updateTask } = useStore()
  const columns = useMemo(() => generateWeekColumns(), [])

  if (loading) return <Skeleton />

  if (milestones.length === 0) {
    return (
      <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center', fontSize: 14 }}>
        마일스톤이 없습니다. 마일스톤 탭에서 마일스톤을 추가하세요.
      </div>
    )
  }

  const handleAddTask = (milestone) => {
    addTask({
      text: `${milestone.title} 관련 작업`,
      projectId,
      keyMilestoneId: milestone.id,
      category: 'backlog',
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', position: 'sticky', top: 0, zIndex: 3,
        background: '#fff', borderBottom: '0.5px solid #e8e6df'
      }}>
        <div style={{
          width: 160, flexShrink: 0, padding: '7px 12px',
          fontSize: 11, color: '#a09f99', fontWeight: 600, letterSpacing: '.03em'
        }}>
          결과물
        </div>
        <div style={{ display: 'flex', flex: 1, minWidth: columns.length * 40 }}>
          {columns.map((c, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 40, textAlign: 'center', fontSize: 10, padding: '7px 0',
              color: c.isToday ? '#378ADD' : '#b4b2a9', fontWeight: 500,
              background: c.isToday ? 'rgba(55,138,221,.04)' : 'transparent'
            }}>
              {c.label}
            </div>
          ))}
        </div>
        <div style={{
          width: '40%', flexShrink: 0, padding: '7px 12px',
          fontSize: 11, color: '#a09f99', fontWeight: 600, letterSpacing: '.03em',
          borderLeft: '0.5px solid #e8e6df'
        }}>
          연결된 Tasks
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {milestones.map(ms => {
          const msDeliverables = getDeliverablesByMilestone(ms.id)
          const msTasks = getTasksByMilestone(ms.id)
          const days = daysUntil(ms.end_date)

          return (
            <div key={ms.id}>
              {/* Milestone header row */}
              <div style={{
                display: 'flex', background: '#fafaf8',
                borderBottom: '0.5px solid #e8e6df'
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#6b6a66',
                  flex: 1, minWidth: 160 + columns.length * 40
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: ms.color || '#1D9E75'
                  }} />
                  {ms.title}
                  {days !== null && (
                    <span style={{ fontSize: 11, color: days <= 7 && days >= 0 ? '#BA7517' : '#b4b2a9', fontWeight: 400, marginLeft: 4 }}>
                      D{days >= 0 ? `-${days}` : `+${Math.abs(days)}`}
                    </span>
                  )}
                </div>
                <div style={{ width: '40%', flexShrink: 0, borderLeft: '0.5px solid #e8e6df' }} />
              </div>

              {/* Deliverable rows or milestone tasks */}
              {msDeliverables.length > 0 ? msDeliverables.map(dv => {
                const bar = calcMilestoneBar(ms, columns)
                const rowHeight = Math.max(46, msTasks.length * 27 + 14)

                return (
                  <div key={dv.id} style={{
                    display: 'flex', borderBottom: '0.5px solid #f0efe8',
                    minHeight: rowHeight
                  }}>
                    {/* Left: Deliverable name */}
                    <div style={{
                      width: 160, flexShrink: 0, padding: '7px 10px 7px 26px',
                      borderRight: '0.5px solid #e8e6df',
                      display: 'flex', alignItems: 'center'
                    }}>
                      <span style={{
                        fontSize: 12, overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: '#2C2C2A'
                      }}>
                        {dv.title}
                      </span>
                    </div>

                    {/* Center: Gantt bar */}
                    <div style={{
                      flex: 1, position: 'relative', minHeight: 38,
                      borderRight: '0.5px solid #e8e6df',
                      minWidth: columns.length * 40
                    }}>
                      {bar && (
                        <div style={{
                          position: 'absolute', height: 10, top: 14, borderRadius: 3, opacity: 0.7,
                          left: `${bar.left}%`, width: `${bar.width}%`,
                          background: ms.color || '#1D9E75',
                        }} />
                      )}
                      <TodayLine columns={columns} />
                    </div>

                    {/* Right: Milestone tasks */}
                    <div style={{
                      width: '40%', flexShrink: 0, padding: '5px 12px',
                      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3,
                      ...(msTasks.length === 0 ? {
                        background: 'repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(186,117,23,.025) 10px, rgba(186,117,23,.025) 20px)'
                      } : {}),
                    }}>
                      {msTasks.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#BA7517', fontWeight: 500 }}>
                          <span>⚠ 미배정</span>
                          <button
                            onClick={() => handleAddTask(ms)}
                            style={{
                              fontSize: 11, color: '#a09f99', background: 'none',
                              border: '0.5px solid #d3d1c7', borderRadius: 3,
                              padding: '2px 8px', cursor: 'pointer'
                            }}
                          >
                            + Task 추가
                          </button>
                        </div>
                      ) : msTasks.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <div
                            onClick={() => toggleDone(t.id)}
                            style={{ cursor: 'pointer', flexShrink: 0 }}
                          >
                            <CheckIcon checked={t.category === 'done'} size={12} />
                          </div>
                          <span style={{
                            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: t.category === 'done' ? 'line-through' : 'none',
                            color: t.category === 'done' ? '#b4b2a9' : '#2C2C2A'
                          }}>
                            {t.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }) : (
                // No deliverables for this milestone
                <div style={{
                  display: 'flex', borderBottom: '0.5px solid #f0efe8', minHeight: 46
                }}>
                  <div style={{
                    width: 160, flexShrink: 0, padding: '7px 26px',
                    borderRight: '0.5px solid #e8e6df',
                    display: 'flex', alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 12, color: '#b4b2a9', fontStyle: 'italic' }}>
                      결과물 미정
                    </span>
                  </div>
                  <div style={{
                    flex: 1, position: 'relative', minHeight: 38,
                    borderRight: '0.5px solid #e8e6df',
                    minWidth: columns.length * 40
                  }}>
                    <TodayLine columns={columns} />
                  </div>
                  <div style={{
                    width: '40%', flexShrink: 0, padding: '5px 12px',
                    display: 'flex', alignItems: 'center',
                    background: 'repeating-linear-gradient(135deg, transparent, transparent 10px, rgba(186,117,23,.025) 10px, rgba(186,117,23,.025) 20px)'
                  }}>
                    <span style={{ fontSize: 12, color: '#BA7517', fontWeight: 500 }}>⚠ 미배정</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
