import { useRef, useCallback, useLayoutEffect } from 'react'
import { getBulletStyle } from '../../utils/colors'
import { OutdentIcon, IndentIcon, TrashIcon } from './Icons'

const MAX_LEVEL = 9

function autoResize(el) {
  if (!el) return
  el.style.height = '0'
  el.style.height = el.scrollHeight + 'px'
}

export default function OutlinerRow({ node, idx, accentColor, inputRef, onTextChange, onKeyDown, onPaste, onDelete, onChangeLevel, showPlaceholder, hasChildren, isCollapsed, onToggleCollapse, selected, onMouseDown }) {
  const localRef = useRef(null)
  const isMobile = window.innerWidth < 768
  // 불릿포인트: 데스크탑 14px, 모바일 13px (할일 제목과 동일)
  const fontSize = isMobile ? 13 : 14

  const setRef = useCallback((el) => {
    localRef.current = el
    if (typeof inputRef === 'function') inputRef(el)
    else if (inputRef) inputRef.current = el
    autoResize(el)
  }, [inputRef])

  useLayoutEffect(() => {
    autoResize(localRef.current)
  })

  const bulletStyle = getBulletStyle(node.level, accentColor)

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 0, paddingLeft: node.level * 22, minHeight: 30,
        background: selected ? 'rgba(55, 53, 47, 0.06)' : 'transparent',
        borderRadius: selected ? 3 : 0,
      }}
      className="bullet-row"
    >
      <div
        onClick={hasChildren ? onToggleCollapse : undefined}
        style={{ width: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, height: 28, cursor: hasChildren ? 'pointer' : 'default' }}
      >
        {hasChildren ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}>
            <path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke={accentColor || '#999'} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : bulletStyle ? (
          <div style={bulletStyle} />
        ) : (
          <span style={{ fontSize: 12, color: accentColor || '#999', fontWeight: 500, lineHeight: 1 }}>-</span>
        )}
      </div>
      <textarea
        ref={setRef}
        data-task-title
        value={node.text}
        rows={1}
        onChange={e => { onTextChange(idx, e.target.value); autoResize(e.target) }}
        onKeyDown={e => onKeyDown(e, idx)}
        onPaste={e => onPaste?.(e, idx)}
        onFocus={e => autoResize(e.target)}
        placeholder={showPlaceholder ? '노트를 입력하세요...' : ''}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize, lineHeight: isMobile ? '20px' : '22px', padding: '3px 4px', fontFamily: 'inherit', color: '#37352f', boxSizing: 'border-box', resize: 'none', overflow: 'hidden', display: 'block', fontWeight: 400 }}
      />
      <div style={{ display: 'flex', gap: 1, opacity: 0, transition: 'opacity 0.12s', flexShrink: 0, height: 28, alignItems: 'center' }} className="bullet-actions">
        {node.level > 0 && (
          <button onClick={() => onChangeLevel(idx, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}>
            <OutdentIcon />
          </button>
        )}
        {node.level < MAX_LEVEL && idx > 0 && (
          <button onClick={() => onChangeLevel(idx, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', padding: 2, display: 'flex' }}>
            <IndentIcon />
          </button>
        )}
        <button onClick={() => onDelete(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dbb', padding: 2, display: 'flex' }}>
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}
