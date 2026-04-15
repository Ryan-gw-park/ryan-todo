/**
 * milestoneTree.js — 계층형 마일스톤 트리 유틸리티 (Loop-37)
 */

/**
 * flat milestones 배열 → 트리 구조 변환
 * @param {Array} milestones - store의 flat milestones 배열
 * @param {string} projectId - 프로젝트 ID
 * @returns {Array} 트리 루트 노드 배열
 */
export function buildTree(milestones, projectId) {
  const filtered = milestones.filter(m => m.project_id === projectId)
  const map = new Map(filtered.map(m => [m.id, { ...m, children: [] }]))
  const roots = []

  filtered.forEach(m => {
    const node = map.get(m.id)
    if (m.parent_id && map.has(m.parent_id)) {
      map.get(m.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortNodes = (nodes) => {
    nodes.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(roots)

  return roots
}

/**
 * 트리의 최대 깊이 계산 (depth 0부터)
 */
export function getMaxDepth(tree) {
  let max = 0
  const walk = (nodes, d) => {
    nodes.forEach(n => {
      max = Math.max(max, d)
      if (n.children.length > 0) walk(n.children, d + 1)
    })
  }
  walk(tree, 0)
  return max + 1
}

/**
 * 리프 노드만 수집 (children이 0개인 노드)
 */
export function collectLeaves(tree) {
  const leaves = []
  const walk = (nodes) => {
    nodes.forEach(n => {
      if (n.children.length > 0) walk(n.children)
      else leaves.push(n)
    })
  }
  walk(tree)
  return leaves
}

/**
 * 노드의 하위 전체 할일 재귀 집계
 * @param {Object} node - 트리 노드
 * @param {Array} tasks - store의 tasks 배열
 * @returns {{ total: number, done: number }}
 */
export function countTasksRecursive(node, tasks) {
  const leafIds = []
  const walk = (n) => {
    if (n.children.length > 0) n.children.forEach(walk)
    else leafIds.push(n.id)
  }
  walk(node)

  // 그룹이면서 직접 연결된 할일도 있는 하이브리드 노드 처리
  if (node.children.length > 0) leafIds.push(node.id)

  let total = 0, done = 0
  tasks.forEach(t => {
    if (leafIds.includes(t.keyMilestoneId)) {
      total++
      if (t.done) done++
    }
  })
  return { total, done }
}

/**
 * 트리를 flat rows로 변환 (각 행 = 리프까지의 경로)
 * 목업의 flattenTree 로직 재현
 */
export function flattenTree(tree, defaultColor) {
  const rows = []
  const maxDepth = getMaxDepth(tree)

  const walk = (nodes, path, depth, color) => {
    nodes.forEach(n => {
      const c = n.color || color
      const hasChildren = n.children && n.children.length > 0
      if (hasChildren) {
        walk(n.children, [...path, { id: n.id, title: n.title, color: c, isLeaf: false }], depth + 1, c)
      } else {
        const cells = [...path, { id: n.id, title: n.title, color: c, isLeaf: true }]
        while (cells.length < maxDepth) cells.push(null)
        rows.push({ leafId: n.id, cells, color: c, node: n })
      }
    })
  }

  walk(tree, [], 0, defaultColor || '#888')
  return { rows, maxDepth }
}

/**
 * 노드에서 루트까지의 경로 문자열 생성
 * @param {string} nodeId
 * @param {Array} milestones - flat milestones 배열
 * @returns {string} "법인설립 > 지점설립 > 필요서류 확보"
 */
export function getNodePath(nodeId, milestones) {
  const msMap = new Map(milestones.map(m => [m.id, m]))
  const path = []
  let current = msMap.get(nodeId)
  while (current) {
    path.unshift(current.title)
    current = current.parent_id ? msMap.get(current.parent_id) : null
  }
  return path.join(' > ')
}

/**
 * Get ancestor path string for a milestone (Loop-38)
 * @param {string} msId - milestone ID
 * @param {Array} milestones - flat milestones array
 * @returns {string|null} "법인설립 > 지점설립" or null if depth=0
 */
export function getMsPath(msId, milestones) {
  const parts = []
  let cur = milestones.find(m => m.id === msId)
  while (cur?.parent_id) {
    const parent = milestones.find(m => m.id === cur.parent_id)
    if (parent) {
      parts.unshift(parent.title)
      cur = parent
    } else break
  }
  return parts.length > 0 ? parts.join(' > ') : null
}

/**
 * parent_id 체인을 따라 실제 depth 계산 (DB depth 필드 사용하지 않음)
 * @param {object} ms - milestone 객체
 * @param {Array} allMs - 같은 프로젝트의 전체 milestones 배열
 * @returns {number} 0부터 시작하는 depth
 */
export function computeDepth(ms, allMs) {
  let d = 0, cur = ms
  const visited = new Set()
  while (cur && cur.parent_id) {
    if (visited.has(cur.id)) break // 순환 참조 방지
    visited.add(cur.id)
    cur = allMs.find(m => m.id === cur.parent_id)
    if (cur) d++
  }
  return d
}

/**
 * 프로젝트 내 MS의 실제 최대 depth 계산 (parent_id 기반)
 * @param {Array} milestones - flat milestones array
 * @param {string} projectId - project ID
 * @returns {number} 최대 depth (0 = 단일 레벨)
 */
export function getProjectMaxDepth(milestones, projectId) {
  const projMs = milestones.filter(m => m.project_id === projectId)
  let max = 0
  projMs.forEach(m => {
    const d = computeDepth(m, projMs)
    if (d > max) max = d
  })
  return max
}

