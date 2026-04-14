import { useState } from 'react'

/* ═══ ProjectGridLayout — 카드 grid wrapper (12f) ═══ */
export default function ProjectGridLayout({ projects, renderCard }) {
  const [expandedId, setExpandedId] = useState(null)

  const handleToggleExpand = (projectId) => {
    setExpandedId(prev => prev === projectId ? null : projectId)
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: 12,
      alignItems: 'start',
    }}>
      {projects.map(proj => (
        <div key={proj.id} style={{
          gridColumn: expandedId === proj.id ? '1 / -1' : undefined,
        }}>
          {renderCard(proj, expandedId === proj.id, () => handleToggleExpand(proj.id))}
        </div>
      ))}
    </div>
  )
}
