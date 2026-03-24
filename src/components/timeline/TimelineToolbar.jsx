import { useState, useRef, useEffect } from 'react'
import { SCALES, addMonths, startOfMonth } from '../../utils/timelineUtils'

/**
 * Loop-34: 타임라인 통합 툴바
 * 깊이 필터 + 범위 필터 + 담당자 드롭다운 + 프로젝트 드롭다운 + 스케일 + 네비게이션
 */
export default function TimelineToolbar({
  // Depth
  depthFilter,
  onDepthChange,
  rootLevel,
  // Scope
  scopeFilter,
  onScopeChange,
  hasTeam,
  // Assignee
  members,
  selectedMembers,
  onMembersChange,
  showUnassigned,
  onToggleUnassigned,
  // Project (global only)
  projects,
  selectedProjects,
  onProjectsChange,
  // Scale + Navigation
  scale,
  onScaleChange,
  periodLabel,
  prevLabel,
  nextLabel,
  onNavigate,
  onGoToday,
  // Display
  showAssigneeOnBar,
  onToggleAssigneeOnBar,
  // Mode
  isProjectMode,
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderBottom: '0.5px solid #e8e6df',
      background: '#fafaf8', flexShrink: 0, flexWrap: 'wrap',
    }}>
      {/* Left group: filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Depth filter */}
        <DepthFilter
          value={depthFilter}
          onChange={onDepthChange}
          rootLevel={rootLevel}
        />

        <Separator />

        {/* Loop-39: Scope filter removed — scope determined by sidebar navigation */}

        {/* Assignee dropdown */}
        {members.length > 0 && (
          <CheckboxDropdown
            label="담당자"
            options={members.map(m => ({ id: m.userId || m.id, name: m.displayName || m.name || '—' }))}
            selected={selectedMembers}
            onChange={onMembersChange}
            showUnassigned={showUnassigned}
            onToggleUnassigned={onToggleUnassigned}
          />
        )}

        {/* Project dropdown (global only) */}
        {!isProjectMode && projects.length > 0 && (
          <CheckboxDropdown
            label="프로젝트"
            options={projects.map(p => ({ id: p.id, name: p.name }))}
            selected={selectedProjects}
            onChange={onProjectsChange}
          />
        )}
      </div>

      {/* Right group: scale + nav + assignee toggle */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {onToggleAssigneeOnBar && (
          <button
            onClick={onToggleAssigneeOnBar}
            style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none',
              background: showAssigneeOnBar ? '#e8e6df' : 'transparent',
              color: showAssigneeOnBar ? '#2C2C2A' : '#888780',
              fontWeight: showAssigneeOnBar ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >바에 담당자</button>
        )}

        <Separator />

        {/* Navigation */}
        <button onClick={() => onNavigate(-1)} style={navBtnStyle}>◀ {prevLabel}</button>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#37352f', minWidth: 80, textAlign: 'center' }}>{periodLabel}</span>
        <button onClick={() => onNavigate(1)} style={navBtnStyle}>{nextLabel} ▶</button>
        <button onClick={onGoToday} style={{ ...navBtnStyle, background: '#ef4444', color: 'white', border: 'none', fontWeight: 600 }}>오늘</button>

        <Separator />

        {/* Scale selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SCALES.map(s => (
            <button key={s.key} onClick={() => onScaleChange(s.key)} style={{
              padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer',
              background: scale === s.key ? '#37352f' : 'transparent',
              color: scale === s.key ? 'white' : '#888',
              border: 'none',
            }}>{s.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Depth filter buttons ── */
function DepthFilter({ value, onChange, rootLevel }) {
  const isGlobal = rootLevel === 'project'
  const options = isGlobal
    ? [
        { key: 'project', label: '프로젝트' },
        { key: 'milestone', label: '+ 마일스톤' },
        { key: 'task', label: '+ 할일' },
      ]
    : [
        { key: 'milestone', label: '마일스톤' },
        { key: 'task', label: '+ 할일' },
      ]

  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5,
          border: value === o.key ? '1px solid #37352f' : '1px solid transparent',
          background: value === o.key ? '#37352f' : 'transparent',
          color: value === o.key ? 'white' : '#888',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>{o.label}</button>
      ))}
    </div>
  )
}

/* ── Scope filter ── */
function ScopeFilter({ value, onChange }) {
  const options = [
    { key: 'all', label: '전체' },
    { key: 'team', label: '팀' },
    { key: 'personal', label: '개인' },
  ]
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 5,
          border: 'none',
          background: value === o.key ? '#e8e6df' : 'transparent',
          color: value === o.key ? '#2C2C2A' : '#888',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: value === o.key ? 600 : 400,
        }}>{o.label}</button>
      ))}
    </div>
  )
}

/* ── Checkbox dropdown (for assignees / projects) ── */
function CheckboxDropdown({ label, options, selected, onChange, showUnassigned, onToggleUnassigned }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const allSelected = !selected // null = all
  const count = selected ? selected.length : options.length

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all → empty array (but onChange(null) means all)
      onChange([])
    } else {
      onChange(null)
    }
  }

  const toggleOne = (id) => {
    if (allSelected) {
      // Currently "all" → select all except this one
      onChange(options.filter(o => o.id !== id).map(o => o.id))
    } else {
      const newSelected = selected.includes(id)
        ? selected.filter(x => x !== id)
        : [...selected, id]
      // If all selected again → null
      onChange(newSelected.length === options.length ? null : newSelected)
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: 11, padding: '3px 10px', borderRadius: 5,
          border: '1px solid #e8e6df', background: 'white',
          color: allSelected ? '#888' : '#2C2C2A',
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
      >
        {label}
        {!allSelected && <span style={{ fontSize: 10, background: '#e8e6df', borderRadius: 3, padding: '0 4px' }}>{count}</span>}
        <span style={{ fontSize: 8 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#fff', border: '1px solid #e8e6df', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100,
          minWidth: 160, maxHeight: 240, overflowY: 'auto', padding: '4px 0',
        }}>
          {/* Select all */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: '#37352f' }} />
            <span style={{ fontWeight: 600 }}>전체 선택</span>
          </label>
          <div style={{ borderBottom: '1px solid #f0efe8', margin: '2px 0' }} />

          {/* Individual items */}
          {options.map(o => (
            <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
              <input
                type="checkbox"
                checked={allSelected || (selected && selected.includes(o.id))}
                onChange={() => toggleOne(o.id)}
                style={{ accentColor: '#37352f' }}
              />
              <span>{o.name}</span>
            </label>
          ))}

          {/* Unassigned toggle */}
          {onToggleUnassigned && (
            <>
              <div style={{ borderBottom: '1px solid #f0efe8', margin: '2px 0' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={showUnassigned !== false} onChange={onToggleUnassigned} style={{ accentColor: '#37352f' }} />
                <span>미배정 표시</span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Separator() {
  return <div style={{ width: 1, height: 16, background: '#e8e6df' }} />
}

const navBtnStyle = {
  padding: '3px 8px', borderRadius: 5, border: '1px solid #e0e0e0',
  background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 500,
  fontFamily: 'inherit', color: '#666',
}
