import { useState, useRef, useEffect } from 'react'
import MiniAvatar from '../views/grid/shared/MiniAvatar'

/* ═══ DualAssigneeSelector — 정/부 담당자 dual 선택 ═══ */
export default function DualAssigneeSelector({
  primaryId, secondaryId, members, onChangePrimary, onChangeSecondary,
  mode = 'full', onClose,
}) {
  const [openSection, setOpenSection] = useState(null) // null | 'primary' | 'secondary'
  const ref = useRef(null)

  // click-outside (popover 모드)
  useEffect(() => {
    if (mode !== 'popover') return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mode, onClose])

  const getMember = (id) => members.find(m => m.userId === id)
  const primaryMem = primaryId ? getMember(primaryId) : null
  const secondaryMem = secondaryId ? getMember(secondaryId) : null

  const handlePrimary = (id) => {
    if (id === secondaryId && id) {
      // 정==부 → 부를 자동 해제
      onChangeSecondary?.(null)
    }
    onChangePrimary?.(id)
    setOpenSection(null)
  }

  const handleSecondary = (id) => {
    if (id === primaryId && id) return // 부가 정과 같으면 무시
    onChangeSecondary?.(id)
    setOpenSection(null)
  }

  // ═══ Popover 모드 ═══
  if (mode === 'popover') {
    return (
      <div ref={ref} onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 100,
        width: 220, background: '#fff', border: '1px solid #e8e6df',
        borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
        padding: '6px 0', fontSize: 12,
      }}>
        {/* 정담당 섹션 */}
        <div style={{ padding: '4px 12px 4px', fontSize: 11, color: '#a09f99', fontWeight: 500 }}>정담당</div>
        <MemberOption id={null} label="미배정" isSelected={!primaryId} onClick={() => handlePrimary(null)} />
        {members.map(m => (
          <MemberOption key={m.userId} id={m.userId} label={m.displayName || '?'} isSelected={primaryId === m.userId} onClick={() => handlePrimary(m.userId)} />
        ))}
        {/* 구분선 */}
        <div style={{ borderTop: '1px solid #e8e6df', margin: '4px 0' }} />
        {/* 부담당 섹션 */}
        <div style={{ padding: '4px 12px 4px', fontSize: 11, color: '#a09f99', fontWeight: 500 }}>부담당</div>
        <MemberOption id={null} label="(없음)" isSelected={!secondaryId} onClick={() => handleSecondary(null)} />
        {members.filter(m => m.userId !== primaryId).map(m => (
          <MemberOption key={m.userId} id={m.userId} label={m.displayName || '?'} isSelected={secondaryId === m.userId} onClick={() => handleSecondary(m.userId)} />
        ))}
      </div>
    )
  }

  // ═══ Full 모드 (DetailPanel 인라인) ═══
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 정담당 */}
      <div>
        <div style={{ fontSize: 11, color: '#a09f99', marginBottom: 4 }}>정담당자</div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpenSection(openSection === 'primary' ? null : 'primary')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid #e8e6df', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#37352f', width: '100%' }}
          >
            {primaryMem ? (
              <><MiniAvatar name={primaryMem.displayName || '?'} size={16} /> {primaryMem.displayName}</>
            ) : '미배정'}
            <span style={{ marginLeft: 'auto', color: '#a09f99' }}>▾</span>
          </button>
          {openSection === 'primary' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e8e6df', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', padding: '4px 0', marginTop: 2 }}>
              <MemberOption id={null} label="미배정" isSelected={!primaryId} onClick={() => handlePrimary(null)} />
              {members.map(m => <MemberOption key={m.userId} id={m.userId} label={m.displayName || '?'} isSelected={primaryId === m.userId} onClick={() => handlePrimary(m.userId)} />)}
            </div>
          )}
        </div>
      </div>

      {/* 부담당 */}
      <div>
        <div style={{ fontSize: 11, color: '#a09f99', marginBottom: 4 }}>부담당자 (선택)</div>
        {secondaryId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            <button
              onClick={() => setOpenSection(openSection === 'secondary' ? null : 'secondary')}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid #e8e6df', borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#37352f' }}
            >
              {secondaryMem ? (
                <><MiniAvatar name={secondaryMem.displayName || '?'} size={16} /> {secondaryMem.displayName}</>
              ) : '?'}
              <span style={{ marginLeft: 'auto', color: '#a09f99' }}>▾</span>
            </button>
            <button onClick={() => onChangeSecondary?.(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ccc', fontSize: 14, padding: 2 }}
              onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
              onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
            >×</button>
            {openSection === 'secondary' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e8e6df', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', padding: '4px 0', marginTop: 2 }}>
                <MemberOption id={null} label="(없음)" isSelected={false} onClick={() => handleSecondary(null)} />
                {members.filter(m => m.userId !== primaryId).map(m => <MemberOption key={m.userId} id={m.userId} label={m.displayName || '?'} isSelected={secondaryId === m.userId} onClick={() => handleSecondary(m.userId)} />)}
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setOpenSection(openSection === 'secondary' ? null : 'secondary')}
            style={{ padding: '4px 10px', border: '1px dashed #e8e6df', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#a09f99', width: '100%' }}
          >+ 부담당자 추가</button>
        )}
        {!secondaryId && openSection === 'secondary' && (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e8e6df', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.1)', padding: '4px 0', marginTop: 2 }}>
              {members.filter(m => m.userId !== primaryId).map(m => <MemberOption key={m.userId} id={m.userId} label={m.displayName || '?'} isSelected={false} onClick={() => handleSecondary(m.userId)} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MemberOption({ id, label, isSelected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
        background: isSelected ? '#f5f4f0' : 'transparent', fontSize: 12,
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ width: 14, display: 'flex', justifyContent: 'center' }}>
        {isSelected ? '◉' : '○'}
      </span>
      <span style={{ color: isSelected ? '#2C2C2A' : '#6b6a66', fontWeight: isSelected ? 500 : 400 }}>{label}</span>
    </div>
  )
}
