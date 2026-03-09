export default function Checkbox({ checked, onChange, size = 16 }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange?.() }}
      className="flex items-center justify-center rounded-[3px] border-[1.5px] cursor-pointer transition-all active:scale-[0.88] flex-none"
      style={{
        width: size,
        height: size,
        background: checked ? '#0f7b6c' : '#fff',
        borderColor: checked ? '#0f7b6c' : 'rgba(55,53,47,.3)',
      }}
    >
      {checked && <span className="text-white font-bold" style={{ fontSize: size * 0.55 }}>✓</span>}
    </div>
  )
}
