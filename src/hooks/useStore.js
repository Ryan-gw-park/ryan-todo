import { create } from 'zustand'
import { getDb } from '../utils/supabase'
import { CATEGORIES } from '../utils/colors'

/**
 * @typedef {Object} TaskAlarm
 * @property {boolean} enabled
 * @property {string} datetime  - ISO 8601, e.g. "2025-03-15T09:00:00"
 * @property {'none'|'daily'|'weekly'} repeat
 * @property {boolean} notified - 이미 발송된 알람인지
 */

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

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
  }
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
  syncStatus: 'ok',
  currentView: 'today',
  detailTask: null,
  showProjectMgr: false,
  toast: null, // { msg, undoTaskId?, undoPrevCategory? }
  userName: 'Ryan',
  setUserName: (name) => set({ userName: name }),

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

  setView: (v) => set({ currentView: v }),
  logout: async () => {
    const d = db()
    if (d) await d.auth.signOut()
  },
  openDetail: (task) => set({ detailTask: task, showNotificationPanel: false }),
  closeDetail: () => set({ detailTask: null }),
  setShowProjectMgr: (v) => set({ showProjectMgr: v }),
  showToast: (msg, opts) => {
    const id = Date.now()
    set({ toast: { msg, id, ...opts } })
    setTimeout(() => set(s => s.toast?.id === id ? { toast: null } : {}), 2500)
  },
  clearToast: () => set({ toast: null }),

  // ─── Load All ───
  loadAll: async () => {
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    set({ syncStatus: 'syncing' })
    try {
      const teamId = get().currentTeamId

      // Loop-20: 팀 모드 필터 — tasks 쿼리 분기
      let tasksQuery = d.from('tasks').select('*')
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

      // Loop-20 보완: 팀 모드 프로젝트 필터 — 팀 프로젝트 + 본인 개인 프로젝트
      let projectsQuery = d.from('projects').select('*').order('sort_order')
      if (teamId) {
        const uid = _cachedUserId || (await d.auth.getUser()).data?.user?.id
        if (uid) {
          projectsQuery = projectsQuery.or(`team_id.eq.${teamId},user_id.eq.${uid}`)
        }
      }

      const [pr, trResult, mr, uiR] = await Promise.all([
        projectsQuery,
        tasksQuery,
        d.from('memos').select('*').order('sort_order'),
        d.from('ui_state').select('collapse_state').eq('id', 'default').maybeSingle(),
      ])
      if (pr.error) throw pr.error

      // Loop-23: deleted_at 컬럼 없으면 필터 없이 재시도
      let tr = trResult
      if (tr.error && !_deletedAtColChecked && _deletedAtColExists) {
        _deletedAtColChecked = true
        _deletedAtColExists = false
        let retryQuery = d.from('tasks').select('*').order('sort_order')
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

      // Merge loaded collapse state with defaults
      const loaded = uiR?.data?.collapse_state || {}
      const cs = { ..._defaultCollapseState }
      for (const key of Object.keys(cs)) {
        if (loaded[key] && typeof loaded[key] === 'object') {
          cs[key] = loaded[key]
        }
      }

      set({
        projects: pr.data.map(mapProject),
        tasks: tr.data.map(mapTask),
        memos: mr.error ? [] : mr.data.map(mapMemo),
        collapseState: cs,
        syncStatus: 'ok',
      })

      // 팀 모드: 개인별 강조 색상 로드
      if (teamId) {
        get().loadUserTaskSettings()
      }
    } catch (e) {
      console.error('[Ryan Todo] loadAll:', e)
      set({ syncStatus: 'error' })
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
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }))
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

  // ─── Toggle Done (auto-move category) ───
  toggleDone: async (id) => {
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    if (!t.done) {
      // Mark done → move to "done" category + show toast with undo
      get().updateTask(id, { done: true, category: 'done', prevCategory: t.category })
      setTimeout(() => {
        get().showToast('할일이 완료되었습니다', { undoTaskId: id, undoPrevCategory: t.category })
      }, 300)
    } else {
      // Undo → move back to prev category
      const dest = t.prevCategory && t.prevCategory !== 'done' ? t.prevCategory : 'backlog'
      get().updateTask(id, { done: false, category: dest, prevCategory: '' })
    }
  },

  // ─── Undo completion (called from toast) ───
  undoComplete: (taskId, prevCategory) => {
    const dest = prevCategory && prevCategory !== 'done' ? prevCategory : 'backlog'
    get().updateTask(taskId, { done: false, category: dest, prevCategory: '' })
    set({ toast: null })
  },

  // ─── Move task to different category ───
  moveTask: async (id, newCategory) => {
    get().updateTask(id, { category: newCategory })
  },

  // ─── Move task to different project/category (DnD) ───
  moveTaskTo: async (id, projectId, category) => {
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    const patch = { projectId, category }
    if (category === 'done' && !t.done) {
      patch.done = true
      patch.prevCategory = t.category !== 'done' ? t.category : t.prevCategory
    } else if (category !== 'done' && t.done) {
      patch.done = false
      patch.prevCategory = ''
    }
    get().updateTask(id, patch)
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
    }
    set(s => ({ projects: [...s.projects, p] }))
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId, user_id: p.userId,
    })
    if (error) console.error('[Ryan Todo] addProject:', error)
  },

  updateProject: async (id, patch) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }))
    const p = get().projects.find(x => x.id === id)
    if (!p) return
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({
      id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder,
      team_id: p.teamId || null, user_id: p.userId || null,
    })
    if (error) console.error('[Ryan Todo] updateProject:', error)
  },

  deleteProject: async (id) => {
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
    const reordered = newList.map((p, i) => ({ ...p, sortOrder: i }))
    set({ projects: reordered, syncStatus: 'syncing' })
    const d = db()
    if (!d) { set({ syncStatus: 'error' }); return }
    const rows = reordered.map(p => ({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder, team_id: p.teamId || null, user_id: p.userId || null }))
    const { error } = await d.from('projects').upsert(rows)
    if (error) console.error('[Ryan Todo] reorderProjects:', error)
    set({ syncStatus: error ? 'error' : 'ok' })
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

  // ─── Project Filter (Loop-20.2) ───
  projectFilter: 'all',  // 'all' | 'team' | 'personal'
  setProjectFilter: (filter) => set({ projectFilter: filter }),

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
  currentTeamId: null,
  myTeams: [],
  myRole: null, // 'owner' | 'member' | null
  teamLoading: true,
  onboardingSkipped: JSON.parse(localStorage.getItem('onboardingSkipped') || 'false'),

  modeSelected: !!localStorage.getItem('currentTeamId') || !!localStorage.getItem('modeSelected'),

  setTeam: (teamId) => {
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
}))

export default useStore
