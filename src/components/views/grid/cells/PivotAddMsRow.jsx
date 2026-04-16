import { useState } from 'react'
import useStore from '../../../../hooks/useStore'
import { COLOR, PIVOT } from '../../../../styles/designTokens'

/* ═════════════════════════════════════════════
   PivotAddMsRow — 펼친 프로젝트 내 "+ 마일스톤" 추가 행
   MS sub-row 목록 끝, ungrouped sub-row 위에 위치.
   hover 시 노출, 클릭 → inline input → Enter로 생성.
   colSpan = 전체 컬럼 수 (첫 컬럼 포함)
   ═════════════════════════════════════════════ */
export default function PivotAddMsRow({ projectId, colSpan }) {
  const addMilestoneInProject = useStore(s => s.addMilestoneInProject)
  const [hover, setHover] = useState(false)
  const [adding, setAdding] = useState(false)

  const handleFinish = async (value) => {
    setAdding(false)
    const title = (value ?? '').trim()
    if (!title) return
    await addMilestoneInProject(projectId, { title })
  }

  if (!adding && !hover) {
    return (
      <tr
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ height: 4 }}
      >
        <td colSpan={colSpan} />
      </tr>
    )
  }

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { if (!adding) setHover(false) }}
      style={{ background: PIVOT.msSubRowBg }}
    >
      <td
        colSpan={colSpan}
        style={{
          padding: '4px 12px 4px 24px',
          borderBottom: `1px solid ${COLOR.border}`,
        }}
      >
        {adding ? (
          <input
            autoFocus
            placeholder="마일스톤 제목"
            style={{
              width: 200,
              fontSize: 12,
              border: `1px solid ${COLOR.border}`,
              borderRadius: 4,
              padding: '2px 6px',
              fontFamily: 'inherit',
              color: COLOR.textPrimary,
            }}
            onBlur={e => handleFinish(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleFinish(e.target.value)
              if (e.key === 'Escape') { setAdding(false); setHover(false) }
            }}
          />
        ) : (
          <span
            onClick={() => setAdding(true)}
            style={{ fontSize: 11, color: COLOR.textTertiary, cursor: 'pointer' }}
          >+ 마일스톤</span>
        )}
      </td>
    </tr>
  )
}
