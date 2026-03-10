import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import TaskItem from '../shared/TaskItem'
import InlineAdd from '../shared/InlineAdd'

export default function TodayView() {
  const { projects, tasks } = useStore()
  const isMobile = window.innerWidth < 768

  const greetingEmoji = () => { const h = new Date().getHours(); return h < 12 ? '☀️' : h < 18 ? '🌤' : '🌙' }
  const dd = new Date()
  const dateStr = `${dd.getFullYear()}년 ${dd.getMonth()+1}월 ${dd.getDate()}일 ${['일','월','화','수','목','금','토'][dd.getDay()]}요일`

  return (
    <div style={{ padding: isMobile ? '20px 16px 100px' : '40px 48px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#37352f', margin: 0 }}>{greetingEmoji()} 좋은 하루 되세요, Ryan</h1>
          <p style={{ fontSize: 14, color: '#999', marginTop: 6 }}>{dateStr}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 16 }}>
          {projects.map(p => {
            const c = getColor(p.color)
            const todayTasks = tasks.filter(t => t.projectId === p.id && t.category === 'today')
            return (
              <div key={p.id} style={{ background: c.card, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ background: c.header, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: c.dot }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: c.text, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '2px 8px', fontWeight: 600, marginLeft: 'auto' }}>{todayTasks.length}</span>
                </div>
                <div style={{ padding: '10px 16px' }}>
                  {todayTasks.length === 0 ? (
                    <div style={{ padding: '12px 0', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, color: '#bbb', marginBottom: 8 }}>오늘 할 일이 없습니다</div>
                      <InlineAdd projectId={p.id} category="today" color={c} />
                    </div>
                  ) : (
                    <>
                      {todayTasks.map(tk => <TaskItem key={tk.id} task={tk} color={c} />)}
                      <InlineAdd projectId={p.id} category="today" color={c} />
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
