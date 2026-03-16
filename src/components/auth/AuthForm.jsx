import { useState } from 'react'
import { getDb } from '../../utils/supabase'

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #ddd', fontSize: 14, fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}

const btnPrimary = {
  padding: '12px', width: '100%', fontSize: 14, fontWeight: 500,
  borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
  background: '#37352f', color: '#fff',
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  )
}

/**
 * Shared auth form: Google OAuth + email/password login + sign up
 * @param {object} props
 * @param {string} props.redirectTo - URL for Google OAuth redirect
 * @param {function} [props.onAuthSuccess] - Called after successful auth (optional)
 * @param {string} [props.externalError] - Error from parent (e.g. authError prop)
 */
export default function AuthForm({ redirectTo, onAuthSuccess, externalError, defaultMode = 'login' }) {
  const [mode, setMode] = useState(defaultMode) // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailConfirmPending, setEmailConfirmPending] = useState(false)

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    const supabase = getDb()
    const { error: authErr } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    setLoading(false)
    if (authErr) {
      setError('Google 로그인에 실패했습니다. ' + (authErr.message || ''))
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    const supabase = getDb()
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (authErr) {
      if (authErr.message.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다. Google 계정으로 가입하셨다면 Google 로그인을 이용해주세요.')
      } else {
        setError(authErr.message)
      }
      return
    }
    onAuthSuccess?.()
  }

  const handleSignUp = async () => {
    if (!email.trim() || !password) return
    if (password !== confirmPw) {
      setError('비밀번호가 일치하지 않습니다')
      return
    }
    if (password.length < 6) {
      setError('비밀번호는 최소 6자 이상이어야 합니다')
      return
    }
    setError('')
    setLoading(true)
    const supabase = getDb()
    const { data, error: authErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (authErr) {
      if (authErr.message.includes('User already registered')) {
        setError('이미 가입된 이메일입니다. 로그인으로 전환해주세요.')
        setMode('login')
        return
      }
      setError(authErr.message)
      return
    }
    // Confirm email required (session is null)
    if (data.user && !data.session) {
      setEmailConfirmPending(true)
      return
    }
    // Session created immediately
    onAuthSuccess?.()
  }

  const handleSubmit = () => {
    if (mode === 'login') handleLogin()
    else handleSignUp()
  }

  // Email confirm pending UI
  if (emailConfirmPending) {
    const inviteUrl = window.location.href
    return (
      <div style={{ width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✉</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>이메일을 확인해주세요</h3>
        <p style={{ color: '#888', fontSize: 14, margin: '0 0 8px' }}>
          <strong>{email}</strong>로 확인 메일을 보냈습니다.
        </p>
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 20px' }}>
          메일의 링크를 클릭한 후 아래 링크로 다시 접속해주세요.
        </p>
        <button
          onClick={() => { navigator.clipboard.writeText(inviteUrl) }}
          style={{ ...btnPrimary, background: '#2c5282' }}
        >
          이 초대 링크 복사
        </button>
      </div>
    )
  }

  const displayError = error || externalError

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Google Login */}
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
        <GoogleIcon />
        {loading ? '로그인 중...' : 'Google로 로그인'}
      </button>

      <Divider />

      {/* Email/Password form */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="이메일 주소"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : null)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={inputStyle}
        />
        {mode === 'signup' && (
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={confirmPw}
            onChange={e => { setConfirmPw(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
        )}
        <button
          onClick={handleSubmit}
          disabled={loading || !email.trim() || !password}
          style={{
            ...btnPrimary,
            opacity: (loading || !email.trim() || !password) ? 0.6 : 1,
          }}
        >
          {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
        </button>
      </div>

      {/* Mode toggle */}
      <p style={{ fontSize: 13, color: '#888', marginTop: 16, textAlign: 'center' }}>
        {mode === 'login' ? (
          <>계정이 없으신가요? <span onClick={() => { setMode('signup'); setError('') }} style={{ color: '#2c5282', cursor: 'pointer', fontWeight: 500 }}>회원가입</span></>
        ) : (
          <>이미 계정이 있으신가요? <span onClick={() => { setMode('login'); setError('') }} style={{ color: '#2c5282', cursor: 'pointer', fontWeight: 500 }}>로그인</span></>
        )}
      </p>

      {/* Error */}
      {displayError && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          {displayError}
        </p>
      )}
    </div>
  )
}
