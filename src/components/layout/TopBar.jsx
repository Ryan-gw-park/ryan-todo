import useStore from '../../store/useStore'

const VIEWS = [
  { id: 'today', label: '오늘할일', icon: '☀️' },
  { id: 'matrix', label: '매트릭스', icon: '⊞' },
  { id: 'all', label: '전체할일', icon: '📋' },
  { id: 'board', label: '보드', icon: '▦' },
  { id: 'table', label: '테이블', icon: '▤' },
  { id: 'gantt', label: '타임라인', icon: '📅' },
]

export default function TopBar() {
  const { currentView, setView, syncStatus, openModal } = useStore()

  const now = new Date()
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} (${days[now.getDay()]})`

  return (
    <div className="hidden md:flex flex-none h-11 bg-white border-b border-[rgba(55,53,47,.09)] items-center px-4 gap-2 z-50">
      <div className="flex items-center gap-[7px] text-sm font-semibold text-[rgb(55,53,47)]">
        <span className="text-[15px] opacity-70">📋</span>
        Ryan Todo
      </div>
      <div className="flex-1" />
      <span className="text-xs text-[rgba(55,53,47,.4)] font-normal">{dateStr}</span>
      <div className="flex items-center gap-[1px]">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-2.5 py-1 text-[13px] font-normal border-none bg-transparent rounded cursor-pointer whitespace-nowrap transition-all duration-100
              ${currentView === v.id
                ? 'bg-[rgba(55,53,47,.08)] text-[rgb(55,53,47)] font-medium'
                : 'text-[rgba(55,53,47,.65)] hover:bg-[rgba(55,53,47,.04)] hover:text-[rgb(55,53,47)]'
              }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 text-[11px] text-[rgba(55,53,47,.4)] px-1">
        <div className={`w-[5px] h-[5px] rounded-full ${
          syncStatus === 'syncing' ? 'bg-orange-500 animate-pulse' :
          syncStatus === 'error' ? 'bg-red-500' : 'bg-green-600'
        }`} />
        <span className="text-[10px]">
          {syncStatus === 'syncing' ? '동기화 중' : syncStatus === 'error' ? '오류' : '동기화됨'}
        </span>
      </div>
      <button
        onClick={() => openModal()}
        className="flex items-center gap-0 bg-[#2383e2] text-white border-none rounded-md text-[13px] font-medium cursor-pointer whitespace-nowrap overflow-hidden"
      >
        <span className="px-3 py-[5px] border-r border-white/25 hover:bg-white/10">+ 새 할일</span>
        <span className="px-2 py-[5px] text-[11px] hover:bg-white/10">▾</span>
      </button>
    </div>
  )
}
