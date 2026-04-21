// Commit 8에서 확장됨 — useDroppable + 내용 렌더 + × 버튼 + R18 하이라이트
export default function ScheduleCell({ userId, dateISO }) {
  return <div data-cell={`${userId}:${dateISO}`} style={{ minHeight: 120 }} />
}
