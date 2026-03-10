import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'

export default function TimelineView() {
  const { projects, tasks } = useStore()
  const isMobile = window.innerWidth < 768

  const dd = new Date()
  const currentDay = dd.getDate()

  // Generate day columns for current month
  const year = dd.getFullYear()
  const month = dd.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#37352f', margin: 0 }}>타임라인 뷰</h1>
          <p style={{ fontSize: 14, color: '#999', marginTop: 4 }}>{year}년 {month + 1}월</p>
        </div>

        {/* Day header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e8e8e8', marginBottom: 16, paddingLeft: 140, overflow: 'auto' }}>
          {days.map(d => (
            <div key={d} style={{ minWidth: 40, textAlign: 'center', fontSize: 11, color: d === currentDay ? '#37352f' : '#bbb', paddingBottom: 8, fontWeight: d === currentDay ? 600 : 400, borderBottom: d === currentDay ? '2px solid #37352f' : 'none' }}>{d}</div>
          ))}
        </div>

        {/* Project rows */}
        {projects.map(p => {
          const c = getColor(p.color)
          const activeTasks = tasks.filter(t => t.projectId === p.id && t.category !== 'done')
          if (!activeTasks.length) return null

          return (
            <div key={p.id} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: c.dot }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: c.text }}>{p.name}</span>
              </div>
              {activeTasks.map(task => {
                // Parse dates to get day positions
                let barLeft = 0, barWidth = 80
                if (task.startDate || task.dueDate) {
                  const start = task.startDate ? new Date(task.startDate).getDate() : task.dueDate ? new Date(task.dueDate).getDate() : currentDay
                  const end = task.dueDate ? new Date(task.dueDate).getDate() : start
                  barLeft = (start - 1) * 40
                  barWidth = Math.max((end - start + 1) * 40, 40)
                }

                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', height: 28 }}>
                    <div style={{ width: 140, fontSize: 12, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{task.text}</div>
                    <div style={{ flex: 1, position: 'relative', height: 20 }}>
                      <div style={{ position: 'absolute', left: barLeft, width: barWidth, height: 20, background: c.header, borderRadius: 4, border: `1px solid ${c.dot}30`, display: 'flex', alignItems: 'center', paddingLeft: 8, fontSize: 11, color: c.text, fontWeight: 500 }}>
                        {task.dueDate && <span>{task.dueDate.slice(5)}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {!projects.length && (
          <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>프로젝트를 추가하면 타임라인이 표시됩니다</div>
        )}
      </div>
    </div>
  )
}
