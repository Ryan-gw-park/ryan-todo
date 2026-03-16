import { useMemo } from 'react'
import { useProjectTimelineData } from '../../../hooks/useProjectTimelineData'

// Date utilities
function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24))
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isDateInWeek(dateStr, weekStart) {
  if (!dateStr) return false
  const date = new Date(dateStr)
  const ws = new Date(weekStart)
  const we = new Date(ws)
  we.setDate(ws.getDate() + 6)
  return date >= ws && date <= we
}

// Generate week columns (-1 month ~ +3 months)
function generateWeekColumns() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const start = new Date(today)
  start.setMonth(start.getMonth() - 1)
  const end = new Date(today)
  end.setMonth(end.getMonth() + 3)

  const columns = []
  let cursor = new Date(start)
  // Align to Monday
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

// Calculate milestone bar position
function calcMilestoneBar(ms, columns) {
  if (!ms.start_date && !ms.end_date) return null
  const start = ms.start_date || ms.end_date
  const end = ms.end_date || ms.start_date

  let startIdx = columns.findIndex(c => isDateInWeek(start, c.weekStart))
  let endIdx = columns.findIndex(c => isDateInWeek(end, c.weekStart))

  // Handle dates outside range
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

// Skeleton loading
function Skeleton() {
  return (
    <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center', fontSize: 14 }}>
      로딩 중...
    </div>
  )
}

export default function GanttMode({ projectId }) {
  const { milestones, loading } = useProjectTimelineData(projectId)
  const columns = useMemo(() => generateWeekColumns(), [])

  if (loading) return <Skeleton />

  if (milestones.length === 0) {
    return (
      <div style={{ padding: 40, color: '#b4b2a9', textAlign: 'center', fontSize: 14 }}>
        마일스톤이 없습니다. Key Milestone 탭에서 마일스톤을 추가하세요.
      </div>
    )
  }

  const todayIdx = columns.findIndex(c => c.isToday)

  return (
    <div style={{ overflow: 'auto', padding: '16px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: columns.length * 50 + 220, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={{
              textAlign: 'left', paddingLeft: 12, width: 220,
              fontSize: 11, color: '#a09f99', fontWeight: 600,
              borderBottom: '1px solid #e8e6df',
              position: 'sticky', left: 0, background: '#fff', zIndex: 2
            }}>
              마일스톤
            </th>
            {columns.map((col, i) => (
              <th key={i} style={{
                width: 50, minWidth: 50, textAlign: 'center', padding: '6px 2px',
                fontSize: 10, fontWeight: col.isToday ? 600 : 400,
                color: col.isToday ? '#378ADD' : '#b4b2a9',
                background: col.isToday ? 'rgba(55,138,221,.04)' : 'transparent',
                borderBottom: '1px solid #e8e6df',
              }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {milestones.map((ms, idx) => {
            const bar = calcMilestoneBar(ms, columns)
            const days = daysUntil(ms.end_date)
            const isUrgent = days !== null && days <= 7 && days >= 0

            return (
              <tr key={ms.id}>
                <td style={{
                  padding: '8px 12px',
                  borderRight: '0.5px solid #e8e6df',
                  borderBottom: '0.5px solid #f0f0f0',
                  position: 'sticky', left: 0, background: '#fff', zIndex: 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#b4b2a9', fontWeight: 600, minWidth: 20, fontSize: 12 }}>
                      {(ms.sort_order ?? idx) + 1}
                    </span>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: ms.color || '#1D9E75', flexShrink: 0 }} />
                    <span style={{
                      fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: '#2C2C2A'
                    }}>
                      {ms.title}
                    </span>
                    {isUrgent && (
                      <span style={{
                        fontSize: 10, background: '#FAEEDA', color: '#854F0B',
                        padding: '1px 5px', borderRadius: 2, fontWeight: 600
                      }}>
                        임박
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#b4b2a9', marginLeft: 'auto', flexShrink: 0 }}>
                      {ms.end_date ? formatShortDate(ms.end_date) : ''}
                    </span>
                  </div>
                </td>
                <td colSpan={columns.length} style={{
                  padding: 0,
                  borderBottom: '0.5px solid #f0f0f0',
                  position: 'relative',
                  height: 38,
                }}>
                  {/* Today column backgrounds */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
                    {columns.map((col, i) => (
                      <div key={i} style={{
                        flex: 1,
                        background: col.isToday ? 'rgba(55,138,221,.04)' : 'transparent',
                      }} />
                    ))}
                  </div>
                  {/* Gantt bar */}
                  {bar && (
                    <div style={{
                      position: 'absolute', height: 10, top: 14, borderRadius: 3, opacity: 0.85,
                      left: `${bar.left}%`, width: `${bar.width}%`,
                      background: ms.color || '#1D9E75',
                      zIndex: 2,
                    }} />
                  )}
                  {/* Today line */}
                  {todayIdx >= 0 && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0,
                      left: `${((todayIdx + 0.5) / columns.length) * 100}%`, width: 1.5,
                      background: '#378ADD', zIndex: 3, opacity: 0.45,
                    }} />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
