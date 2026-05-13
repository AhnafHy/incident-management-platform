'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface EscalationTimerProps {
  createdAt: string
  severity: string
  status: string
}

const ESCALATION_SECONDS: Record<string, number> = {
  P1: 300,
  P2: 600,
  P3: 0
}

export default function EscalationTimer({ createdAt, severity, status }: EscalationTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (status !== 'TRIGGERED' || severity === 'P3') return

    const escalationTime = ESCALATION_SECONDS[severity] || 0
    if (!escalationTime) return

    const interval = setInterval(() => {
      const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000
      const remaining = Math.max(0, escalationTime - elapsed)
      setSecondsLeft(Math.floor(remaining))
    }, 1000)

    return () => clearInterval(interval)
  }, [createdAt, severity, status])

  if (secondsLeft === null || status !== 'TRIGGERED' || severity === 'P3') return null

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const isUrgent = secondsLeft < 60

  return (
    <div className={`flex items-center gap-1.5 text-xs ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
      <Clock size={12} className={isUrgent ? 'animate-pulse' : ''} />
      {secondsLeft === 0
        ? 'Escalation triggered — check event log'
        : `Escalates in ${minutes}:${seconds.toString().padStart(2, '0')}`
      }
    </div>
  )
}