import { useCallback, useState } from 'react'
import { COLOR } from '../../../styles/designTokens'
import MobileTaskRow from './MobileTaskRow'

// 모바일 탭별 펼침 상태 영속.
// 기존 usePivotExpandState 는 scope 키가 enum 으로 고정되어 있어
// 모바일 3-탭 별 분리 저장이 안 됨. 동일 패턴을 mobile-local 로 작은 hook 으로 둠.
const STORAGE_PREFIX = 'mobilePersonalExpand:'
function readLS(key) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key) || '{}') }
  catch { return {} }
}
function writeLS(key, obj) {
  try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(obj)) }
  catch { /* noop */ }
}

function useExpandState(scope) {
  const [collapsed, setCollapsedState] = useState(() => readLS(scope))
  const setCollapsed = useCallback((key, value) => {
    setCollapsedState(prev => {
      const next = { ...prev, [key]: value }
      writeLS(scope, next)
      return next
    })
  }, [scope])
  return { collapsed, setCollapsed }
}

function totalTaskCount(section) {
  if (section.tasks) return section.tasks.length
  if (section.subGroups) {
    return section.subGroups.reduce((sum, g) => sum + (g.tasks?.length || 0), 0)
  }
  return 0
}

function SubGroupHeader({ title }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: COLOR.textSecondary,
        padding: '8px 16px 4px 24px',
        background: '#fff',
        wordBreak: 'keep-all',
      }}
    >
      {title}
    </div>
  )
}

export default function MobileTaskListView({ sections, expandScope, emptyStateText }) {
  const { collapsed, setCollapsed } = useExpandState(expandScope)

  if (!sections || sections.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: COLOR.textTertiary,
          fontSize: 13,
        }}
      >
        {emptyStateText}
      </div>
    )
  }

  return (
    <div>
      {sections.map(section => {
        const count = totalTaskCount(section)
        // 기본 펼침 규칙: 태스크 있는 섹션은 펼침, 0건은 접힘 (원본 라인 27-32)
        const explicit = collapsed[section.key]
        const expanded = explicit === true ? true
          : explicit === false ? false
          : count > 0
        const toggle = () => setCollapsed(section.key, !expanded)

        return (
          <div key={section.key} style={{ borderBottom: `1px solid ${COLOR.border}` }}>
            <div
              onClick={toggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 12, color: COLOR.textSecondary, width: 12 }}>
                {expanded ? '▼' : '▶'}
              </span>
              {section.accent && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: section.accent,
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: COLOR.textPrimary,
                  flex: 1,
                  minWidth: 0,
                  wordBreak: 'keep-all',
                }}
              >
                {section.title}
              </span>
              <span style={{ fontSize: 12, color: COLOR.textTertiary }}>
                {count}건
              </span>
            </div>

            {expanded && count === 0 && (
              <div
                style={{
                  padding: '10px 16px 14px 36px',
                  fontSize: 12,
                  color: COLOR.textTertiary,
                }}
              >
                할일 없음
              </div>
            )}

            {expanded && section.tasks && section.tasks.map(task => (
              <MobileTaskRow key={task.id} task={task} indent={36} />
            ))}

            {expanded && section.subGroups && section.subGroups.map(g => (
              <div key={g.key}>
                <SubGroupHeader title={g.title} />
                {g.tasks.map(task => (
                  <MobileTaskRow key={task.id} task={task} indent={44} />
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
