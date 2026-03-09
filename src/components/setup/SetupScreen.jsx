import { useState } from 'react'
import { initSupabase, getDb } from '../../lib/supabase'

export default function SetupScreen({ onConnect }) {
  const [url, setUrl] = useState(localStorage.getItem('sb_url') || '')
  const [key, setKey] = useState(localStorage.getItem('sb_key') || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setError('')
    if (!url.trim() || !key.trim()) {
      setError('URL과 키를 모두 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      initSupabase(url.trim(), key.trim())
      const { error: e } = await getDb().from('projects').select('id').limit(1)
      if (e) throw e
      localStorage.setItem('sb_url', url.trim())
      localStorage.setItem('sb_key', key.trim())
      setLoading(false)
      onConnect()
    } catch (e) {
      setLoading(false)
      setError('연결 실패: ' + (e.message || '알 수 없는 오류'))
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-white flex items-center justify-center flex-col">
      <div className="w-[min(440px,92vw)] p-9">
        <div className="text-[28px] mb-2">📋</div>
        <div className="text-[19px] font-bold mb-[5px]">Ryan Todo 설정</div>
        <div className="text-xs text-[rgba(55,53,47,.65)] mb-[22px] leading-relaxed">
          Supabase 연결 정보를 입력해주세요.
        </div>

        <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wider mb-1 mt-3">
          Project URL
        </label>
        <input
          className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:shadow-[0_0_0_2px_rgba(35,131,226,.08)] focus:outline-none"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://xxxx.supabase.co"
          autoComplete="off"
        />

        <label className="block text-[10px] font-semibold text-[rgba(55,53,47,.65)] uppercase tracking-wider mb-1 mt-3">
          Anon Key
        </label>
        <input
          className="w-full py-[9px] px-[10px] bg-white border border-[rgba(55,53,47,.16)] rounded text-[13px] transition-all focus:border-[#2383e2] focus:shadow-[0_0_0_2px_rgba(35,131,226,.08)] focus:outline-none"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="eyJhbGci..."
          type="password"
          autoComplete="off"
        />

        {error && <div className="text-[11px] text-red-600 mt-[6px]">{error}</div>}

        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full mt-[18px] py-[10px] bg-[#2383e2] text-white border-none rounded text-[13px] font-semibold cursor-pointer hover:opacity-[.88] disabled:opacity-50"
        >
          {loading ? '연결 중...' : '연결하고 시작하기 →'}
        </button>

        <div className="text-[10px] text-[rgba(55,53,47,.4)] mt-[9px] leading-loose">
          Supabase → Settings → API → Project URL + anon public key
        </div>
      </div>
    </div>
  )
}
