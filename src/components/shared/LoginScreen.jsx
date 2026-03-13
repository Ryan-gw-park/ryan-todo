import { useState } from 'react'
import { getDb } from '../../utils/supabase'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const btnStyle = {
  padding: '10px 20px', borderRadius: 8, border: '1px solid #ddd',
  background: 'white', fontSize: 14, fontWeight: 500, color: '#37352f',
  cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s',
}

function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '20px 0' }}>
      <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
      <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>또는</span>
      <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
    </div>
  )
}

export default function LoginScreen({ authError }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Magic Link state
  const [magicEmail, setMagicEmail] = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)


  // Preserve current path (e.g., /invite/token) for post-auth redirect
  const redirectUrl = window.location.href

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    const supabase = getDb()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    })
    setLoading(false)
    if (authError) {
      setError('로그인에 실패했습니다. ' + (authError.message || ''))
    }
  }

  const handleMagicLink = async () => {
    if (!magicEmail.trim()) return
    setError('')
    setMagicSent(false)
    setMagicLoading(true)
    const supabase = getDb()
    const { error: magicError } = await supabase.auth.signInWithOtp({
      email: magicEmail.trim(),
      options: { emailRedirectTo: redirectUrl }
    })
    setMagicLoading(false)
    if (magicError) {
      setError(magicError.message || 'Magic Link 발송에 실패했습니다.')
    } else {
      setMagicSent(true)
    }
  }

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

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 24px', borderRadius: 8,
            border: '1px solid #ddd', background: 'white',
            fontSize: 15, fontWeight: 500, color: '#37352f',
            cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'box-shadow 0.15s',
            opacity: loading ? 0.6 : 1,
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)'}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? '로그인 중...' : 'Google로 로그인'}
        </button>

        {/* --- Magic Link --- */}
        <Divider />

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="email"
            placeholder="이메일 주소"
            value={magicEmail}
            onChange={e => { setMagicEmail(e.target.value); setMagicSent(false) }}
            onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
            style={inputStyle}
          />
          <button
            onClick={handleMagicLink}
            disabled={magicLoading || !magicEmail.trim()}
            style={{ ...btnStyle, width: '100%', opacity: (magicLoading || !magicEmail.trim()) ? 0.6 : 1 }}
          >
            {magicLoading ? '발송 중...' : '이메일 인증하기'}
          </button>
          {magicSent && (
            <p style={{ fontSize: 13, color: '#22c55e', margin: 0, textAlign: 'center' }}>
              이메일을 확인해주세요
            </p>
          )}
        </div>

        {/* Error messages */}
        {(error || authError) && (
          <p style={{ color: '#ef4444', fontSize: 13, marginTop: 16, textAlign: 'center' }}>
            {error || authError}
          </p>
        )}
      </div>
    </div>
  )
}
