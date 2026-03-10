import { useState } from 'react'
import { initSupabase, getDb } from '../../utils/supabase'

export default function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState(localStorage.getItem('sb_url') || '')
  const [key, setKey] = useState(localStorage.getItem('sb_key') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setError('')
    if (!url.trim() || !key.trim()) { setError('URL과 키를 모두 입력해주세요.'); return }
    setLoading(true)
    try {
      initSupabase(url.trim(), key.trim())
      const { error: e } = await getDb().from('projects').select('id').limit(1)
      if (e) throw e
      setLoading(false)
      onConnect()
    } catch (e) {
      setLoading(false)
      setError('연결 실패: ' + (e.message || '알 수 없는 오류'))
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ width: 'min(440px, 92vw)', padding: 36 }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: '#37352f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 13, fontWeight: 700, marginBottom: 16 }}>R</div>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 5 }}>Ryan Todo 설정</div>
        <div style={{ fontSize: 12, color: 'rgba(55,53,47,.65)', marginBottom: 22, lineHeight: 1.6 }}>
          Supabase 연결 정보를 입력해주세요.
        </div>

        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(55,53,47,.65)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 12 }}>Project URL</label>
        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off"
          style={{ width: '100%', padding: '9px 10px', background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />

        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(55,53,47,.65)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, marginTop: 12 }}>Anon Key</label>
        <input value={key} onChange={e => setKey(e.target.value)} placeholder="eyJhbGci..." type="password" autoComplete="off"
          style={{ width: '100%', padding: '9px 10px', background: 'white', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />

        {error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>{error}</div>}

        <button onClick={handleConnect} disabled={loading}
          style={{ width: '100%', marginTop: 18, padding: '10px', background: '#37352f', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.5 : 1 }}>
          {loading ? '연결 중...' : '연결하고 시작하기 →'}
        </button>

        <div style={{ fontSize: 10, color: '#bbb', marginTop: 9, lineHeight: 1.8 }}>
          Supabase → Settings → API → Project URL + anon public key
        </div>
      </div>
    </div>
  )
}
