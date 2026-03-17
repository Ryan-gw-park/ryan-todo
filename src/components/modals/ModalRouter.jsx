import { lazy, Suspense } from 'react'
import useStore from '../../hooks/useStore'

const ProjectSettingsModal = lazy(() => import('./ProjectSettingsModal'))
const MilestoneDetailModal = lazy(() => import('./MilestoneDetailModal'))
const DeleteConfirmDialog = lazy(() => import('./DeleteConfirmDialog'))

export default function ModalRouter() {
  const activeModal = useStore(s => s.activeModal)
  const confirmDialog = useStore(s => s.confirmDialog)
  const closeModal = useStore(s => s.closeModal)

  if (!activeModal && !confirmDialog) return null

  return (
    <>
      {activeModal?.type === 'projectSettings' && (
        <Suspense fallback={null}>
          <Backdrop onClick={closeModal}>
            <ProjectSettingsModal />
          </Backdrop>
        </Suspense>
      )}
      {activeModal?.type === 'milestoneDetail' && (
        <Suspense fallback={null}>
          <Backdrop onClick={closeModal}>
            <MilestoneDetailModal />
          </Backdrop>
        </Suspense>
      )}
      {confirmDialog && (
        <Suspense fallback={null}>
          <DeleteConfirmDialog />
        </Suspense>
      )}
    </>
  )
}

function Backdrop({ onClick, children }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClick() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh', zIndex: 1000,
      }}
    >
      {children}
    </div>
  )
}
