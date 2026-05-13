import Link from 'next/link'
import SeverityBadge from './SeverityBadge'
import StatusBadge from './StatusBadge'
import EscalationTimer from './EscalationTimer'
import { ChevronRight } from 'lucide-react'

interface Incident {
  incident_id: string
  title: string
  severity: string
  status: string
  service: string
  created_at: string
  primary_on_call?: { name: string }
}

export default function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link href={`/incidents/${incident.incident_id}`}>
      <div className="flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 rounded-xl cursor-pointer transition-all mb-2">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <SeverityBadge severity={incident.severity} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-medium text-white truncate">{incident.title}</span>
              <StatusBadge status={incident.status} />
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">{incident.service} · #{incident.incident_id}</p>
              <EscalationTimer
                createdAt={incident.created_at}
                severity={incident.severity}
                status={incident.status}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          {incident.primary_on_call && (
            <span className="text-xs text-gray-500 hidden md:block">{incident.primary_on_call.name}</span>
          )}
          <ChevronRight size={16} className="text-gray-600" />
        </div>
      </div>
    </Link>
  )
}