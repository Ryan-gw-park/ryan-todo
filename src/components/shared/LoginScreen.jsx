import { useState } from 'react'
import { getDb } from '../../utils/supabase'

export default function LoginScreen({ authError }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    const supabase = getDb()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    })
    setLoading(false)
    if (authError) {
      setError('로그인에 실패했습니다. ' + (authError.message || ''))
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: '#37352f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontSize: 22, fontWeight: 700, marginBottom: 12,
      }}>R</div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#37352f', margin: '0 0 8px' }}>
        Ryan Todo
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

      {(error || authError) && <p style={{ color: '#ef4444', fontSize: 13, marginTop: 16 }}>{error || authError}</p>}
    </div>
  )
}
