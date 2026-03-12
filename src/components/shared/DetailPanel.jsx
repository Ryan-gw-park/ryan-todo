import { useState, useEffect, useRef, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import { getColor, CATEGORIES } from '../../utils/colors'
import { parseDateFromText } from '../../utils/dateParser'
import { subscribePush, unsubscribePush, isPushSubscribed } from '../../utils/webPush'
import { getDb } from '../../utils/supabase'
import OutlinerEditor from './OutlinerEditor'

function getDefaultAlarmDatetime(dueDate) {
  const d = dueDate ? new Date(dueDate + 'T09:00') : new Date()
  if (!dueDate) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function DetailPanel() {
  const { detailTask, closeDetail, tasks, projects, updateTask, deleteTask, toggleDone, collapseState, toggleCollapse } = useStore()
  const isMobile = window.innerWidth < 768

  const task = detailTask ? tasks.find(t => t.id === detailTask.id) : null
  if (!task) return null

  const p = projects.find(pr => pr.id === task.projectId)
  const c = p ? getColor(p.color) : getColor('blue')
  const allTopCollapsed = collapseState.detailAllTop?.[task.id]

  const debounceRef = useRef(null)
  const handleNotesChange = useCallback((newNotes) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      updateTask(task.id, { notes: newNotes })
    }, 800)
    // Optimistic local update
    useStore.setState(s => ({
      tasks: s.tasks.map(t => t.id === task.id ? { ...t, notes: newNotes } : t)
    }))
  }, [task.id, updateTask])

  return (
    <>
      <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 90, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: isMobile ? '100%' : 480, background: 'white', zIndex: 100, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease-out' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#999', fontSize: 18, lineHeight: 1 }}>✕</button>
            <button onClick={() => deleteTask(task.id)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>삭제</button>
          </div>
          <input
            defaultValue={task.text}
            key={task.id + task.text}
            onBlur={e => {
              const v = e.target.value.trim()
              if (v && v !== task.text) {
                const { startDate, dueDate } = parseDateFromText(v)
                const patch = { text: v }
                if (startDate) patch.startDate = startDate
                if (dueDate) patch.dueDate = dueDate
                updateTask(task.id, patch)
              }
            }}
            style={{ width: '100%', fontSize: 20, fontWeight: 600, color: '#37352f', border: 'none', outline: 'none', padding: 0, fontFamily: 'inherit', background: 'transparent', boxSizing: 'border-box' }}
          />
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
          {/* Project */}
          <DetailRow label="프로젝트">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: c.header, color: c.text, padding: '3px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.dot }} />
              {p?.name}
            </span>
          </DetailRow>

          {/* Category */}
          <DetailRow label="카테고리">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATEGORIES.filter(ct => ct.key !== 'done').map(ct => (
                <button
                  key={ct.key}
                  onClick={() => updateTask(task.id, { category: ct.key, done: false, prevCategory: '' })}
                  style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, border: task.category === ct.key ? '1.5px solid #37352f' : '1px solid #e0e0e0', background: task.category === ct.key ? '#f7f7f7' : 'white', color: '#37352f' }}
                >
                  {ct.emoji} {ct.label}
                </button>
              ))}
              {task.category === 'done' && <span style={{ fontSize: 12, color: '#2e7d32', background: '#e8f5e9', padding: '4px 10px', borderRadius: 6, fontWeight: 500 }}>✅ 완료</span>}
            </div>
          </DetailRow>

          {/* Start Date */}
          <DetailRow label="시작일">
            <input
              type="date"
              defaultValue={task.startDate || ''}
              key={task.id + '-start-' + task.startDate}
              onChange={e => updateTask(task.id, { startDate: e.target.value })}
              style={{ fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', color: '#37352f', fontFamily: 'inherit' }}
            />
          </DetailRow>

          {/* Due Date */}
          <DetailRow label="마감일">
            <input
              type="date"
              defaultValue={task.dueDate || ''}
              key={task.id + '-due-' + task.dueDate}
              onChange={e => updateTask(task.id, { dueDate: e.target.value })}
              style={{ fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', color: '#37352f', fontFamily: 'inherit' }}
            />
          </DetailRow>

          {/* Alarm */}
          <AlarmSection task={task} updateTask={updateTask} />

          {/* Status */}
          <DetailRow label="상태">
            {task.category === 'done'
              ? <button onClick={() => { toggleDone(task.id); closeDetail() }} style={{ fontSize: 12, color: '#f57c00', background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>↩ 되돌리기</button>
              : <button onClick={() => { toggleDone(task.id); closeDetail() }} style={{ fontSize: 12, color: '#2e7d32', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>✓ 완료 처리</button>
            }
          </DetailRow>

          {/* Notes */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>노트</span>
              <button
                onClick={() => toggleCollapse('detailAllTop', task.id)}
                title={allTopCollapsed ? '모든 항목 펼치기' : '모든 항목 접기'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'flex', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = c.dot}
                onMouseLeave={e => e.currentTarget.style.color = '#ccc'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  {allTopCollapsed ? (
                    <>
                      <path d="M2 3h10M2 7h10M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M10 5l2-2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  ) : (
                    <>
                      <path d="M2 3h10M2 7h6M2 11h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      <path d="M12 7l-2 2-2-2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                    </>
                  )}
                </svg>
              </button>
            </div>
            <OutlinerEditor notes={task.notes} onChange={handleNotesChange} accentColor={c.dot} allTopCollapsed={allTopCollapsed} />
          </div>
        </div>
      </div>
    </>
  )
}

function AlarmSection({ task, updateTask }) {
  const alarm = task.alarm
  const enabled = !!alarm?.enabled
  const [pushSubscribed, setPushSubscribed] = useState(false)

  useEffect(() => {
    isPushSubscribed().then(setPushSubscribed)
  }, [])

  const handlePushToggle = async () => {
    const d = getDb()
    if (!d) return
    if (pushSubscribed) {
      await unsubscribePush(d)
      setPushSubscribed(false)
    } else {
      const sub = await subscribePush(d)
      setPushSubscribed(!!sub)
    }
  }

  const handleToggle = () => {
    if (!enabled) {
      // Turn ON
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
      const datetime = getDefaultAlarmDatetime(task.dueDate)
      updateTask(task.id, {
        alarm: { enabled: true, datetime, repeat: 'none', notified: false }
      })
    } else {
      // Turn OFF
      updateTask(task.id, {
        alarm: { ...alarm, enabled: false }
      })
    }
  }

  const handleDatetimeChange = (e) => {
    updateTask(task.id, {
      alarm: { ...alarm, datetime: e.target.value, notified: false }
    })
  }

  const handleRepeatChange = (repeat) => {
    updateTask(task.id, {
      alarm: { ...alarm, repeat, notified: false }
    })
  }

  const handleDelete = () => {
    updateTask(task.id, { alarm: null })
  }

  const permissionDenied = typeof Notification !== 'undefined' && Notification.permission === 'denied'

  return (
    <>
      <DetailRow label="알람">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleToggle}
            style={{
              width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: enabled ? '#4CAF50' : '#ddd', position: 'relative', transition: 'background 0.2s',
              padding: 0, flexShrink: 0,
            }}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 8, background: 'white',
              position: 'absolute', top: 2,
              left: enabled ? 18 : 2, transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </button>
          {enabled && (
            <button
              onClick={handleDelete}
              style={{ fontSize: 11, color: '#e57373', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '2px 4px' }}
            >
              알람 삭제
            </button>
          )}
        </div>
      </DetailRow>
      {permissionDenied && enabled && (
        <div style={{ fontSize: 11, color: '#e57373', padding: '0 0 6px 80px' }}>
          알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.
        </div>
      )}
      {enabled && (
        <>
          <DetailRow label="알람 시각">
            <input
              type="datetime-local"
              value={alarm.datetime || ''}
              onChange={handleDatetimeChange}
              style={{ fontSize: 13, border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 10px', color: '#37352f', fontFamily: 'inherit' }}
            />
          </DetailRow>
          <DetailRow label="반복">
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { key: 'none', label: '없음' },
                { key: 'daily', label: '매일' },
                { key: 'weekly', label: '매주' },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleRepeatChange(opt.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 500,
                    border: alarm.repeat === opt.key ? '1.5px solid #37352f' : '1px solid #e0e0e0',
                    background: alarm.repeat === opt.key ? '#f7f7f7' : 'white',
                    color: '#37352f',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </DetailRow>
          <div style={{ marginTop: 8, paddingLeft: 80 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: 'pointer' }}>
              <input type="checkbox" checked={pushSubscribed} onChange={handlePushToggle} />
              다른 기기에도 알림 받기
              {pushSubscribed && (
                <span style={{ opacity: 0.5 }}>✅ 이 기기 구독 중</span>
              )}
            </label>
            <div style={{ marginTop: 4, opacity: 0.45, fontSize: 11 }}>
              앱이 열려있는 기기에서 알람이 울리면 구독된 모든 기기에 알림이 전송됩니다.
            </div>
          </div>
        </>
      )}
    </>
  )
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 36, marginBottom: 6 }}>
      <div style={{ width: 80, fontSize: 12, color: '#999', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}
