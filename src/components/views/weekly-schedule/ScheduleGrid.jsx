import { COLOR } from '../../../styles/designTokens'

// Commit 8에서 확장됨 — 멤버×요일 그리드
export default function ScheduleGrid({ weekLabel, members }) {
  return (
    <div style={{ flex: 1, padding: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: COLOR.textPrimary }}>{weekLabel}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: COLOR.textSecondary }}>
        팀 멤버: {members?.length || 0}명
      </div>
    </div>
  )
}
