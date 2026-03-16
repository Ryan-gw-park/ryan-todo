import AuthForm from '../auth/AuthForm'

export default function LoginScreen({ authError }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Logo */}
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: '#37352f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 12,
        }}>R</div>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#37352f', margin: '0 0 8px' }}>
          Ryan's Todo
        </h1>
        <p style={{ fontSize: 14, color: '#999', marginBottom: 32 }}>
          개인 업무 관리
        </p>

        <AuthForm
          redirectTo={window.location.origin}
          externalError={authError}
        />
      </div>
    </div>
  )
}
