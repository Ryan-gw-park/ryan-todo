import { useState } from 'react'
import { getDb } from '../../utils/supabase'

const ALLOWED_EMAIL = 'gunwoong.park@gmail.com'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    setMessage('')
    const trimmed = email.trim().toLowerCase()

    if (!trimmed) {
      setError('이메일을 입력해주세요.')
      return
    }
    if (trimmed !== ALLOWED_EMAIL) {
      setError('등록되지 않은 이메일입니다.')
      return
    }

    setLoading(true)
    const supabase = getDb()
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })
    setLoading(false)

    if (authError) {
      setError('로그인 링크 발송에 실패했습니다. ' + (authError.message || ''))
    } else {
      setMessage('이메일을 확인해주세요. 로그인 링크가 발송되었습니다.')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ width: 'min(360px, 88vw)', padding: 36 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#37352f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16, fontWeight: 700 }}>R</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#37352f' }}>Ryan Todo</span>
        </div>

        {/* Email input */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(55,53,47,.65)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>이메일</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="이메일 입력"
          autoComplete="email"
          autoFocus
          style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', color: '#37352f' }}
        />

        {/* Error / Success */}
        {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8, lineHeight: 1.5 }}>{error}</div>}
        {message && <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 8, lineHeight: 1.5, background: '#e8f5e9', padding: '8px 12px', borderRadius: 6 }}>{message}</div>}

        {/* Submit button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{ width: '100%', marginTop: 16, padding: '12px', background: '#37352f', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}
        >
          {loading ? '발송 중...' : '로그인 링크 보내기'}
        </button>

        <div style={{ fontSize: 11, color: '#bbb', marginTop: 12, textAlign: 'center', lineHeight: 1.6 }}>
          등록된 이메일로 로그인 링크가 발송됩니다
        </div>
      </div>
    </div>
  )
}
