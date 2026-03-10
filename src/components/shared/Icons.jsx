export const CheckIcon = ({ checked, size = 18, onClick }) => (
  <div onClick={onClick} style={{ width: size, height: size, borderRadius: 4, border: checked ? 'none' : '1.5px solid #d0d0d0', background: checked ? '#2383e2' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
    {checked && <svg width={size*0.67} height={size*0.67} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </div>
)

export const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
)

export const ChevronIcon = ({ open }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}>
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 4h9M5 4V2.5h4V4M3.5 4v7.5a1 1 0 001 1h5a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export const IndentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M5 7h7M5 11h7M2 6l2.5 1.5L2 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export const OutdentIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M5 7h7M5 11h7M4.5 6L2 7.5 4.5 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5.5h5.5a3 3 0 010 6H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5.5 3L3 5.5 5.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
)

export const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="3.5" r="1" fill="currentColor"/><circle cx="9" cy="3.5" r="1" fill="currentColor"/><circle cx="5" cy="7" r="1" fill="currentColor"/><circle cx="9" cy="7" r="1" fill="currentColor"/><circle cx="5" cy="10.5" r="1" fill="currentColor"/><circle cx="9" cy="10.5" r="1" fill="currentColor"/></svg>
)

export const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5l3 3M2 9l6.5-6.5 3 3L5 12H2V9z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M13.8 4.2l-1.4 1.4M5.6 12.4l-1.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
)

export const ViewIcons = {
  today: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M9 6v3.5l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  matrix: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/></svg>,
  project: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 4h2v2H4zM7 5h7M4 8h2v2H4zM7 9h7M7 13h5M4 12h2v2H4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  timeline: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4h5M4 8h8M6 12h10M2 16h7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
}
