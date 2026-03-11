import { useEffect, useRef } from 'react'
import { shouldFireAlarm, advanceAlarm, fireNotification, snoozeAlarm } from '../utils/alarm'
import { getDb } from '../utils/supabase'
import useStore from './useStore'

const CHECK_INTERVAL_MS = 60_000

export function useAlarmEngine() {
  const tasks = useStore((s) => s.tasks)
  const updateTask = useStore((s) => s.updateTask)
  const tasksRef = useRef(tasks)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    // Service Worker 등록
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.warn('[SW] 등록 실패:', err))
    }

    // alarm이 활성화된 task가 있으면 권한 요청
    const hasActiveAlarm = tasksRef.current.some((t) => t.alarm?.enabled)
    if (hasActiveAlarm && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // SW로부터 스누즈 요청 수신
    const handleSWMessage = (e) => {
      if (e.data?.type === 'SNOOZE_ALARM') {
        const task = tasksRef.current.find((t) => t.id === e.data.taskId)
        if (task?.alarm) {
          const snoozed = snoozeAlarm(task.alarm)
          updateTask(task.id, { alarm: snoozed })
        }
      }
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage)
    }

    // 초기 즉시 체크
    checkAlarms()

    const timer = setInterval(checkAlarms, CHECK_INTERVAL_MS)
    return () => {
      clearInterval(timer)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function checkAlarms() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    for (const task of tasksRef.current) {
      if (!task.alarm?.enabled) continue
      if (!shouldFireAlarm(task.alarm)) continue

      await fireNotification(task.text, task.id)

      // Web Push: 구독된 모든 기기에 발송
      try {
        const d = getDb()
        if (d) {
          await d.functions.invoke('send-alarm', {
            body: { taskId: task.id, taskText: task.text },
          })
        }
      } catch (err) {
        console.warn('[AlarmEngine] Edge Function 호출 실패 (무시):', err.message)
      }

      const nextAlarm = advanceAlarm(task.alarm)
      updateTask(task.id, { alarm: nextAlarm })
    }
  }
}
