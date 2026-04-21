/**
 * DragOverlay 내용. 2deg rotate + shadow.
 * Task: 흰 배경 + 프로젝트 색 border
 * MS: 보라 배지 스타일 (#EEEDFE / #534AB7)
 */
export default function DragPreview({ item }) {
  if (!item) return null
  const isMS = item.kind === 'ms'
  return (
    <div style={{
      padding: '4px 10px',
      border: `1px solid ${isMS ? '#534AB7' : (item.projectColor || '#3182CE')}`,
      borderRadius: 6,
      transform: 'rotate(2deg)',
      background: isMS ? '#EEEDFE' : '#ffffff',
      color: isMS ? '#534AB7' : '#2c2c2a',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      fontSize: 13,
      fontWeight: isMS ? 500 : 400,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      maxWidth: 260,
    }}>
      {item.title}
    </div>
  )
}
