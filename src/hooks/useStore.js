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

function taskToRow(t) {
  const row = {
    id: t.id, text: t.text, project_id: t.projectId, category: t.category,
    done: t.done, due_date: t.dueDate || null, start_date: t.startDate || null,
    notes: t.notes, prev_category: t.prevCategory || null, sort_order: t.sortOrder,
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
  return { id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0 }
}
function mapTask(r) {
  return {
    id: r.id, text: r.text, projectId: r.project_id, category: r.category || 'backlog',
    done: r.done || false, dueDate: r.due_date || '', startDate: r.start_date || '',
    notes: r.notes || '', prevCategory: r.prev_category || '',
    sortOrder: r.sort_order || 0, alarm: r.alarm ?? null,
  }
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

  setView: (v) => set({ currentView: v }),
  logout: async () => {
    const d = db()
    if (d) await d.auth.signOut()
  },
  openDetail: (task) => set({ detailTask: task }),
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
      const [pr, tr, mr] = await Promise.all([
        d.from('projects').select('*').order('sort_order'),
        d.from('tasks').select('*').order('sort_order'),
        d.from('memos').select('*').order('sort_order'),
      ])
      if (pr.error) throw pr.error
      if (tr.error) throw tr.error
      set({
        projects: pr.data.map(mapProject),
        tasks: tr.data.map(mapTask),
        memos: mr.error ? [] : mr.data.map(mapMemo),
        syncStatus: 'ok',
      })
    } catch (e) {
      console.error('[Ryan Todo] loadAll:', e)
      set({ syncStatus: 'error' })
    }
  },

  // ─── Task CRUD ───
  addTask: async (task) => {
    const t = { id: uid(), done: false, notes: '', sortOrder: Date.now(), category: 'today', alarm: null, ...task }
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
      const { error } = await d.from('tasks').delete().eq('id', id)
      if (error) console.error('[Ryan Todo] deleteTask:', error)
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
  addProject: async (name, color) => {
    const p = { id: uid(), name, color, sortOrder: Date.now() }
    set(s => ({ projects: [...s.projects, p] }))
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder })
    if (error) console.error('[Ryan Todo] addProject:', error)
  },

  updateProject: async (id, patch) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }))
    const p = get().projects.find(x => x.id === id)
    if (!p) return
    const d = db()
    if (!d) return
    const { error } = await d.from('projects').upsert({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder })
    if (error) console.error('[Ryan Todo] updateProject:', error)
  },

  deleteProject: async (id) => {
    const d = db()
    const taskIds = get().tasks.filter(t => t.projectId === id).map(t => t.id)
    if (d) {
      for (const tid of taskIds) {
        await d.from('tasks').delete().eq('id', tid)
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
    const rows = reordered.map(p => ({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder }))
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
    const { error } = await d.from('memos').upsert({
      id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder,
    })
    if (error) console.error('[Ryan Todo] addMemo:', error)
  },

  updateMemo: async (id, patch) => {
    set(s => ({ memos: s.memos.map(m => m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m) }))
    const m = get().memos.find(x => x.id === id)
    if (!m) return
    const d = db()
    if (!d) return
    const { error } = await d.from('memos').upsert({
      id: m.id, title: m.title, notes: m.notes, color: m.color, sort_order: m.sortOrder,
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
}))

export default useStore
