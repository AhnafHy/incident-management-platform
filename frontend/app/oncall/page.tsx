'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { User, Shield, ChevronLeft, ChevronRight } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL

const ENGINEERS = [
  { name: 'Ahnaf Hyder', email: 'ahnaf@example.com', phone: '+1 (716) 555-0142', timezone: 'EST' },
  { name: 'Alex Chen', email: 'alex@example.com', phone: '+1 (415) 555-0198', timezone: 'PST' },
  { name: 'Sarah Kim', email: 'sarah@example.com', phone: '+1 (312) 555-0167', timezone: 'CST' }
]

export default function OnCall() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null)
  const [showOverride, setShowOverride] = useState(false)

  const { data } = useQuery({
    queryKey: ['oncall'],
    queryFn: () => axios.get(`${API}/oncall`).then(r => r.data)
  })

  const baseWeek = (data?.week || 0) + weekOffset
  const primaryIndex = overrideIndex !== null ? overrideIndex : baseWeek % ENGINEERS.length
  const currentPrimary = ENGINEERS[primaryIndex]

  const escalationTimes: Record<string, string> = {
    P1: 'Immediate page + escalate after 5 min if unacknowledged',
    P2: 'Immediate page + escalate after 10 min if unacknowledged',
    P3: 'Feed notification only — no escalation'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">On-Call Schedule</h1>
          <p className="text-gray-500 text-sm mt-1">
            {weekOffset === 0 ? 'Current week' : weekOffset > 0 ? `${weekOffset} week(s) ahead` : `${Math.abs(weekOffset)} week(s) ago`} — auto-rotates weekly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
          >
            <ChevronLeft size={16} className="text-gray-400" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-400 hover:border-gray-500 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
          >
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Current primary highlight */}
      <div className="bg-gray-800 border border-green-500/40 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-400 font-medium mb-1">● Current primary on-call</p>
            <p className="text-lg font-semibold text-white">{currentPrimary.name}</p>
            <p className="text-sm text-gray-400 mt-1">📧 {currentPrimary.email}</p>
            <p className="text-sm text-gray-400">📱 {currentPrimary.phone}</p>
            <p className="text-xs text-gray-500 mt-1">🕒 {currentPrimary.timezone}</p>
          </div>
          {weekOffset === 0 && (
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg text-xs font-medium hover:bg-yellow-500/30 transition-colors"
            >
              Override primary
            </button>
          )}
        </div>

        {showOverride && weekOffset === 0 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 mb-3">Temporarily set a different primary on-call:</p>
            <div className="flex gap-2 flex-wrap">
              {ENGINEERS.map((eng, i) => (
                <button
                  key={i}
                  onClick={() => { setOverrideIndex(i === overrideIndex ? null : i); setShowOverride(false) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    i === primaryIndex
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : 'bg-gray-700 text-gray-300 border-gray-600 hover:border-gray-400'
                  }`}
                >
                  {eng.name} {i === overrideIndex ? '(override)' : ''}
                </button>
              ))}
            </div>
            {overrideIndex !== null && (
              <button
                onClick={() => setOverrideIndex(null)}
                className="mt-2 text-xs text-red-400 hover:text-red-300"
              >
                Clear override — restore rotation
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full rotation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {ENGINEERS.map((engineer, i) => {
          const rotationPosition = ((i - primaryIndex % ENGINEERS.length) + ENGINEERS.length) % ENGINEERS.length
          const roleLabel = rotationPosition === 0 ? 'Primary' : rotationPosition === 1 ? 'Secondary' : 'Tertiary'
          const isPrimary = i === primaryIndex

          return (
            <div key={i} className={`bg-gray-800 rounded-xl border p-5 ${isPrimary ? 'border-green-500/50' : 'border-gray-700'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <User size={20} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{engineer.name}</p>
                  <p className="text-xs text-gray-500">{roleLabel}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">📧 {engineer.email}</p>
                <p className="text-xs text-gray-500">📱 {engineer.phone}</p>
                <p className="text-xs text-gray-500">🕒 {engineer.timezone}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Escalation policy */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
        <h2 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
          <Shield size={16} className="text-gray-400" /> Escalation Policy
        </h2>
        <div className="space-y-3">
          {Object.entries(escalationTimes).map(([severity, policy]) => (
            <div key={severity} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
              <span className={`text-sm font-bold ${severity === 'P1' ? 'text-red-400' : severity === 'P2' ? 'text-orange-400' : 'text-yellow-400'}`}>
                {severity}
              </span>
              <span className="text-xs text-gray-400">{policy}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}