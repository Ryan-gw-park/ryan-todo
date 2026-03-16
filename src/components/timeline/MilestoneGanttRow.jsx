/**
 * 타임라인 뷰의 마일스톤 그룹 헤더 행
 * - 좌측: 접기/펼치기 화살표 + 색상 dot + 마일스톤 제목
 * - 우측(간트 영역): 반투명 마일스톤 바
 */
export default function MilestoneGanttRow({
  milestone,
  collapsed,
  onToggle,
  hasChildren,
  isBacklog = false,
  // 간트 바 계산용
  columns,
  colW,
  dateToCol,
  todayCol,
  rowH = 30,
}) {
  const color = milestone.color || '#b4b2a9'

  // 마일스톤 바 위치 계산
  const startCol = dateToCol?.(milestone.start_date)
  const endCol = dateToCol?.(milestone.end_date)
  const hasStart = startCol >= 0
  const hasEnd = endCol >= 0

  let barLeft = null, barWidth = null
  if (hasStart && hasEnd) {
    barLeft = startCol * colW
    barWidth = (endCol - startCol + 1) * colW
  } else if (hasStart) {
    barLeft = startCol * colW
    barWidth = colW
  } else if (hasEnd) {
    barLeft = endCol * colW
    barWidth = colW
  }

  return {
    // 좌측 패널용 행
    LeftRow: (
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '6px 4px 6px 20px',
          cursor: hasChildren ? 'pointer' : 'default',
          height: rowH,
          boxSizing: 'border-box',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
        }}
      >
        {hasChildren ? (
          <span style={{
            fontSize: 9,
            color: '#a09f99',
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
            flexShrink: 0,
            width: 10,
          }}>
            ▾
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <div style={{
          width: 7,
          height: 7,
          borderRadius: 2,
          background: isBacklog ? '#b4b2a9' : color,
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: isBacklog ? '#a09f99' : '#555',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontStyle: isBacklog ? 'italic' : 'normal',
        }}>
          {milestone.title || '제목 없음'}
        </span>
      </div>
    ),

    // 우측 간트 영역용 행
    RightRow: columns && colW ? (
      <div style={{
        height: rowH,
        position: 'relative',
        background: '#fafafa',
      }}>
        {/* 주말 shading은 상위에서 처리 */}

        {/* Today line */}
        {todayCol >= 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: todayCol * colW + colW / 2 - 1,
            width: 2,
            background: '#ef4444',
            zIndex: 1,
            pointerEvents: 'none',
            opacity: 0.35,
          }} />
        )}

        {/* 마일스톤 바 (반투명) */}
        {barLeft !== null && barWidth !== null && !isBacklog && (
          <div style={{
            position: 'absolute',
            left: barLeft,
            width: barWidth,
            height: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            borderRadius: 3,
            background: `${color}30`, // ~19% opacity
            border: `1px solid ${color}50`, // ~31% opacity
            zIndex: 2,
          }} />
        )}
      </div>
    ) : null,
  }
}

/**
 * 간트 영역에서 마일스톤 바만 렌더링하는 간단한 버전
 */
export function MilestoneBar({ milestone, columns, colW, dateToCol, rowH = 30 }) {
  const color = milestone.color || '#b4b2a9'

  const startCol = dateToCol?.(milestone.start_date)
  const endCol = dateToCol?.(milestone.end_date)
  const hasStart = startCol >= 0
  const hasEnd = endCol >= 0

  let barLeft = null, barWidth = null
  if (hasStart && hasEnd) {
    barLeft = startCol * colW
    barWidth = (endCol - startCol + 1) * colW
  } else if (hasStart) {
    barLeft = startCol * colW
    barWidth = colW
  } else if (hasEnd) {
    barLeft = endCol * colW
    barWidth = colW
  }

  if (barLeft === null || barWidth === null) return null

  return (
    <div style={{
      position: 'absolute',
      left: barLeft,
      width: barWidth,
      height: rowH - 6,
      top: 3,
      borderRadius: 3,
      background: `${color}30`,
      border: `1px solid ${color}50`,
      zIndex: 2,
    }} />
  )
}
