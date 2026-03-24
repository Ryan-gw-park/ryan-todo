import { create } from 'zustand'
import { getDb } from '../utils/supabase'

// ─── Select 컬럼 최적화 ───
// tasks: alarm, deleted_at 컬럼은 DB에 없을 수 있으므로 select('*') 유지 (기존 fallback 로직 활용)
const TASK_COLUMNS = '*'
const PROJECT_COLUMNS = 'id, name, color, sort_order, team_id, user_id, owner_id, description, start_date, due_date, status, created_by'
const MEMO_COLUMNS = 'id, title, notes, color, sort_order, created_at, updated_at'

// ─── 스냅샷 키 ───
const SNAPSHOT_KEY = 'ryan-todo-snapshot'
const SNAPSHOT_MAX_AGE = 24 * 60 * 60 * 1000 // 24시간

// ─── Loop-35J: loadAll 중복 실행 방지 플래그 ───
let _loadAllRunning = false

/**
 * @typedef {Object} TaskAlarm
 * @property {boolean} enabled
 * @property {string} datetime  - ISO 8601, e.g. "2025-03-15T09:00:00"
 * @property {'none'|'daily'|'weekly'} repeat
 * @property {boolean} notified - 이미 발송된 알람인지
 */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

// ─── Loop-31: 상태 전이 규칙 헬퍼 ───
function applyTransitionRules(currentTask, patch) {
  const resolved = { ...patch }

  // R1: assigneeId 설정 → scope='assigned'
  if ('assigneeId' in resolved && resolved.assigneeId !== currentTask.assigneeId) {
    if (resolved.assigneeId) {
      if (!('scope' in resolved)) resolved.scope = 'assigned'
    } else {
      // R2: assigneeId=null → scope='team' 또는 'private'
      if (!('scope' in resolved)) {
        resolved.scope = currentTask.teamId ? 'team' : 'private'
      }
      // R2+: 팀 할일 배정 해제 → category='backlog'
      if (currentTask.teamId && !('category' in resolved)) {
        resolved.category = 'backlog'
      }
    }
  }

  // R3: done=true → prevCategory 저장 (category는 변경 안 함)
  if ('done' in resolved) {
    if (resolved.done && !currentTask.done) {
      resolved.prevCategory = currentTask.category
    }
    // R4: done=false → prevCategory 초기화 + category='done' 방어
    if (!resolved.done && currentTask.done) {
      if (currentTask.category === 'done' && !('category' in resolved)) {
        resolved.category = currentTask.prevCategory || 'backlog'
      }
      resolved.prevCategory = ''
    }
  }

  // R5: projectId 변경 → keyMilestoneId 초기화
  if ('projectId' in resolved && resolved.projectId !== currentTask.projectId) {
    if (!('keyMilestoneId' in resolved)) {
      resolved.keyMilestoneId = null
    }
  }

  // R6: scope='private' → teamId, assigneeId 초기화
  if (resolved.scope === 'private') {
    if (!('teamId' in resolved)) resolved.teamId = null
    if (!('assigneeId' in resolved)) resolved.assigneeId = null
  }

  // R7: scope='team' → assigneeId 초기화
  if (resolved.scope === 'team' && !('assigneeId' in resolved)) {
    resolved.assigneeId = null
  }

  return resolved
}

function db() {
  const d = getDb()
  if (!d) { console.error('[Ryan Todo] Supabase not connected'); return null }
  return d
}

// alarm 컬럼 존재 여부 캐시 (한 번 확인 후 재사용)
let _alarmColChecked = false
let _alarmColExists = true

// Loop-23: deleted_at 컬럼 존재 여부 캐시
let _deletedAtColChecked = false
let _deletedAtColExists = true

// Loop-20: 현재 유저 ID 캐시
let _cachedUserId = null
async function getCurrentUserId() {
  if (_cachedUserId) return _cachedUserId
  const d = getDb()
  if (!d) return null
  try {
    const { data: { user } } = await d.auth.getUser()
    _cachedUserId = user?.id || null
    return _cachedUserId
  } catch { return null }
}

// 동기 접근용 — loadAll 등에서 이미 캐시된 경우에만 반환
export function getCachedUserId() {
  return _cachedUserId
}

function taskToRow(t) {
  const row = {
    id: t.id, text: t.text, project_id: t.projectId, category: t.category,
    done: t.done, due_date: t.dueDate || null, start_date: t.startDate || null,
    notes: t.notes, prev_category: t.prevCategory || null, sort_order: t.sortOrder,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    team_id: t.teamId || null,
    scope: t.scope || 'private',
    assignee_id: t.assigneeId || null,
    created_by: t.createdBy || null,
    highlight_color: t.highlightColor || null,
    updated_at: new Date().toISOString(),
    // ↓ Loop-26: Key Milestone 연결 ↓
    key_milestone_id: t.keyMilestoneId || null,
    deliverable_id: t.deliverableId || null,
  }
  if (_alarmColExists) row.alarm = t.alarm ?? null
  return row
}

async function safeUpsertTask(d, t) {
  const row = taskToRow(t)
  const { error } = await d.from('tasks').upsert(row)
  // alarm 컬럼이 없으면 alarm 필드를 빼고 재시도
  if (error && !_alarmColChecked && row.alarm !== undefined) {
    _alarmColChecked = true
    _alarmColExists = false
    const { alarm, ...rowWithout } = row
    const retry = await d.from('tasks').upsert(rowWithout)
    return retry
  }
  if (!error && !_alarmColChecked) {
    _alarmColChecked = true
    _alarmColExists = true
  }
  return { error }
}

function mapMemo(r) {
  return {
    id: r.id, title: r.title || '', notes: r.notes || '', color: r.color || 'yellow',
    sortOrder: r.sort_order || 0, createdAt: r.created_at, updatedAt: r.updated_at,
  }
}
function mapProject(r) {
  return {
    id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    userId: r.user_id || null,
    ownerId: r.owner_id || null,
  }
}
function mapTask(r) {
  return {
    id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
    done: r.done || false, dueDate: r.due_date || '', startDate: r.start_date || '',
    notes: r.notes || '', prevCategory: r.prev_category || '',
    sortOrder: r.sort_order || 0, alarm: r.alarm ?? null,
    // ↓ Loop-20: 팀 관련 신규 필드 ↓
    teamId: r.team_id || null,
    scope: r.scope || 'private',
    assigneeId: r.assignee_id || null,
    createdBy: r.created_by || null,
    highlightColor: r.highlight_color || null,
    updatedAt: r.updated_at || null,
    deletedAt: r.deleted_at || null,
    // ↓ Loop-26: Key Milestone 연결 ↓
    keyMilestoneId: r.key_milestone_id || null,
    deliverableId: r.deliverable_id || null,
  }
}

// ─── 배열 동일성 비교 (id + updatedAt 기준, O(n)) ───
function isArrayEqual(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  if (a.length !== b.length) return false
  const aKeys = new Set(a.map(item => `${item.id}_${item.updatedAt}`))
  for (const item of b) {
    if (!aKeys.has(`${item.id}_${item.updatedAt}`)) return false
  }
  return true
}

// ─── User Task Settings fetch (set() 없이 데이터만 반환) ───
async function _fetchUserTaskSettings(teamId) {
  if (!teamId) return []
  const d = getDb()
  const userId = _cachedUserId
  if (!d || !userId) return []
  const { data } = await d.from('user_task_settings')
    .select('task_id, highlight_color')
    .eq('user_id', userId)
  return (data || []).map(r => ({ taskId: r.task_id, highlightColor: r.highlight_color }))
}

// ─── Collapse state Supabase sync (debounced) ───
let _collapseSaveTimer = null
function _saveCollapseState(state) {
  clearTimeout(_collapseSaveTimer)
  _collapseSaveTimer = setTimeout(async () => {
    const d = getDb()
    if (!d) return
    const { error } = await d.from('ui_state').upsert({
      id: 'default',
      collapse_state: state,
      updated_at: new Date().toISOString(),
    })
    if (error) console.warn('[Ryan Todo] saveCollapseState:', error.message)
  }, 500)
}

const _defaultCollapseState = {
  today: {},          // projectId → boolean
  allTasks: {},       // projectId → boolean (모바일 모든 할일 뷰)
  matrix: {},         // projectId → boolean
  matrixDone: {},     // projectId → boolean
  timeline: {},       // projectId → boolean
  projectExpanded: {},// taskId → boolean (false = collapsed)
  projectSection: {}, // "projectId:catKey" → boolean (true = collapsed)
  projectAllTop: {},  // taskId → boolean
  memo: {},           // memoId → boolean (true = body collapsed)
  memoAllTop: {},     // memoId → boolean
  detailAllTop: {},   // taskId → boolean
}

const useStore = create((set, get) => ({
  projects: [],
  tasks: [],
  memos: [],
  milestones: [],
  syncStatus: 'ok',
  currentView: 'today',
  detailTask: null,
  showProjectMgr: false,
  // Loop-33: 모달 상태
  activeModal: null,        // { type: 'projectSettings', projectId } | { type: 'milestoneDetail', milestoneId, returnTo } | null
  confirmDialog: null,      // { target: 'project'|'milestone', targetId, targetName, meta } | null
  toast: null, // { msg, undoTaskId?, undoPrevCategory? }
  userName: 'Ryan',
  setUserName: (name) => set({ userName: name }),

  // ─── 스냅샷 상태 (iOS PWA 콜드 스타트 최적화) ───
  snapshotTeamId: null,
  snapshotRestored: false,

  // ─── Collapse State (synced to Supabase) ───
  collapseState: { ..._defaultCollapseState },

  toggleCollapse: (group, key) => {
    const cs = { ...get().collapseState }
    cs[group] = { ...(cs[group] || {}), [key]: !cs[group]?.[key] }
    set({ collapseState: cs })
    _saveCollapseState(cs)
  },

  setCollapseGroup: (group, value) => {
    const cs = { ...get().collapseState }
    cs[group] = { ...(cs[group] || {}), ...value }
    set({ collapseState: cs })
    _saveCollapseState(cs)
  },

  setCollapseValue: (group, key, value) => {
    const cs = { ...get().collapseState }
    cs[group] = { ...(cs[group] || {}), [key]: value }
    set({ collapseState: cs })
    _saveCollapseState(cs)
  },

  setView: (v) => {
    const LEGACY_MAP = { matrix: 'team-matrix', timeline: 'team-timeline', weekly: 'team-weekly', now: 'today' }
    set({ currentView: LEGACY_MAP[v] || v })
  },

  // ─── Sidebar collapse state ───
  sidebarCollapsed: JSON.parse(localStorage.getItem('sidebarCollapsed') || 'false'),
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    localStorage.setItem('sidebarCollapsed', JSON.stringify(next))
  },

  // ─── 스냅샷 복원용 setter ───
  setTasks: (tasks) => set({ tasks }),
  setProjects: (projects) => set({ projects }),
  setMemos: (memos) => set({ memos }),

  // ─── 스냅샷 복원 (App 초기화 시 호출) ───
  // ─── 스냅샷 복원 (App 초기화 시 호출 — Auth 전에 실행 가능) ───
  restoreSnapshot: () => {
    try {
      const cached = localStorage.getItem(SNAPSHOT_KEY)
      if (!cached) return false
      const snapshot = JSON.parse(cached)
      // 24시간 이내만 사용 (teamId 검증은 Auth 완료 후 지연 검증)
      if (Date.now() - snapshot.timestamp > SNAPSHOT_MAX_AGE) return false
      const patch = {
        tasks: snapshot.tasks || [],
        projects: snapshot.projects || [],
        memos: snapshot.memos || [],
        snapshotTeamId: snapshot.teamId || null,
        snapshotRestored: true,
      }
      if (snapshot.collapseState) patch.collapseState = snapshot.collapseState
      if (snapshot.userTaskSettings) patch.userTaskSettings = snapshot.userTaskSettings
      set(patch)
      return true
    } catch (e) {
      return false
    }
  },

  // ─── 스냅샷 초기화 (Auth 실패 또는 로그아웃 시 호출) ───
  clearSnapshot: () => {
    set({
      snapshotRestored: false,
      snapshotTeamId: null,
      tasks: [],
      projects: [],
      memos: [],
      milestones: [],
    })
    try { localStorage.removeItem(SNAPSHOT_KEY) } catch (e) {}
  },

  logout: async () => {
    const d = db()
    if (d) await d.auth.signOut()
    // 스냅샷 삭제
    get().clearSnapshot()
  },
  openDetail: (task) => set({ detailTask: task, showNotificationPanel: false, activeModal: null }),
  closeDetail: () => set({ detailTask: null }),
  setShowProjectMgr: (v) => set({ showProjectMgr: v }),
  // Loop-33: 모달 액션
  openModal: (modalState) => set({ activeModal: modalState, detailTask: null }),
  closeModal: () => set({ activeModal: null }),
  openConfirmDialog: (state) => set({ confirmDialog: state }),
  closeConfirmDialog: () => set({ confirmDialog: null }),
  showToast: (msg, opts) => {
    const id = Date.now()
    set({ toast: { msg, id, ...opts } })
    setTimeout(() => set(s => s.toast?.id === id ? { toast: null } : {}), 2500)
  },
  clearToast: () => set({ toast: null }),

  // ─── Load All ───
  loadAll: async () => {
    // Loop-35J: 중복 실행 방지 — StrictMode 이중 호출 + 탭 복귀 경쟁 조건 차단
    if (_loadAllRunning) return
    _loadAllRunning = true
    const d = db()
    if (!d) { _loadAllRunning = false; set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    try {
      const teamId = get().currentTeamId

      // Loop-20: 팀 모드 필터 — tasks 쿼리 분기 (select 최적화)
      let tasksQuery = d.from('tasks').select(TASK_COLUMNS)
      if (_deletedAtColExists) tasksQuery = tasksQuery.is('deleted_at', null)
      tasksQuery = tasksQuery.order('sort_order')
      if (teamId) {
        // 팀 모드: 해당 팀 태스크 + 본인 개인 태스크
        const { data: { user } } = await d.auth.getUser()
        const userId = user?.id
        if (userId) _cachedUserId = userId
        if (userId) {
          tasksQuery = tasksQuery.or(`team_id.eq.${teamId},and(scope.eq.private,created_by.eq.${userId})`)
        } else {
          tasksQuery = tasksQuery.eq('scope', 'private')
        }
      } else {
        // 개인 모드: scope=private만
        tasksQuery = tasksQuery.eq('scope', 'private')
      }

      // Loop-20 보완: 팀 모드 프로젝트 필터 — 팀 프로젝트 + 본인 개인 프로젝트 (select 최적화)
      let projectsQuery = d.from('projects').select(PROJECT_COLUMNS).order('sort_order')
      if (teamId) {
        const uid = _cachedUserId || (await d.auth.getUser()).data?.user?.id
        if (uid) {
          projectsQuery = projectsQuery.or(`team_id.eq.${teamId},user_id.eq.${uid}`)
        }
      }

      const [pr, trResult, mr, uiR, taskSettings] = await Promise.all([
        projectsQuery,
        tasksQuery,
        d.from('memos').select(MEMO_COLUMNS).order('sort_order'),
        d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle(),
        _fetchUserTaskSettings(teamId),
      ])
      if (pr.error) throw pr.error

      // Loop-23: deleted_at 컬럼 없으면 필터 없이 재시도
      let tr = trResult
      if (tr.error && !_deletedAtColChecked && _deletedAtColExists) {
        _deletedAtColChecked = true
        _deletedAtColExists = false
        let retryQuery = d.from('tasks').select(TASK_COLUMNS).order('sort_order')
        if (teamId) {
          const uid = _cachedUserId
          if (uid) {
            retryQuery = retryQuery.or(`team_id.eq.${teamId},and(scope.eq.private,created_by.eq.${uid})`)
          } else {
            retryQuery = retryQuery.eq('scope', 'private')
          }
        } else {
          retryQuery = retryQuery.eq('scope', 'private')
        }
        tr = await retryQuery
      }
      if (!tr.error && !_deletedAtColChecked) {
        _deletedAtColChecked = true
        _deletedAtColExists = true
      }
      if (tr.error) throw tr.error

      // Merge loaded collapse state with defaults — preserve snapshot values if already restored
      const currentCs = get().collapseState
      const hasSnapshotCs = currentCs && Object.values(currentCs).some(v => v && Object.keys(v).length > 0)
      let cs
      if (hasSnapshotCs) {
        // 스냅샷에서 이미 복원된 값이 있으면 유지 (DB 값은 다음 loadAll에서 적용)
        cs = currentCs
      } else {
        const loaded = uiR?.data?.collapse_state || {}
        cs = { ..._defaultCollapseState }
        for (const key of Object.keys(cs)) {
          if (loaded[key] && typeof loaded[key] === 'object') {
            cs[key] = loaded[key]
          }
        }
      }

      const projects = pr.data.map(mapProject)
      const tasks = tr.data.map(mapTask)
      const memos = mr.error ? [] : mr.data.map(mapMemo)

      // 마일스톤: 프로젝트 ID 기반으로 한번에 로딩 (별도 렌더 사이클 방지)
      let milestones = []
      const projectIdsList = projects.map(p => p.id)
      if (projectIdsList.length > 0) {
        try {
          const msResult = await d.from('key_milestones')
            .select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')
            .in('project_id', projectIdsList)
            .order('sort_order')
          milestones = msResult.data || []
        } catch (e) {
          // 마일스톤 로딩 실패해도 다른 데이터 반영에 영향 없음
        }
      }

      // 스냅샷 → 서버 전환 시 변경분만 set하여 불필요한 리렌더 방지
      const current = get()
      // userTaskSettings: 스냅샷에서 이미 복원된 값이 있으면 유지
      const currentUts = current.userTaskSettings
      const mergedUts = (currentUts && currentUts.length > 0) ? currentUts : taskSettings
      const patch = { collapseState: cs, syncStatus: 'ok', userTaskSettings: mergedUts, milestones }
      if (!isArrayEqual(current.tasks, tasks)) patch.tasks = tasks
      if (!isArrayEqual(current.projects, projects)) patch.projects = projects
      if (!isArrayEqual(current.memos, memos)) patch.memos = memos
      set(patch)

      // 스냅샷 저장 (PWA 로딩 속도 개선)
      try {
        const snapshot = { tasks, projects, memos, teamId, timestamp: Date.now(), collapseState: get().collapseState, userTaskSettings: get().userTaskSettings }
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
      } catch (e) {
        // localStorage 용량 초과 시 무시
      }
    } catch (e) {
      console.error('[Ryan Todo] loadAll:', e)
      set({ syncStatus: 'error' })
    } finally {
      _loadAllRunning = false
    }
  },

  // ─── Task CRUD ───
  addTask: async (task) => {
    // Loop-20: 팀 모드일 때 team_id/scope/createdBy 자동 설정
    const teamId = get().currentTeamId
    const userId = await getCurrentUserId()
    // 프로젝트 소속 확인 — 팀 프로젝트면 해당 팀으로 설정
    const project = task.projectId ? get().projects.find(p => p.id === task.projectId) : null
    const effectiveTeamId = project?.teamId || teamId
    const teamDefaults = effectiveTeamId
      ? { teamId: effectiveTeamId, scope: task.scope || 'team', createdBy: userId }
      : { scope: 'private', createdBy: userId }
    const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...teamDefaults, ...task }
    set(s => ({ tasks: [...s.tasks, t] }))
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    const { error } = await safeUpsertTask(d, t)
    if (error) console.error('[Ryan Todo] addTask:', error)
    set({ syncStatus: error ? 'error' : 'ok' })
    if (!error) get().showToast('추가됐습니다 ✓')
  },

  updateTask: async (id, patch) => {
    const currentTask = get().tasks.find(x => x.id === id)
    if (!currentTask) return
    const resolvedPatch = applyTransitionRules(currentTask, patch)
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...resolvedPatch } : t) }))
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    const { error } = await safeUpsertTask(d, t)
    if (error) console.error('[Ryan Todo] updateTask:', error)
    set({ syncStatus: error ? 'error' : 'ok' })
  },

  deleteTask: async (id) => {
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id), detailTask: null }))
    const d = db()
    if (d) {
      // Loop-23: soft delete (hard DELETE → UPDATE deleted_at), fallback to hard delete
      if (_deletedAtColExists) {
        const { error } = await d.from('tasks').update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id)
        if (error) {
          // 컬럼 없으면 hard delete fallback
          await d.from('tasks').delete().eq('id', id)
        }
      } else {
        const { error } = await d.from('tasks').delete().eq('id', id)
        if (error) console.error('[Ryan Todo] deleteTask:', error)
      }
    }
    get().showToast('삭제됐습니다')
  },

  // ─── Toggle Done (Loop-31: category 변경 안 함, done만 토글) ───
  toggleDone: async (id) => {
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    if (!t.done) {
      // Mark done → applyTransitionRules R3가 prevCategory 자동 저장
      get().updateTask(id, { done: true })
      setTimeout(() => {
        get().showToast('할일이 완료되었습니다', { undoTaskId: id, undoPrevCategory: t.category })
      }, 300)
    } else {
      // Undo → applyTransitionRules R4가 prevCategory='' 자동 설정
      get().updateTask(id, { done: false })
    }
  },

  // ─── Undo completion (called from toast) ───
  undoComplete: (taskId, prevCategory) => {
    // Loop-31: done=false만 전달, R4가 prevCategory='' 자동 처리
    get().updateTask(taskId, { done: false })
    set({ toast: null })
  },

  // ─── Move task to different category ───
  moveTask: async (id, newCategory) => {
    get().updateTask(id, { category: newCategory })
  },

  // ─── Move task to different project/category (DnD) ───
  // Loop-31: done 처리는 호출부에서 명시적으로 patch에 포함
  moveTaskTo: async (id, projectId, category) => {
    get().updateTask(id, { projectId, category })
  },

  // ─── Reorder tasks (batch sortOrder update) ───
  reorderTasks: async (reorderedTasks) => {
    const updates = reorderedTasks.map((t, i) => ({ id: t.id, sortOrder: i }))
    set(s => ({
      tasks: s.tasks.map(t => {
        const u = updates.find(x => x.id === t.id)
        return u ? { ...t, sortOrder: u.sortOrder } : t
      })
    }))
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    for (const u of updates) {
      const t = get().tasks.find(x => x.id === u.id)
      if (!t) continue
      await safeUpsertTask(d, t)
    }
    set({ syncStatus: 'ok' })
  },

  // ─── Project CRUD ───
  addProject: async (name, color, projectScope) => {
    const teamId = get().currentTeamId
    const userId = await getCurrentUserId()
    const p = {
      id: uid(), name, color, sortOrder: Date.now(),
      // Loop-20 보완: 팀/개인 프로젝트 분기
      teamId: (teamId && projectScope !== 'personal') ? teamId : null,
      userId: (!teamId || projectScope === 'personal') ? userId : null,
      ownerId: userId,
      // Loop-32: 새 필드 기본값
      description: '',
      start_date: null,
      due_date: null,
      status: 'active',
      created_by: userId,
    }
    set(s => ({ projects: [...s.projects, p] }))
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId, user_id: p.userId, owner_id: p.ownerId,
      description: p.description, start_date: p.start_date,
      due_date: p.due_date, status: p.status, created_by: p.created_by,
    })
    if (error) console.error('[Ryan Todo] addProject:', error)
  },

  updateProject: async (id, patch) => {
    // 소속 변경 차단 — 이 필드들은 업데이트에서 절대 제외
    const {
      teamId, userId,          // camelCase (프론트)
      team_id, user_id,        // snake_case (DB)
      created_by, createdBy,   // 생성자도 변경 불가
      id: _id,                 // id도 변경 불가
      ...safePatch
    } = patch

    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...safePatch } : p) }))
    const p = get().projects.find(x => x.id === id)
    if (!p) return
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId || null, user_id: p.userId || null, owner_id: p.ownerId || null,
      description: p.description ?? '', start_date: p.start_date || null,
      due_date: p.due_date || null, status: p.status || 'active',
      created_by: p.created_by || null,
    })
    if (error) console.error('[Ryan Todo] updateProject:', error)
  },

  deleteProject: async (id) => {
    const project = get().projects.find(p => p.id === id)
    if (!project) return

    // 팀 프로젝트: 팀장만 삭제 가능
    const teamId = get().currentTeamId
    if (project.teamId && teamId) {
      const myRole = get().myRole
      if (myRole !== 'owner') {
        console.warn('[deleteProject] 팀 프로젝트 삭제는 팀장만 가능합니다')
        return
      }
    }

    // 개인 프로젝트: 본인 소유인지 확인
    if (!project.teamId) {
      const userId = _cachedUserId || (await getCurrentUserId())
      if (project.userId && project.userId !== userId) {
        console.warn('[deleteProject] 다른 사용자의 개인 프로젝트는 삭제할 수 없습니다')
        return
      }
    }

    const d = db()
    // Loop-23: 연관 tasks soft delete (fallback to hard delete)
    const taskIds = get().tasks.filter(t => t.projectId === id).map(t => t.id)
    if (d) {
      if (_deletedAtColExists) {
        await d.from('tasks').update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('project_id', id).is('deleted_at', null)
      } else {
        for (const tid of taskIds) {
          await d.from('tasks').delete().eq('id', tid)
        }
      }
    }
    set(s => ({
      tasks: s.tasks.filter(t => t.projectId !== id),
      projects: s.projects.filter(p => p.id !== id),
    }))
    if (d) {
      const { error } = await d.from('projects').delete().eq('id', id)
      if (error) console.error('[Ryan Todo] deleteProject:', error)
    }
    get().showToast('프로젝트가 삭제됐습니다')
  },

  reorderProjects: async (newList) => {
    // 로컬 순서 저장 (DB 업데이트 안 함 → 개인별 적용)
    const orderMap = {}
    newList.forEach((p, i) => { orderMap[p.id] = i })
    const { localProjectOrder } = get()
    const merged = { ...localProjectOrder, ...orderMap }
    set({ localProjectOrder: merged })
    localStorage.setItem('localProjectOrder', JSON.stringify(merged))
  },

  // ─── Memo CRUD ───
  addMemo: async (memo) => {
    const m = { id: crypto.randomUUID(), title: '', notes: '', color: 'yellow', sortOrder: Date.now(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...memo }
    set(s => ({ memos: [...s.memos, m] }))
    const d = db()
    if (!d) return
    const userId = await getCurrentUserId()
    const { error } = await d.from('memos').upsert({
      id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
    })
    if (error) console.error('[Ryan Todo] addMemo:', error)
  },

  updateMemo: async (id, patch) => {
    set(s => ({ memos: s.memos.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m) }))
    const m = get().memos.find(x => x.id === id)
    if (!m) return
    const d = db()
    if (!d) return
    const userId = await getCurrentUserId()
    const { error } = await d.from('memos').upsert({
      id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder, user_id: userId,
    })
    if (error) console.error('[Ryan Todo] updateMemo:', error)
  },

  deleteMemo: async (id) => {
    set(s => ({ memos: s.memos.filter(m => m.id !== id) }))
    const d = db()
    if (d) {
      const { error } = await d.from('memos').delete().eq('id', id)
      if (error) console.error('[Ryan Todo] deleteMemo:', error)
    }
    get().showToast('메모가 삭제됐습니다')
  },

  // ─── Milestone CRUD (Loop-37: 계층형 마일스톤) ───
  addMilestone: async (projectId, pkmId, title, parentId = null) => {
    const d = db()
    if (!d) return null
    const userId = getCachedUserId()
    const parentMs = parentId ? get().milestones.find(m => m.id === parentId) : null
    const depth = parentMs ? (parentMs.depth || 0) + 1 : 0
    const siblings = get().milestones.filter(m => m.project_id === projectId && m.parent_id === parentId)
    const sortOrder = siblings.length

    const { data, error } = await d.from('key_milestones')
      .insert({
        pkm_id: pkmId,
        project_id: projectId,
        title,
        parent_id: parentId,
        depth,
        sort_order: sortOrder,
        created_by: userId,
        owner_id: null,
        status: 'not_started',
      })
      .select('id, pkm_id, project_id, title, color, sort_order, owner_id, status, start_date, end_date, created_by, parent_id, depth')
      .single()
    if (error) { console.error('[useStore] addMilestone:', error); return null }
    if (data) set({ milestones: [...get().milestones, data] })
    return data
  },

  updateMilestone: async (id, patch) => {
    const d = db()
    if (!d) return
    // 로컬 즉시 반영
    set(s => ({ milestones: s.milestones.map(m => m.id === id ? { ...m, ...patch } : m) }))
    const { error } = await d.from('key_milestones')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) console.error('[useStore] updateMilestone:', error)
  },

  deleteMilestone: async (id) => {
    const d = db()
    if (!d) return
    // CASCADE 삭제: 하위 MS도 DB에서 자동 삭제 → 로컬에서도 제거
    const toDelete = new Set()
    const walk = (targetId) => {
      toDelete.add(targetId)
      get().milestones.filter(m => m.parent_id === targetId).forEach(m => walk(m.id))
    }
    walk(id)
    set(s => ({ milestones: s.milestones.filter(m => !toDelete.has(m.id)) }))
    const { error } = await d.from('key_milestones').delete().eq('id', id)
    if (error) console.error('[useStore] deleteMilestone:', error)
  },

  reorderMilestones: async (reordered) => {
    const d = db()
    if (!d) return
    // 로컬 즉시 반영
    const reorderedMap = new Map(reordered.map((m, i) => [m.id, i]))
    set(s => ({
      milestones: s.milestones.map(m => reorderedMap.has(m.id)
        ? { ...m, sort_order: reorderedMap.get(m.id) }
        : m
      )
    }))
    // DB 업데이트
    for (let i = 0; i < reordered.length; i++) {
      await d.from('key_milestones')
        .update({ sort_order: i, updated_at: new Date().toISOString() })
        .eq('id', reordered[i].id)
    }
  },

  moveMilestone: async (id, newParentId) => {
    const d = db()
    if (!d) return
    const parentMs = newParentId ? get().milestones.find(m => m.id === newParentId) : null
    const depth = parentMs ? (parentMs.depth || 0) + 1 : 0
    const projectId = get().milestones.find(m => m.id === id)?.project_id
    const siblings = get().milestones.filter(m => m.project_id === projectId && m.parent_id === newParentId && m.id !== id)
    const sortOrder = siblings.length

    // 하위 노드 depth도 재귀 업데이트
    const updates = []
    const walkDepth = (targetId, parentDepth) => {
      get().milestones.filter(m => m.parent_id === targetId).forEach(child => {
        const newD = parentDepth + 1
        updates.push({ id: child.id, depth: newD })
        walkDepth(child.id, newD)
      })
    }
    walkDepth(id, depth)

    set(s => ({
      milestones: s.milestones.map(m => {
        if (m.id === id) return { ...m, parent_id: newParentId, depth, sort_order: sortOrder }
        const upd = updates.find(u => u.id === m.id)
        if (upd) return { ...m, depth: upd.depth }
        return m
      })
    }))

    await d.from('key_milestones').update({ parent_id: newParentId, depth, sort_order: sortOrder, updated_at: new Date().toISOString() }).eq('id', id)
    for (const u of updates) {
      await d.from('key_milestones').update({ depth: u.depth, updated_at: new Date().toISOString() }).eq('id', u.id)
    }
  },

  // ─── Project Filter (Loop-20.2) ───
  projectFilter: 'all',  // 'all' | 'team' | 'personal'
  setProjectFilter: (filter) => set({ projectFilter: filter }),

  // ─── Project Section Order (팀/개인 섹션 순서) ───
  projectSectionOrder: JSON.parse(localStorage.getItem('projectSectionOrder') || '["team","personal"]'),
  setProjectSectionOrder: (order) => {
    set({ projectSectionOrder: order })
    localStorage.setItem('projectSectionOrder', JSON.stringify(order))
  },

  // ─── Local Project Order (개인별 프로젝트 순서) ───
  // { [projectId]: sortOrder } 형태로 저장
  localProjectOrder: JSON.parse(localStorage.getItem('localProjectOrder') || '{}'),
  setLocalProjectOrder: (orderMap) => {
    set({ localProjectOrder: orderMap })
    localStorage.setItem('localProjectOrder', JSON.stringify(orderMap))
  },

  // 로컬 순서 적용된 프로젝트 정렬
  sortProjectsLocally: (projectList) => {
    const { localProjectOrder } = get()
    return [...projectList].sort((a, b) => {
      const orderA = localProjectOrder[a.id] ?? a.sortOrder ?? 0
      const orderB = localProjectOrder[b.id] ?? b.sortOrder ?? 0
      return orderA - orderB
    })
  },

  // 섹션별로 정렬된 프로젝트 목록 반환
  getOrderedProjects: () => {
    const { projects, projectSectionOrder, currentTeamId, sortProjectsLocally } = get()
    if (!currentTeamId) return sortProjectsLocally(projects) // 개인 모드
    const teamPs = sortProjectsLocally(projects.filter(p => p.teamId === currentTeamId))
    const personalPs = sortProjectsLocally(projects.filter(p => !p.teamId))
    const sections = { team: teamPs, personal: personalPs }
    return [...(sections[projectSectionOrder[0]] || []), ...(sections[projectSectionOrder[1]] || [])]
  },

  // ─── Sync (Loop-23) ───
  commentRefreshTrigger: 0,
  notificationRefreshTrigger: 0,

  mergeSyncUpdate: (event) => {
    const { table, eventType, row } = event

    if (table === 'tasks') {
      set(s => {
        const tasks = [...s.tasks]

        if (eventType === 'DELETE') {
          return { tasks: tasks.filter(t => t.id !== row.id) }
        }

        const existingIdx = tasks.findIndex(t => t.id === row.id)
        const mapped = mapTask(row)

        if (existingIdx >= 0) {
          const existing = tasks[existingIdx]
          if (!existing.updatedAt || mapped.updatedAt > existing.updatedAt) {
            tasks[existingIdx] = mapped
          }
        } else {
          if (!mapped.deletedAt) {
            tasks.push(mapped)
          }
        }

        return { tasks }
      })
    }

    if (table === 'comments') {
      set(s => ({ commentRefreshTrigger: (s.commentRefreshTrigger || 0) + 1 }))
    }

    if (table === 'notifications') {
      set(s => ({ notificationRefreshTrigger: (s.notificationRefreshTrigger || 0) + 1 }))
    }
  },

  // ─── User Task Settings (개인별 강조 색상) ───
  userTaskSettings: [],

  loadUserTaskSettings: async () => {
    const teamId = get().currentTeamId
    if (!teamId) return
    const d = db()
    const userId = _cachedUserId
    if (!d || !userId) return
    const { data } = await d.from('user_task_settings')
      .select('task_id, highlight_color')
      .eq('user_id', userId)
    set({ userTaskSettings: (data || []).map(r => ({ taskId: r.task_id, highlightColor: r.highlight_color })) })
  },

  getHighlightColor: (taskId) => {
    const teamId = get().currentTeamId
    if (!teamId) {
      const task = get().tasks.find(t => t.id === taskId)
      return task?.highlightColor || null
    }
    const setting = get().userTaskSettings.find(s => s.taskId === taskId)
    return setting?.highlightColor || null
  },

  setHighlightColor: async (taskId, color) => {
    const teamId = get().currentTeamId
    const d = db()

    if (!teamId) {
      get().updateTask(taskId, { highlightColor: color })
      return
    }

    const userId = _cachedUserId
    if (!d || !userId) return

    // 로컬 상태 즉시 업데이트
    set(s => ({
      userTaskSettings: color
        ? [...s.userTaskSettings.filter(x => x.taskId !== taskId), { taskId, highlightColor: color }]
        : s.userTaskSettings.filter(x => x.taskId !== taskId)
    }))

    if (color) {
      await d.from('user_task_settings').upsert({
        user_id: userId,
        task_id: taskId,
        highlight_color: color,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,task_id' })
    } else {
      await d.from('user_task_settings').delete()
        .eq('user_id', userId)
        .eq('task_id', taskId)
    }
  },

  // ─── Notification Panel (Loop-22) ───
  showNotificationPanel: false,
  toggleNotificationPanel: () => set(s => ({
    showNotificationPanel: !s.showNotificationPanel,
    // DetailPanel과 동시 열림 방지
    ...(s.showNotificationPanel ? {} : { detailTask: null }),
  })),

  // ─── Team State (Loop-19) ───
  currentTeamId: localStorage.getItem('currentTeamId') || null,
  myTeams: [],
  myRole: null, // 'owner' | 'member' | null
  teamLoading: true,
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),

  modeSelected: !!localStorage.getItem('currentTeamId') || !!localStorage.getItem('modeSelected'),

  setTeam: async (teamId) => {
    const team = get().myTeams.find(t => t.id === teamId)
    set({
      currentTeamId: teamId || null,
      myRole: team?.myRole || null,
      modeSelected: true,
    })
    if (teamId) {
      localStorage.setItem('currentTeamId', teamId)
      localStorage.removeItem('modeSelected')
    } else {
      localStorage.removeItem('currentTeamId')
      localStorage.setItem('modeSelected', 'true')
    }
    // 팀 변경 시 해당 팀의 데이터 로드
    await get().loadAll()
  },

  setMyTeams: (teams) => set({ myTeams: teams }),

  initTeamState: async () => {
    const d = db()
    if (!d) { set({ teamLoading: false }); return }

    try {
      const { data: { user } } = await d.auth.getUser()
      if (!user) { set({ teamLoading: false }); return }

      const { data, error } = await d
        .from('team_members')
        .select('team_id, role, status, display_name, teams(id, name, description, invite_code, auto_approve, created_by)')
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (error) { console.error('[Ryan Todo] initTeamState:', error); set({ teamLoading: false }); return }

      const teams = (data || []).map(tm => ({
        id: tm.teams.id,
        name: tm.teams.name,
        description: tm.teams.description,
        inviteCode: tm.teams.invite_code,
        autoApprove: tm.teams.auto_approve,
        createdBy: tm.teams.created_by,
        myRole: tm.role,
        myDisplayName: tm.display_name,
      }))

      // Restore last selected team from localStorage
      const savedTeamId = localStorage.getItem('currentTeamId')
      const activeTeam = teams.find(t => t.id === savedTeamId) || null

      set({
        myTeams: teams,
        currentTeamId: activeTeam?.id || null,
        myRole: activeTeam?.myRole || null,
        teamLoading: false,
      })
    } catch (e) {
      console.error('[Ryan Todo] initTeamState:', e)
      set({ teamLoading: false })
    }
  },

  skipOnboarding: () => {
    localStorage.setItem('onboardingSkipped', 'true')
    set({ onboardingSkipped: true })
  },

  // ─── Project Layer (Loop-26.2) ───
  selectedProjectId: null,
  projectLayerTab: 'milestone',     // 'milestone' | 'tasks' | 'ptimeline'
  projectTimelineMode: 'gantt',     // 'gantt' | 'detail'

  enterProjectLayer: (projectId) => set({
    currentView: 'projectLayer',
    selectedProjectId: projectId,
    projectLayerTab: 'milestone',
  }),

  setProjectLayerTab: (tab) => set({ projectLayerTab: tab }),
  setProjectTimelineMode: (mode) => set({ projectTimelineMode: mode }),
}))

export default useStore
