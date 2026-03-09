import { useEffect, useState } from 'react'
import useStore from './store/useStore'
import { hasCreds } from './lib/supabase'
import SetupScreen from './components/setup/SetupScreen'
import TopBar from './components/layout/TopBar'
import BottomNav from './components/layout/BottomNav'
import TodayView from './components/views/TodayView'
import MatrixView from './components/views/MatrixView'
import AllView from './components/views/AllView'
import BoardView from './components/views/BoardView'
import TableView from './components/views/TableView'
import GanttView from './components/views/GanttView'
import TaskDetailPanel from './components/shared/TaskDetailPanel'
import AddTaskModal from './components/shared/AddTaskModal'
import Toast from './components/shared/Toast'

function isMobile() { return window.innerWidth <= 640 }

export default function App() {
  const [connected, setConnected] = useState(hasCreds())
  const { currentView, setView, loadAll, closeModal, closeDetail } = useStore()

  useEffect(() => {
    if (connected) {
      setView(isMobile() ? 'today' : 'matrix')
      loadAll()
      const interval = setInterval(loadAll, 60000)
      return () => clearInterval(interval)
    }
  }, [connected])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        closeModal()
        closeDetail()
      }
      if (e.key === 'n' && document.activeElement === document.body) {
        useStore.getState().openModal()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!connected) {
    return <SetupScreen onConnect={() => setConnected(true)} />
  }

  const views = {
    today: TodayView,
    matrix: MatrixView,
    all: AllView,
    board: BoardView,
    table: TableView,
    gantt: GanttView,
  }
  const ViewComponent = views[currentView] || TodayView

  return (
    <div className="flex flex-col h-screen">
      <TopBar />
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>
        <ViewComponent />
      </div>
      <BottomNav />
      <TaskDetailPanel />
      <AddTaskModal />
      <Toast />
    </div>
  )
}
