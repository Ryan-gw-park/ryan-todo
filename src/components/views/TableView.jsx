import useStore from '../../store/useStore'
import Checkbox from '../shared/Checkbox'

function fmt(s) {
  if (!s) return '—'
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(s); d.setHours(0,0,0,0)
  const diff = Math.floor((d - today) / 86400000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'
  if (diff < 0) return `${Math.abs(diff)}일 초과`
  return `${d.getMonth()+1}/${d.getDate()}`
}
function isOverdue(s) {
  if (!s) return false
  const today = new Date(); today.setHours(0,0,0,0)
  const d = new Date(s); d.setHours(0,0,0,0)
  return d < today
}

export default function TableView() {
  const { tasks, projects, categories, toggleDone, openDetail, deleteTask } = useStore()

  const sorted = [...tasks].sort((a, b) =>
    a.categoryId !== b.categoryId ? a.categoryId.localeCompare(b.categoryId) : a.projectId.localeCompare(b.projectId)
  )

  return (
    <div className="p-3 md:p-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse bg-white rounded-lg overflow-hidden border border-[rgba(55,53,47,.09)] shadow-[rgba(15,15,15,.05)_0_1px_2px,rgba(15,15,15,.05)_0_0_0_1px]">
          <thead>
            <tr className="bg-[#f7f6f3] border-b border-[rgba(55,53,47,.09)]">
              <th className="py-[7px] px-[13px] text-left text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider w-6" />
              <th className="py-[7px] px-[13px] text-left text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider">할 일</th>
              <th className="py-[7px] px-[13px] text-left text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider">프로젝트</th>
              <th className="py-[7px] px-[13px] text-left text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider">구분</th>
              <th className="py-[7px] px-[13px] text-left text-[10px] font-semibold text-[rgba(55,53,47,.4)] uppercase tracking-wider">마감일</th>
              <th className="py-[7px] px-[13px] w-[46px]" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const p = projects.find(x => x.id === t.projectId) || { name: '?', color: '#ccc' }
              const cat = categories.find(x => x.id === t.categoryId) || { name: '?', color: '#999', bg: 'rgba(0,0,0,.05)' }
              return (
                <tr
                  key={t.id}
                  className={`border-b border-[rgba(55,53,47,.09)] last:border-b-0 transition-colors cursor-pointer hover:bg-[rgba(55,53,47,.04)] group ${t.done ? 'opacity-40' : ''}`}
                  onClick={() => openDetail(t.id)}
                >
                  <td className="py-2 px-[13px]" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={t.done} onChange={() => toggleDone(t.id)} size={14} />
                  </td>
                  <td className="py-2 px-[13px] text-[13px]">
                    <span className={t.done ? 'line-through' : ''}>{t.text}</span>
                  </td>
                  <td className="py-2 px-[13px]">
                    <span className="inline-flex items-center px-[7px] py-[2px] rounded-[3px] text-[11px] font-medium" style={{ background: `${p.color}28` }}>{p.name}</span>
                  </td>
                  <td className="py-2 px-[13px]">
                    <span className="inline-flex items-center px-[7px] py-[2px] rounded-[3px] text-[11px] font-medium" style={{ background: cat.bg || `${cat.color}10`, color: cat.color }}>{cat.name}</span>
                  </td>
                  <td className={`py-2 px-[13px] text-xs ${isOverdue(t.dueDate) ? 'text-red-600' : 'text-[rgba(55,53,47,.65)]'}`}>
                    {fmt(t.dueDate)}
                  </td>
                  <td className="py-2 px-[13px]" onClick={e => e.stopPropagation()}>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { if (confirm('삭제할까요?')) deleteTask(t.id) }}
                        className="px-[5px] py-[2px] rounded border-none bg-transparent cursor-pointer text-[11px] text-[rgba(55,53,47,.65)] hover:bg-[rgba(224,62,62,.08)] hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
