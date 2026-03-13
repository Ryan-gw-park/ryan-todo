import { useState, useEffect, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import useComments from '../../hooks/useComments'

// 아바타 색상 팔레트 (이름 해시 기반)
const AVATAR_COLORS = ['#E53E3E', '#DD6B20', '#D69E2E', '#38A169', '#3182CE', '#805AD5', '#D53F8C', '#2B6CB0']
function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// 상대 시간 포맷
function relativeTime(dateStr) {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export default function CommentSection({ taskId }) {
  const teamId = useStore(s => s.currentTeamId)
  const myRole = useStore(s => s.myRole)
  const [comments, setComments] = useState([])
  const [input, setInput] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [myUserId, setMyUserId] = useState(null)
  const commentRefreshTrigger = useStore(s => s.commentRefreshTrigger)

  // 현재 유저 ID 가져오기
  useEffect(() => {
    import('../../utils/supabase').then(({ getDb }) => {
      const d = getDb()
      if (d) d.auth.getUser().then(({ data: { user } }) => { if (user) setMyUserId(user.id) })
    })
  }, [])

  const loadComments = useCallback(async () => {
    if (!taskId) return
    const data = await useComments.getComments(taskId, teamId)
    setComments(data)
  }, [taskId, teamId])

  useEffect(() => { loadComments() }, [loadComments, commentRefreshTrigger])

  const handleAdd = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    setLoading(true)
    const result = await useComments.addComment(taskId, trimmed)
    if (result) {
      setInput('')
      await loadComments()
    }
    setLoading(false)
  }

  const handleUpdate = async (commentId) => {
    const trimmed = editContent.trim()
    if (!trimmed || loading) return
    setLoading(true)
    const ok = await useComments.updateComment(commentId, trimmed)
    if (ok) {
      setEditingId(null)
      setEditContent('')
      await loadComments()
    }
    setLoading(false)
  }

  const handleDelete = async (commentId) => {
    if (loading) return
    setLoading(true)
    const ok = await useComments.deleteComment(commentId)
    if (ok) await loadComments()
    setLoading(false)
  }

  const startEdit = (comment) => {
    setEditingId(comment.id)
    setEditContent(comment.content)
  }

  const isOwner = myRole === 'owner'

  return (
    <div style={{ borderTop: '1px solid #ece8e1', marginTop: 8, paddingTop: 14 }}>
      {/* 헤더 */}
      <div style={{ fontSize: 12, color: '#999', fontWeight: 500, marginBottom: 12 }}>
        댓글 {comments.length > 0 && <span>({comments.length})</span>}
      </div>

      {/* 댓글 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
        {comments.map(c => {
          const isMine = c.authorId === myUserId
          const initial = (c.authorName || '?')[0].toUpperCase()
          const color = getAvatarColor(c.authorName)

          return (
            <div key={c.id} style={{ display: 'flex', gap: 8 }}>
              {/* 아바타 */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 11, fontWeight: 600, marginTop: 1,
              }}>{initial}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 이름 + 시간 + 버튼 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#37352f' }}>{c.authorName}</span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>{relativeTime(c.createdAt)}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {isMine && editingId !== c.id && (
                      <button onClick={() => startEdit(c)} style={actionBtnStyle}>수정</button>
                    )}
                    {(isMine || isOwner) && (
                      <button onClick={() => handleDelete(c.id)} style={actionBtnStyle}>삭제</button>
                    )}
                  </div>
                </div>

                {/* 내용 or 편집 모드 */}
                {editingId === c.id ? (
                  <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(c.id); if (e.key === 'Escape') setEditingId(null) }}
                      style={inputStyle}
                      autoFocus
                    />
                    <button onClick={() => handleUpdate(c.id)} style={saveBtnStyle}>저장</button>
                    <button onClick={() => setEditingId(null)} style={actionBtnStyle}>취소</button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#37352f', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {c.content}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 입력 필드 */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAdd() } }}
          placeholder="댓글을 입력하세요..."
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim() || loading}
          style={{
            ...saveBtnStyle,
            opacity: !input.trim() || loading ? 0.4 : 1,
            cursor: !input.trim() || loading ? 'default' : 'pointer',
          }}
        >등록</button>
      </div>
    </div>
  )
}

const actionBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11, color: '#bbb', padding: '0 2px', fontFamily: 'inherit',
}

const inputStyle = {
  flex: 1, padding: '6px 10px', borderRadius: 6,
  border: '1px solid #e8e8e8', fontSize: 13, fontFamily: 'inherit',
  outline: 'none',
}

const saveBtnStyle = {
  padding: '6px 12px', borderRadius: 6, border: 'none',
  background: '#37352f', color: 'white', fontSize: 12,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
}
