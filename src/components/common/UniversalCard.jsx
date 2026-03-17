import { useState } from 'react'
import TitleZone from './TitleZone'
import StatusZone from './StatusZone'
import DetailZone from './DetailZone'
import { getContrastTextColor } from '../../utils/colors'

/**
 * UniversalCard — 프로젝트/마일스톤/할일 공통 카드 컴포넌트
 *
 * @param {string} type - 'task' | 'milestone' | 'project'
 * @param {object} data - { id, name, color, done }
 * @param {boolean} expanded - 펼침 상태
 * @param {function} onToggleExpand - 펼치기/접기 콜백
 * @param {function} onTitleSave - (newText) => void
 * @param {function} onStatusToggle - () => void (할일=toggleDone)
 * @param {function} onDetailOpen - () => void
 * @param {function} renderMeta - () => ReactNode
 * @param {function} renderExpanded - () => ReactNode
 * @param {boolean} compact - 축소 모드
 * @param {boolean} allowWrap - 제목 2줄 줄바꿈 허용 (매트릭스용)
 * @param {string} className - 추가 CSS 클래스
 * @param {object} style - 추가 인라인 스타일 (background 있으면 텍스트 색상 자동 계산)
 *
 * DnD passthrough (from useSortable):
 * @param {function} dragRef - ref
 * @param {object} dragStyle - transform style
 * @param {object} dragListeners - event listeners
 * @param {object} dragAttributes - ARIA attributes
 * @param {boolean} isDragging - 드래그 중 여부
 */
export default function UniversalCard({
  type, data,
  expanded, onToggleExpand,
  onTitleSave, onStatusToggle, onDetailOpen,
  renderMeta, renderExpanded,
  compact = false,
  allowWrap = false,
  className = '', style: extraStyle,
  // DnD passthrough
  dragRef, dragStyle, dragListeners, dragAttributes, isDragging,
}) {
  const [hovered, setHovered] = useState(false)

  // 배경색 기반 텍스트 색상 자동 계산
  const bgColor = extraStyle?.background
  const textColor = getContrastTextColor(bgColor)

  const handleBodyClick = (e) => {
    // 제목/상태/상세 영역에서 stopPropagation 했으므로 여기까지 오면 본문 클릭
    onToggleExpand?.()
  }

  return (
    <div
      ref={dragRef}
      className={className}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleBodyClick}
      {...dragAttributes}
      {...dragListeners}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: compact ? 28 : 36,
        borderRadius: 6,
        transition: 'background 0.1s',
        position: 'relative',
        background: hovered ? 'rgba(0,0,0,0.02)' : 'transparent',
        opacity: isDragging ? 0.3 : 1,
        cursor: 'default',
        ...dragStyle,
        ...extraStyle,
      }}
    >
      {/* Zone 1: 상태 영역 (좌측) */}
      <StatusZone type={type} data={data} onToggle={onStatusToggle} />

      {/* Zone 2+3: 제목 + 본문 (중앙) */}
      <div style={{
        flex: 1, minWidth: 0,
        padding: compact ? '4px 0' : '6px 0',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {/* Zone 2: 제목 */}
        <TitleZone
          name={data.name}
          onSave={onTitleSave}
          compact={compact}
          textColor={textColor}
          allowWrap={allowWrap}
        />

        {/* 메타 행 */}
        {renderMeta && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            marginTop: 2, flexWrap: 'wrap',
          }}>
            {renderMeta()}
          </div>
        )}

        {/* Zone 3: 펼침 내용 */}
        {expanded && renderExpanded && (
          <div style={{
            marginTop: 6, paddingTop: 6,
            borderTop: '0.5px solid #f0efe8',
          }}>
            {renderExpanded()}
          </div>
        )}
      </div>

      {/* Zone 4: 상세 아이콘 (우측) */}
      {onDetailOpen && (
        <DetailZone onOpen={onDetailOpen} visible={hovered} />
      )}
    </div>
  )
}
