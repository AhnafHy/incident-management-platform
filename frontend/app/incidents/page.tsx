'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import axios from 'axios'
import IncidentCard from '../components/IncidentCard'
import { AlertTriangle, Filter } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL

function calcMTTR(incidents: any[]) {
  const resolved = incidents.filter(i => i.status === 'RESOLVED' && i.acknowledged_at && i.resolved_at)
  if (!resolved.length) return null
  const avg = resolved.reduce((sum, i) => {
    return sum + (new Date(i.resolved_at).getTime() - new Date(i.created_at).getTime())
  }, 0) / resolved.length
  const mins = Math.floor(avg / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function calcMTTA(incidents: any[]) {
  const acked = incidents.filter(i => i.acknowledged_at)
  if (!acked.length) return null
  const avg = acked.reduce((sum, i) => {
    return sum + (new Date(i.acknowledged_at).getTime() - new Date(i.created_at).getTime())
  }, 0) / acked.length
  const mins = Math.floor(avg / 60000)
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`
}

export default function Incidents() {
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => axios.get(`${API}/incidents`).then(r => r.data),
    refetchInterval: 5000
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
    </div>
  )

  const incidents = data || []
  const filtered = incidents.filter((i: any) => {
    const sevMatch = severityFilter === 'ALL' || i.severity === severityFilter
    const statMatch = statusFilter === 'ALL' || i.status === statusFilter
    return sevMatch && statMatch
  })

  const active = filtered.filter((i: any) => i.status !== 'RESOLVED')
  const resolved = filtered.filter((i: any) => i.status === 'RESOLVED')
  const mttr = calcMTTR(incidents)
  const mtta = calcMTTA(incidents)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">All Incidents</h1>
        <p className="text-gray-500 text-sm mt-1">{incidents.length} total · {incidents.filter((i: any) => i.status !== 'RESOLVED').length} active</p>
      </div>

      {/* MTTD/MTTR metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">MTTA — Mean Time To Acknowledge</p>
          <p className="text-2xl font-semibold text-white">{mtta || '—'}</p>
          <p className="text-xs text-gray-600 mt-1">Avg time from trigger to acknowledgment</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">MTTR — Mean Time To Resolve</p>
          <p className="text-2xl font-semibold text-white">{mttr || '—'}</p>
          <p className="text-xs text-gray-600 mt-1">Avg time from trigger to resolution</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Filter size={14} className="text-gray-500" />
        <div className="flex gap-2">
          {['ALL', 'P1', 'P2', 'P3'].map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                severityFilter === sev
                  ? 'bg-gray-600 text-white border-gray-500'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {['ALL', 'TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED'].map(stat => (
            <button
              key={stat}
              onClick={() => setStatusFilter(stat)}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === stat
                  ? 'bg-gray-600 text-white border-gray-500'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              {stat}
            </button>
          ))}
        </div>
      </div>

      {active.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-medium text-red-400 uppercase tracking-wide mb-3">Active ({active.length})</h2>
          {active.map((incident: any) => (
            <IncidentCard key={incident.incident_id} incident={incident} />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Resolved ({resolved.length})</h2>
          {resolved.map((incident: any) => (
            <IncidentCard key={incident.incident_id} incident={incident} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
          <AlertTriangle className="mx-auto mb-3 text-gray-600" size={40} />
          <p className="text-gray-500">No incidents match the current filters</p>
        </div>
      )}
    </div>
  )
}