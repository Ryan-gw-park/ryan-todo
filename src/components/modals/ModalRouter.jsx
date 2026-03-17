import { lazy, Suspense, Component } from 'react'
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
        <ModalErrorBoundary onError={closeModal}>
          <Suspense fallback={null}>
            <Backdrop onClick={closeModal}>
              <ProjectSettingsModal />
            </Backdrop>
          </Suspense>
        </ModalErrorBoundary>
      )}
      {activeModal?.type === 'milestoneDetail' && (
        <ModalErrorBoundary onError={closeModal}>
          <Suspense fallback={null}>
            <Backdrop onClick={closeModal}>
              <MilestoneDetailModal />
            </Backdrop>
          </Suspense>
        </ModalErrorBoundary>
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

class ModalErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ModalRouter] Modal crashed:', error, info?.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          onClick={() => { this.setState({ hasError: false, error: null }); this.props.onError?.() }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 12, padding: '24px 32px',
            boxShadow: '0 8px 32px rgba(0,0,0,.12)', textAlign: 'center', maxWidth: 360,
          }}>
            <p style={{ fontSize: 14, color: '#333', margin: '0 0 8px' }}>모달을 불러오는 중 오류가 발생했습니다.</p>
            <p style={{ fontSize: 12, color: '#999', margin: '0 0 16px' }}>
              {this.state.error?.message || '알 수 없는 오류'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); this.props.onError?.() }}
              style={{
                fontSize: 13, padding: '6px 20px', border: '1px solid #e8e6df',
                borderRadius: 6, background: '#fff', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
