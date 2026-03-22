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
 * 트리를 flat rows로 변환 (v8 mockup 구조: 각 행 = 1개 task)
 * 리프에 연결된 task 수만큼 행을 생성
 * @param {Array} tree - 트리 루트 배열
 * @param {Array} tasks - store의 tasks 배열
 * @param {string} projectId - 프로젝트 ID
 * @param {string} defaultColor - 기본 색상
 * @returns {{ rows, maxDepth }}
 */
export function flattenTreeWithTasks(tree, tasks, projectId, defaultColor) {
  const rows = []
  const maxDepth = getMaxDepth(tree)
  const projectTasks = tasks.filter(t => t.projectId === projectId && !t.deletedAt)

  const walk = (nodes, path, depth, color) => {
    nodes.forEach(n => {
      const c = n.color || color
      const hasChildren = n.children && n.children.length > 0
      if (hasChildren) {
        walk(n.children, [...path, { id: n.id, title: n.title, color: c, isLeaf: false, _node: n }], depth + 1, c)
      } else {
        const cells = [...path, { id: n.id, title: n.title, color: c, isLeaf: true, _node: n }]
        while (cells.length < maxDepth) cells.push(null)

        // 리프에 연결된 할일 찾기
        const leafTasks = projectTasks.filter(t => t.keyMilestoneId === n.id)
        const subRowCount = Math.max(leafTasks.length, 1)

        for (let i = 0; i < subRowCount; i++) {
          rows.push({
            leafId: n.id,
            cells: i === 0 ? cells : cells.map(() => null), // rowspan simulation
            task: leafTasks[i] || null,
            isFirstSubRow: i === 0,
            subRowCount: i === 0 ? subRowCount : 0,
            color: c,
            leafNode: n,
            taskIndex: i,
          })
        }
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
 * 펼쳐진 노드 기반으로 visible rows 생성 (타임라인 연동용)
 */
export function flattenVisibleNodes(tree, expanded) {
  const rows = []
  const walk = (nodes, depth) => {
    nodes.forEach(n => {
      const hasChildren = n.children && n.children.length > 0
      rows.push({
        id: n.id,
        title: n.title,
        startDate: n.start_date,
        endDate: n.end_date,
        depth,
        color: n.color,
        type: hasChildren ? 'group' : 'leaf',
        node: n,
      })
      if (hasChildren && expanded[n.id] !== false) {
        walk(n.children, depth + 1)
      }
    })
  }
  walk(tree, 0)
  return rows
}

/**
 * 트리의 모든 노드 ID를 expanded=true로 설정
 */
export function expandAll(tree) {
  const result = {}
  const walk = (nodes) => {
    nodes.forEach(n => {
      if (n.children && n.children.length > 0) {
        result[n.id] = true
        walk(n.children)
      }
    })
  }
  walk(tree)
  return result
}

/**
 * 그룹 바 기간 자동계산 (타임라인용)
 */
export function computeGroupSpan(node) {
  if (!node.children || node.children.length === 0) {
    return { start: node.start_date, end: node.end_date }
  }
  const spans = node.children.map(c => computeGroupSpan(c))
  const starts = spans.map(s => s.start).filter(Boolean)
  const ends = spans.map(s => s.end).filter(Boolean)
  return {
    start: starts.length > 0 ? starts.sort()[0] : null,
    end: ends.length > 0 ? ends.sort().reverse()[0] : null,
  }
}
