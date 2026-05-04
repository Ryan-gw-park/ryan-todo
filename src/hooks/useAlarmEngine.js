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
    // mobile-perf-01 R-03: idle 콜백으로 지연 (첫 페인트 critical path 분리)
    // W5/v3 — { timeout: 4000 }, fallback 도 timeout 인자 honor
    const idle = window.requestIdleCallback || ((cb, opts) => setTimeout(cb, opts?.timeout ?? 2000))
    let cancelled = false
    let cleanupFn = null

    const handle = idle(() => {
      if (cancelled) return

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

      // 초기 즉시 체크 (idle 시점 기준)
      checkAlarms()

      const timer = setInterval(checkAlarms, CHECK_INTERVAL_MS)
      cleanupFn = () => {
        clearInterval(timer)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', handleSWMessage)
        }
      }
    }, { timeout: 4000 })

    return () => {
      cancelled = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(handle)
      else clearTimeout(handle)
      if (cleanupFn) cleanupFn()
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
