/**
 * MS owner 상태 계산 유틸
 * - computeOwnerDisplay: single / ghost / mixed 판정
 * - collectChildOwners: 하위 MS의 owner_id 재귀 수집
 * - getDescendantIds: cascade용 하위 MS id 재귀 수집
 */

// 부모 MS의 owner 표시 모드 계산
export function computeOwnerDisplay(milestone, allMilestones) {
  if (milestone.owner_id) return { mode: 'single', ownerId: milestone.owner_id }

  const childOwners = collectChildOwners(milestone.id, allMilestones)
  if (childOwners.length === 0) return { mode: 'ghost' }

  // 빈도순 정렬 → top 2 + 나머지 카운트
  const freq = {}
  childOwners.forEach(id => { freq[id] = (freq[id] || 0) + 1 })
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
  const topOwners = sorted.slice(0, 2).map(([id]) => id)
  const extraCount = Math.max(0, sorted.length - 2)

  return { mode: 'mixed', topOwners, extraCount }
}

// 재귀로 모든 하위 MS의 owner_id 수집 (non-null만)
export function collectChildOwners(msId, allMilestones, visited = new Set()) {
  if (visited.has(msId)) return []  // 순환 참조 방지
  visited.add(msId)
  const children = allMilestones.filter(m => m.parent_id === msId)
  const owners = []
  for (const child of children) {
    if (child.owner_id) owners.push(child.owner_id)
    owners.push(...collectChildOwners(child.id, allMilestones, visited))
  }
  return owners
}

// cascade용: 모든 하위 MS id 수집
export function getDescendantIds(msId, allMilestones, visited = new Set()) {
  if (visited.has(msId)) return []
  visited.add(msId)
  const children = allMilestones.filter(m => m.parent_id === msId)
  const ids = []
  for (const child of children) {
    ids.push(child.id)
    ids.push(...getDescendantIds(child.id, allMilestones, visited))
  }
  return ids
}
