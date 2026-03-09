import { create } from 'zustand'
import { getDb } from '../lib/supabase'
import { nextColor } from '../lib/colors'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function mapProject(r) {
  return { id: r.id, name: r.name, color: r.color, sortOrder: r.sort_order || 0 }
}
function mapCategory(r) {
  return { id: r.id, name: r.name, color: r.color, bg: r.bg || '', sortOrder: r.sort_order || 0 }
}
function mapTask(r) {
  return {
    id: r.id, text: r.text, projectId: r.project_id, categoryId: r.category_id,
    done: r.done || false, startDate: r.start_date || '', dueDate: r.due_date || '',
    notes: r.notes || [], sortOrder: r.sort_order || 0,
  }
}

const useStore = create((set, get) => ({
  projects: [],
  categories: [],
  tasks: [],
  syncStatus: 'ok',
  currentView: 'today',
  detailTaskId: null,
  modalOpen: false,
  modalDefaults: {},
  toastMsg: '',

  setView: (v) => set({ currentView: v }),
  openDetail: (id) => set({ detailTaskId: id }),
  closeDetail: () => set({ detailTaskId: null }),
  openModal: (defaults = {}) => set({ modalOpen: true, modalDefaults: defaults }),
  closeModal: () => set({ modalOpen: false, modalDefaults: {} }),
  showToast: (msg) => {
    set({ toastMsg: msg })
    setTimeout(() => set({ toastMsg: '' }), 2200)
  },

  loadAll: async () => {
    set({ syncStatus: 'syncing' })
    try {
      const [pr, cr, tr] = await Promise.all([
        getDb().from('projects').select('*').order('sort_order'),
        getDb().from('categories').select('*').order('sort_order'),
        getDb().from('tasks').select('*').order('sort_order'),
      ])
      if (pr.error) throw pr.error
      if (cr.error) throw cr.error
      if (tr.error) throw tr.error
      set({
        projects: pr.data.map(mapProject),
        categories: cr.data.map(mapCategory),
        tasks: tr.data.map(mapTask),
        syncStatus: 'ok',
      })
    } catch {
      set({ syncStatus: 'error' })
    }
  },

  addTask: async (task) => {
    const t = { id: uid(), done: false, notes: [], sortOrder: Date.now(), ...task }
    set(s => ({ tasks: [...s.tasks, t] }))
    set({ syncStatus: 'syncing' })
    const { error } = await getDb().from('tasks').upsert({
      id: t.id, text: t.text, project_id: t.projectId, category_id: t.categoryId,
      done: t.done, start_date: t.startDate || null, due_date: t.dueDate || null,
      notes: t.notes, sort_order: t.sortOrder,
    })
    set({ syncStatus: error ? 'error' : 'ok' })
    if (error) get().showToast('저장 실패')
    else get().showToast('추가됐습니다 ✓')
  },

  updateTask: async (id, patch) => {
    set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch } : t) }))
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    set({ syncStatus: 'syncing' })
    const { error } = await getDb().from('tasks').upsert({
      id: t.id, text: t.text, project_id: t.projectId, category_id: t.categoryId,
      done: t.done, start_date: t.startDate || null, due_date: t.dueDate || null,
      notes: t.notes, sort_order: t.sortOrder,
    })
    set({ syncStatus: error ? 'error' : 'ok' })
  },

  toggleDone: async (id) => {
    const t = get().tasks.find(x => x.id === id)
    if (!t) return
    get().updateTask(id, { done: !t.done })
  },

  deleteTask: async (id) => {
    set(s => ({ tasks: s.tasks.filter(t => t.id !== id) }))
    await getDb().from('tasks').delete().eq('id', id)
    get().showToast('삭제됐습니다')
  },

  addProject: async (name) => {
    const color = nextColor(get().projects.length)
    const p = { id: uid(), name, color, sortOrder: get().projects.length }
    set(s => ({ projects: [...s.projects, p] }))
    await getDb().from('projects').upsert({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder })
  },

  updateProject: async (id, patch) => {
    set(s => ({ projects: s.projects.map(p => p.id === id ? { ...p, ...patch } : p) }))
    const p = get().projects.find(x => x.id === id)
    if (!p) return
    await getDb().from('projects').upsert({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder })
  },

  deleteProject: async (id) => {
    const taskIds = get().tasks.filter(t => t.projectId === id).map(t => t.id)
    for (const tid of taskIds) await getDb().from('tasks').delete().eq('id', tid)
    set(s => ({
      tasks: s.tasks.filter(t => t.projectId !== id),
      projects: s.projects.filter(p => p.id !== id),
    }))
    await getDb().from('projects').delete().eq('id', id)
    get().showToast('프로젝트가 삭제됐습니다')
  },

  reorderProjects: async (newOrder) => {
    const reordered = newOrder.map((id, i) => {
      const p = get().projects.find(x => x.id === id)
      return { ...p, sortOrder: i }
    })
    set({ projects: reordered, syncStatus: 'syncing' })
    const rows = reordered.map(p => ({ id: p.id, name: p.name, color: p.color, sort_order: p.sortOrder }))
    const { error } = await getDb().from('projects').upsert(rows)
    set({ syncStatus: error ? 'error' : 'ok' })
    if (!error) get().showToast('순서가 변경됐습니다 ✓')
  },

  moveTask: async (taskId, newProjectId, newCategoryId) => {
    get().updateTask(taskId, { projectId: newProjectId, categoryId: newCategoryId })
    get().showToast('이동됐습니다 ✓')
  },
}))

export default useStore
