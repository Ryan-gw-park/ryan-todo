import useStore from '../../store/useStore'

export default function Toast() {
  const toastMsg = useStore(s => s.toastMsg)

  return (
    <div
      className={`fixed left-1/2 z-[999] bg-[rgb(36,35,30)] text-white/90 px-3.5 py-[7px] rounded-md text-xs font-medium whitespace-nowrap pointer-events-none shadow-[rgba(15,15,15,.25)_0_3px_12px] transition-transform duration-200 ${
        toastMsg ? '-translate-x-1/2 translate-y-0' : '-translate-x-1/2 translate-y-[60px]'
      }`}
      style={{ bottom: '24px' }}
    >
      {toastMsg}
    </div>
  )
}
