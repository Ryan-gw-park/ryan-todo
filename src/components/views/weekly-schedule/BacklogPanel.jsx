import { COLOR } from '../../../styles/designTokens'

// Commit 7에서 확장됨 — 토글/검색/트리/useDroppable
export default function BacklogPanel() {
  return (
    <div style={{
      width: 230,
      flexShrink: 0,
      background: COLOR.bgSurface,
      borderRight: `0.5px solid ${COLOR.border}`,
      padding: 12,
      fontSize: 13,
      color: COLOR.textSecondary,
    }}>
      백로그
    </div>
  )
}
