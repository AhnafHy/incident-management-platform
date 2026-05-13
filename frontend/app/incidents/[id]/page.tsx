'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Clock, User, AlertTriangle } from 'lucide-react'
import SeverityBadge from '../../components/SeverityBadge'
import StatusBadge from '../../components/StatusBadge'
import EscalationTimer from '../../components/EscalationTimer'

const API = process.env.NEXT_PUBLIC_API_URL

export default function IncidentDetail() {
  const params = useParams()
  const incidentId = params.id as string
  const queryClient = useQueryClient()
  const [acknowledgedBy, setAcknowledgedBy] = useState('Ahnaf Hyder')
  const [postmortem, setPostmortem] = useState('')
  const [updating, setUpdating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['incident', incidentId],
    queryFn: () => axios.get(`${API}/incidents/${incidentId}`).then(r => r.data),
    refetchInterval: 5000
  })

  const acknowledge = async () => {
    setUpdating(true)
    await axios.put(`${API}/incidents/${incidentId}/acknowledge`, {
      acknowledged_by: acknowledgedBy
    })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setUpdating(false)
  }

  const resolve = async () => {
    setUpdating(true)
    await axios.put(`${API}/incidents/${incidentId}/resolve`, { postmortem })
    queryClient.invalidateQueries({ queryKey: ['incident', incidentId] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    setUpdating(false)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
    </div>
  )

  if (!data) return <div className="text-center py-12 text-gray-500">Incident not found</div>

  return (
    <div>
      <Link href="/incidents" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to incidents
      </Link>

      {/* Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <SeverityBadge severity={data.severity} large />
              <h1 className="text-xl font-semibold text-white">{data.title}</h1>
              <StatusBadge status={data.status} />
            </div>
            <p className="text-gray-500 text-sm">{data.service} · #{data.incident_id} · {data.source}</p>
            {data.description && <p className="text-gray-400 text-sm mt-2">{data.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <EscalationTimer createdAt={data.created_at} severity={data.severity} status={data.status} />
          {data.escalated_to && (
  <div className="flex items-center gap-1.5 text-xs text-orange-400 mt-1">
    <AlertTriangle size={12} />
    Escalated to {data.escalated_to.name} ({data.escalated_to.role})
  </div>
)}
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={12} /> {new Date(data.created_at).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* On-call */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">On-call rotation</h2>
          <div className="space-y-3">
            {[
              { label: 'Primary', engineer: data.primary_on_call },
              { label: 'Secondary', engineer: data.secondary_on_call },
              { label: 'Escalated to', engineer: data.escalated_to }
            ].map(({ label, engineer }) => engineer && (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <div className="flex items-center gap-2">
                  <User size={12} className="text-gray-500" />
                  <span className="text-sm text-white">{engineer.name}</span>
                  {label === 'Escalated to' && <span className="text-xs text-orange-400">⚠️</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

{/* Actions */}
<div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
  <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Actions</h2>
  
  {data.status === 'TRIGGERED' && (
    <div className="space-y-3">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-3">
        <p className="text-xs text-red-400 font-medium">⚠️ Incident is active</p>
        <p className="text-xs text-gray-500 mt-1">Acknowledge to stop escalation and signal you are investigating</p>
      </div>
      <input
        type="text"
        value={acknowledgedBy}
        onChange={e => setAcknowledgedBy(e.target.value)}
        placeholder="Your name"
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
      />
      <button
        onClick={acknowledge}
        disabled={updating}
        className="w-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg py-2 text-sm font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
      >
        Acknowledge — I am investigating
      </button>
    </div>
  )}

  {data.status === 'ACKNOWLEDGED' && (
    <div className="space-y-3">
      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-3">
        <p className="text-xs text-yellow-400 font-medium">🔧 Under investigation</p>
        <p className="text-xs text-gray-500 mt-1">Acknowledged by {data.acknowledged_by}. Fix the issue then resolve below.</p>
      </div>
      <button
        onClick={resolve}
        disabled={updating}
        className="w-full bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg py-2 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
      >
        Mark as resolved
      </button>
    </div>
  )}

  {data.status === 'RESOLVED' && (
    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
      <p className="text-xs text-green-400 font-medium">✅ Resolved</p>
      <p className="text-xs text-gray-500 mt-1">Resolved at {new Date(data.resolved_at).toLocaleString()}</p>
    </div>
  )}
</div>

        {/* Timestamps */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Timeline</h2>
          <div className="space-y-2">
            {[
              { label: 'Triggered', time: data.created_at },
              { label: 'Acknowledged', time: data.acknowledged_at },
              { label: 'Resolved', time: data.resolved_at }
            ].map(({ label, time }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-xs text-gray-400">
                  {time ? new Date(time).toLocaleTimeString() : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event timeline */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-white mb-4">Event log</h2>
        <div className="space-y-3">
          {(data.timeline || []).map((event: any, i: number) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-2 h-2 rounded-full bg-gray-600 mt-1.5 flex-shrink-0"></div>
                {i < data.timeline.length - 1 && <div className="w-px flex-1 bg-gray-700 mt-1"></div>}
              </div>
              <div className="pb-3">
                <p className="text-sm text-white">{event.message}</p>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(event.timestamp).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post-mortem */}
      {(data.status === 'ACKNOWLEDGED' || data.status === 'RESOLVED') && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white mb-4">Post-mortem</h2>
          {data.status === 'RESOLVED' && data.postmortem ? (
            <div className="bg-gray-900 rounded-lg p-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{data.postmortem}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={postmortem}
                onChange={e => setPostmortem(e.target.value)}
                placeholder="What happened? What was the root cause? What actions will prevent this from recurring?"
                rows={6}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 resize-none"
              />
              <button
                onClick={resolve}
                disabled={updating || !postmortem.trim()}
                className="bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-4 py-2 text-sm font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                Save post-mortem and resolve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}