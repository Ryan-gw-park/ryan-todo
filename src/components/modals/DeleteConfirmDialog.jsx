import useStore from '../../hooks/useStore'


export default function DeleteConfirmDialog() {
  const confirmDialog = useStore(s => s.confirmDialog)
  const closeConfirmDialog = useStore(s => s.closeConfirmDialog)
  const closeModal = useStore(s => s.closeModal)
  const openModal = useStore(s => s.openModal)
  const deleteProject = useStore(s => s.deleteProject)
  const deleteMilestone = useStore(s => s.deleteMilestone)

  if (!confirmDialog) return null

  const { target, targetId, targetName, meta } = confirmDialog

  const handleConfirm = async () => {
    if (target === 'project') {
      await deleteProject(targetId)
      closeConfirmDialog()
      closeModal()
    } else if (target === 'milestone') {
      await deleteMilestone(targetId)
      closeConfirmDialog()
      if (meta?.returnTo) {
        openModal(meta.returnTo)
      } else {
        closeModal()
      }
    }
  }

  const handleCancel = () => {
    closeConfirmDialog()
  }

  return (
    <div
      onClick={handleCancel}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, border: '0.5px solid #e8e6df',
          maxWidth: 380, width: '90%', padding: '28px 24px 20px', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,.15)',
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: 28, marginBottom: 12 }}>&#9888;</div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2C2C2A', marginBottom: 12 }}>
          '{targetName || '항목'}'을(를) 삭제하시겠습니까?
        </div>

        {/* Warning box for project */}
        {target === 'project' && (
          <div style={{
            background: '#FCEBEB', color: '#791F1F', borderRadius: 6,
            padding: '8px 12px', fontSize: 13, marginBottom: 16, lineHeight: 1.5,
          }}>
            이 프로젝트에 연결된 {meta?.milestoneCount || 0}개 마일스톤과 {meta?.taskCount || 0}개 할일이 모두 삭제됩니다.
            <br />이 작업은 되돌릴 수 없습니다.
          </div>
        )}

        {/* Info for milestone */}
        {target === 'milestone' && (
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 1.5 }}>
            '{targetName}' 마일스톤을 삭제하면 연결된 {meta?.taskCount || 0}개 할일의 마일스톤 연결이 해제됩니다.
            <br />할일 자체는 삭제되지 않습니다.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={handleCancel}
            style={{
              fontSize: 13, padding: '7px 20px', borderRadius: 6,
              border: '1px solid #e8e6df', background: '#fff', cursor: 'pointer',
              fontFamily: 'inherit', color: '#666',
            }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            style={{
              fontSize: 13, padding: '7px 20px', borderRadius: 6,
              border: 'none', background: '#c53030', cursor: 'pointer',
              fontFamily: 'inherit', color: '#fff', fontWeight: 600,
            }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
