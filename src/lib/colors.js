export const NOTION_COLORS = [
  { id: 'yellow', colBg: '#fef9ec', pillBg: '#fef3c7', pillText: '#92400e', dot: '#d97706' },
  { id: 'pink',   colBg: '#fdf2f0', pillBg: '#fce7e4', pillText: '#9b2c2c', dot: '#e05252' },
  { id: 'green',  colBg: '#f0faf5', pillBg: '#d1fae5', pillText: '#166534', dot: '#22c55e' },
  { id: 'blue',   colBg: '#eff6ff', pillBg: '#dbeafe', pillText: '#1e40af', dot: '#3b82f6' },
  { id: 'purple', colBg: '#f5f3ff', pillBg: '#ede9fe', pillText: '#5b21b6', dot: '#8b5cf6' },
  { id: 'orange', colBg: '#fff7ed', pillBg: '#fed7aa', pillText: '#9a3412', dot: '#f97316' },
  { id: 'teal',   colBg: '#f0fdfa', pillBg: '#ccfbf1', pillText: '#134e4a', dot: '#14b8a6' },
  { id: 'red',    colBg: '#fff5f5', pillBg: '#fee2e2', pillText: '#991b1b', dot: '#ef4444' },
]

// DB color 값(id 또는 구형 hex)으로 매칭, 실패 시 인덱스 기반 fallback
export function getColor(colorValue, index = 0) {
  return (
    NOTION_COLORS.find(c => c.id === colorValue) ||
    NOTION_COLORS.find(c => c.pillBg === colorValue) ||
    NOTION_COLORS[index % NOTION_COLORS.length]
  )
}

// 프로젝트 배열 → { [projectId]: colorObj } 매핑 생성
// 각 뷰에서 colorMap[project.id]로 바로 접근 가능
export function getProjectColorMap(projects) {
  const map = {}
  projects.forEach((p, i) => {
    map[p.id] = getColor(p.color, i)
  })
  return map
}

export function nextColor(currentCount) {
  return NOTION_COLORS[currentCount % NOTION_COLORS.length].id
}
