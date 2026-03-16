import { useState, useRef, useEffect } from 'react'

/**
 * 범용 멀티셀렉트 드롭다운
 * @param {{
 *   label: string,
 *   options: Array<{ id: string, name: string, color?: string }>,
 *   selected: string[] | null,  // null = 전체 선택
 *   onChange: (ids: string[] | null) => void,
 * }} props
 */
export default function MultiSelectFilter({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // 외부 클릭 시 닫힘
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const isAllSelected = selected === null || selected.length === options.length
  const selectedCount = selected === null ? options.length : selected.length

  function handleToggleAll() {
    if (isAllSelected) {
      // 전체 해제 → 빈 배열
      onChange([])
    } else {
      // 전체 선택 → null (전체)
      onChange(null)
    }
  }

  function handleToggleItem(id) {
    if (selected === null) {
      // 전체 선택 상태에서 하나를 끄면 → 해당 항목만 제외
      onChange(options.filter(o => o.id !== id).map(o => o.id))
    } else {
      const idx = selected.indexOf(id)
      if (idx >= 0) {
        // 선택 해제
        onChange(selected.filter(s => s !== id))
      } else {
        // 선택 추가
        const newSelected = [...selected, id]
        // 모두 선택되면 null로 전환
        if (newSelected.length === options.length) {
          onChange(null)
        } else {
          onChange(newSelected)
        }
      }
    }
  }

  function isChecked(id) {
    return selected === null || selected.includes(id)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          border: '0.5px solid #d3d1c7',
          borderRadius: 6,
          background: '#fff',
          fontSize: 12,
          color: '#2C2C2A',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span>{label}</span>
        {!isAllSelected && (
          <span style={{
            background: '#1D9E75',
            color: '#fff',
            borderRadius: 999,
            fontSize: 10,
            padding: '1px 6px',
            fontWeight: 600,
          }}>
            {selectedCount}
          </span>
        )}
        <span style={{ fontSize: 8, color: '#a09f99' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: '#fff',
          border: '0.5px solid #e8e6df',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          minWidth: 160,
          zIndex: 100,
          overflow: 'hidden',
        }}>
          {/* 전체 선택 */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            borderBottom: '0.5px solid #f0f0f0',
            fontSize: 12,
            color: '#2C2C2A',
            fontWeight: 500,
          }}>
            <Checkbox checked={isAllSelected} />
            <span>전체</span>
          </label>

          {/* 개별 항목 */}
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {options.map(opt => (
              <label
                key={opt.id}
                onClick={() => handleToggleItem(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: '#2C2C2A',
                }}
              >
                <Checkbox checked={isChecked(opt.id)} />
                {opt.color && (
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: opt.color,
                    flexShrink: 0,
                  }} />
                )}
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {opt.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Checkbox({ checked }) {
  return (
    <div style={{
      width: 14,
      height: 14,
      borderRadius: 3,
      border: checked ? 'none' : '1px solid #d3d1c7',
      background: checked ? '#1D9E75' : '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {checked && (
        <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>
      )}
    </div>
  )
}
