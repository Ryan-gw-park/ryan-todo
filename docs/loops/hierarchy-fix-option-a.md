# 마일스톤 계층화 완전 수정 — 옵션 A: depth 읽기 폐기

## REQ-LOCK 요구사항

| # | 요구사항 |
|---|---------|
| R1 | depth 필드 읽기 전면 폐기 → parent_id 체인만 사용 |
| R2 | MsBacklogSidebar L1/L2 버튼 정확한 표시 |
| R3 | getParentPath 무한 루프 방지 |
| R4 | updateTask 개인 프로젝트 scope 보호 |
| R5 | TDZ 잔여 2건 수정 |
| R6 | addMilestone/moveMilestone depth 계산 정확성 |

---

## Step 1: milestoneTree.js — 공용 depth 계산 함수 추가 + getVisibleMs 수정

```
str_replace
path: src/utils/milestoneTree.js
old_str:
/**
 * Filter milestones by depth level for a project (Loop-38)
 * @param {Array} milestones - flat milestones array
 * @param {string} projectId - project ID (pkmId or project_id)
 * @param {string} depthFilter - 'all' | '0' | '1' | '2'
 * @returns {Array} filtered milestones
 */
export function getVisibleMs(milestones, projectId, depthFilter) {
  const projMs = milestones.filter(m => m.project_id === projectId)
  if (depthFilter === 'all') return projMs
  const d = parseInt(depthFilter)
  return projMs.filter(m => (m.depth ?? 0) === d)
}
new_str:
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

/**
 * Filter milestones by depth level for a project (Loop-38)
 * depth 필드 대신 parent_id 체인으로 실제 depth 계산
 * @param {Array} milestones - flat milestones array
 * @param {string} projectId - project ID (pkmId or project_id)
 * @param {string} depthFilter - 'all' | '0' | '1' | '2'
 * @returns {Array} filtered milestones
 */
export function getVisibleMs(milestones, projectId, depthFilter) {
  const projMs = milestones.filter(m => m.project_id === projectId)
  if (depthFilter === 'all') return projMs
  const d = parseInt(depthFilter)
  return projMs.filter(m => computeDepth(m, projMs) === d)
}
```

---

## Step 2: MsBacklogSidebar.jsx — P1 + P7 수정

### 2-1. import 추가

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
import { useState, useMemo } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
new_str:
import { useState, useMemo } from 'react'
import { COLOR, FONT } from '../../styles/designTokens'
import useStore from '../../hooks/useStore'
import { getColor } from '../../utils/colors'
import { computeDepth, getProjectMaxDepth } from '../../utils/milestoneTree'
```

### 2-2. maxDepthMap — DB depth → parent_id 기반

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
  // Compute max depth per project
  const maxDepthMap = useMemo(() => {
    const map = {}
    projects.forEach(p => {
      const projMs = milestones.filter(m => m.project_id === p.id)
      let max = 0
      projMs.forEach(m => { if ((m.depth ?? 0) > max) max = m.depth ?? 0 })
      map[p.id] = max
    })
    return map
  }, [projects, milestones])
new_str:
  // Compute max depth per project — parent_id 체인 기반 (DB depth 필드 사용 안함)
  const maxDepthMap = useMemo(() => {
    const map = {}
    projects.forEach(p => { map[p.id] = getProjectMaxDepth(milestones, p.id) })
    return map
  }, [projects, milestones])
```

### 2-3. backlogMs 필터 — DB depth → computeDepth

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
    // Depth filter — per project
    result = result.filter(m => {
      const targetDepth = depthMap[m.project_id] ?? 0
      return (m.depth ?? 0) === targetDepth
    })
new_str:
    // Depth filter — parent_id 체인 기반 실제 depth (DB depth 필드 사용 안함)
    result = result.filter(m => {
      const targetDepth = depthMap[m.project_id] ?? 0
      const projMs = milestones.filter(ms => ms.project_id === m.project_id)
      return computeDepth(m, projMs) === targetDepth
    })
```

### 2-4. getParentPath — 무한 루프 방지 (P7)

```
str_replace
path: src/components/common/MsBacklogSidebar.jsx
old_str:
  const getParentPath = (ms) => {
    if (!ms.parent_id) return null
    const parts = []
    let current = msMap[ms.parent_id]
    while (current) {
      parts.unshift(current.title || '?')
      current = current.parent_id ? msMap[current.parent_id] : null
    }
    return parts.length > 0 ? parts.join(' > ') : null
  }
new_str:
  const getParentPath = (ms) => {
    if (!ms.parent_id) return null
    const parts = []
    let current = msMap[ms.parent_id]
    const visited = new Set()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      parts.unshift(current.title || '?')
      current = current.parent_id ? msMap[current.parent_id] : null
    }
    return parts.length > 0 ? parts.join(' > ') : null
  }
```

---

## Step 3: useStore.js — P3 + P4 + P5 수정

### 3-1. addMilestone — parent_id 체인 기반 depth

```
str_replace
path: src/hooks/useStore.js
old_str:
  addMilestone: async (projectId, pkmId, title, parentId = null) => {
    const d = db()
    if (!d) return null
    const userId = getCachedUserId()
    const parentMs = parentId ? get().milestones.find(m => m.id === parentId) : null
    const depth = parentMs ? (parentMs.depth || 0) + 1 : 0
new_str:
  addMilestone: async (projectId, pkmId, title, parentId = null) => {
    const d = db()
    if (!d) return null
    const userId = getCachedUserId()
    // depth: parent_id 체인을 따라가서 실제 depth 계산 (DB depth 필드 의존 안함)
    const computeDepthChain = (pid) => {
      let depth = 0, cur = pid
      const visited = new Set()
      while (cur) {
        if (visited.has(cur)) break
        visited.add(cur)
        const parent = get().milestones.find(m => m.id === cur)
        if (!parent) break
        depth++
        cur = parent.parent_id
      }
      return depth
    }
    const depth = parentId ? computeDepthChain(parentId) : 0
```

### 3-2. moveMilestone — 동일 수정

```
str_replace
path: src/hooks/useStore.js
old_str:
  moveMilestone: async (id, newParentId) => {
    const d = db()
    if (!d) return
    const parentMs = newParentId ? get().milestones.find(m => m.id === newParentId) : null
    const depth = parentMs ? (parentMs.depth || 0) + 1 : 0
new_str:
  moveMilestone: async (id, newParentId) => {
    const d = db()
    if (!d) return
    // depth: parent_id 체인을 따라가서 실제 depth 계산 (DB depth 필드 의존 안함)
    const computeDepthChain = (pid) => {
      let depth = 0, cur = pid
      const visited = new Set()
      while (cur) {
        if (visited.has(cur)) break
        visited.add(cur)
        const parent = get().milestones.find(m => m.id === cur)
        if (!parent) break
        depth++
        cur = parent.parent_id
      }
      return depth
    }
    const depth = newParentId ? computeDepthChain(newParentId) : 0
```

### 3-3. updateTask — 개인 프로젝트 scope 보호 (P5)

```
str_replace
path: src/hooks/useStore.js
old_str:
  updateTask: async (id, patch) => {
    const currentTask = get().tasks.find(x => x.id === id)
    if (!currentTask) return
    const resolvedPatch = applyTransitionRules(currentTask, patch)
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...resolvedPatch } : t) }))
new_str:
  updateTask: async (id, patch) => {
    const currentTask = get().tasks.find(x => x.id === id)
    if (!currentTask) return
    const resolvedPatch = applyTransitionRules(currentTask, patch)
    // 개인 프로젝트 scope 보호 — 어떤 경로로든 개인 프로젝트에 속한 할일은 scope='private'
    const targetProjectId = resolvedPatch.projectId || currentTask.projectId
    const targetProject = targetProjectId ? get().projects.find(p => p.id === targetProjectId) : null
    if (targetProject && !targetProject.teamId) {
      resolvedPatch.scope = 'private'
      resolvedPatch.teamId = null
      if (resolvedPatch.assigneeId !== undefined) delete resolvedPatch.assigneeId
    }
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...resolvedPatch } : t) }))
```

---

## Step 4: TDZ 수정 — P6

### 4-1. TaskOutlinerMode.jsx

```
str_replace
path: src/components/project/tasks/TaskOutlinerMode.jsx
old_str:
import { useState, useRef, useEffect, useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import { getColor, CATEGORIES } from '../../../utils/colors'
import useTeamMembers from '../../../hooks/useTeamMembers'
import { CategorySection } from './index'

const NON_DONE_CATS = CATEGORIES.filter(c => c.key !== 'done')

export default function TaskOutlinerMode({ projectId }) {
new_str:
import { useState, useRef, useEffect, useMemo } from 'react'
import useStore from '../../../hooks/useStore'
import { getColor, CATEGORIES } from '../../../utils/colors'
import useTeamMembers from '../../../hooks/useTeamMembers'
import { CategorySection } from './index'

export default function TaskOutlinerMode({ projectId }) {
  const NON_DONE_CATS = useMemo(() => CATEGORIES.filter(c => c.key !== 'done'), [])
```

### 4-2. ProjectView.jsx

```
str_replace
path: src/components/views/ProjectView.jsx
old_str:
import { useState, useRef, useEffect } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
// ProjectFilter removed — scope determined by sidebar (Loop-39)
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import { CategorySection } from '../project/tasks'

const NON_DONE_CATS = CATEGORIES.filter(c => c.key !== 'done')

export default function ProjectView() {
new_str:
import { useState, useRef, useEffect, useMemo } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
// ProjectFilter removed — scope determined by sidebar (Loop-39)
import useProjectFilter from '../../hooks/useProjectFilter'
import useTeamMembers from '../../hooks/useTeamMembers'
import { CategorySection } from '../project/tasks'

export default function ProjectView() {
  const NON_DONE_CATS = useMemo(() => CATEGORIES.filter(c => c.key !== 'done'), [])
```

---

## Step 5: 빌드 + 커밋

```bash
npm run build
git add -A
git commit -m "fix: 마일스톤 계층화 완전 수정 — depth 읽기 폐기(parent_id만 사용), TDZ 2건, updateTask scope 보호, 무한 루프 방지"
git push origin main
```

---

## DELETE-5 검증

| 삭제/변경 대상 | ① import | ② caller | ④ deps | 처리 |
|---------------|----------|----------|--------|------|
| m.depth 읽기 (MsBacklogSidebar) | — | 내부 | — | computeDepth로 교체 ✓ |
| m.depth 읽기 (getVisibleMs) | — | 미사용 (dead code) | — | computeDepth로 교체 ✓ |
| parentMs.depth (addMilestone) | — | 내부 | — | computeDepthChain으로 교체 ✓ |
| parentMs.depth (moveMilestone) | — | 내부 | — | computeDepthChain으로 교체 ✓ |
| NON_DONE_CATS 모듈 레벨 | CATEGORIES import | 내부 | — | 함수 내부 useMemo로 이동 ✓ |

**주의:** depth 쓰기(DB에 저장)는 유지. 기존 depth 컬럼에 계속 올바른 값을 저장하되, 읽기 시에는 사용하지 않음. 하위 호환성 유지.

## REQ-LOCK 검증

| # | 요구사항 | 처리 | 상태 |
|---|---------|------|------|
| R1 | depth 읽기 폐기 | computeDepth + getProjectMaxDepth | ✓ |
| R2 | L1/L2 버튼 정확 | maxDepthMap → getProjectMaxDepth | ✓ |
| R3 | 무한 루프 방지 | visited Set 추가 (3곳) | ✓ |
| R4 | updateTask scope | 개인 프로젝트 강제 보정 | ✓ |
| R5 | TDZ 2건 | useMemo 내부 이동 | ✓ |
| R6 | add/moveMilestone | computeDepthChain | ✓ |

## 검증 체크리스트

- [ ] 빌드 에러 없음
- [ ] 프로젝트 뷰 진입 시 TDZ 에러 없음
- [ ] MsBacklogSidebar L1/L2 버튼이 실제 트리 구조에 맞게 표시
- [ ] L3/L4 등 존재하지 않는 depth 버튼이 표시되지 않음
- [ ] 개인 프로젝트 할일 추가 시 DB 에러 없음
- [ ] DnD로 할일을 개인 프로젝트로 이동 시 DB 에러 없음
- [ ] MS 추가/이동 시 depth 값 정확
