import useStore from '../../store/useStore'

const TABS = [
  { id: 'today', icon: '☀️', label: '오늘할일' },
  { id: 'all', icon: '📋', label: '전체할일' },
  { id: 'matrix', icon: '⊞', label: '매트릭스' },
  { id: 'board', icon: '▦', label: '보드' },
]

export default function BottomNav() {
  const { currentView, setView, openModal } = useStore()

  return (
    <>
      <nav className="flex md:hidden flex-none items-center justify-around bg-white/95 backdrop-blur-xl border-t border-[rgba(55,53,47,.09)] z-50"
           style={{ height: 'calc(56px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-[5px] rounded border-none bg-transparent cursor-pointer text-[9px] font-medium min-w-[56px] transition-colors
              ${currentView === t.id ? 'text-[#2383e2]' : 'text-[rgba(55,53,47,.4)]'}`}
          >
            <span className="text-lg leading-tight">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
      <button
        onClick={() => openModal()}
        className="flex md:hidden fixed right-4 z-[49] w-[50px] h-[50px] rounded-full bg-[#2383e2] text-white border-none text-[26px] cursor-pointer items-center justify-center shadow-[0_4px_18px_rgba(35,131,226,.45)] active:scale-[0.92] transition-transform leading-none"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 10px)' }}
      >
        +
      </button>
    </>
  )
}
