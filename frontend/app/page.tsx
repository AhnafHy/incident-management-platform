'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import IncidentCard from './components/IncidentCard'
import SeverityBadge from './components/SeverityBadge'
import { AlertTriangle, Activity, CheckCircle, Wifi, WifiOff } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL
const WS_URL = process.env.NEXT_PUBLIC_WS_URL

const SERVICES = ['API Gateway', 'Lambda', 'DynamoDB', 'S3', 'EC2', 'RDS', 'CloudFront', 'ECS']
const TITLES: Record<string, string[]> = {
  P1: ['Database connection pool exhausted', 'API error rate exceeding 50%', 'Complete service outage detected', 'Payment processing failure'],
  P2: ['Elevated error rate detected', 'High latency on core endpoints', 'Memory usage above 90%', 'Deployment failure'],
  P3: ['Elevated CPU usage warning', 'Non-critical service degradation', 'Minor latency increase detected', 'Low disk space warning']
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const wsRef = useRef<WebSocket | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [liveEvents, setLiveEvents] = useState<string[]>([])
  const [simulating, setSimulating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => axios.get(`${API}/dashboard`).then(r => r.data),
    refetchInterval: 10000
  })

  // WebSocket connection
  useEffect(() => {
    if (!WS_URL || WS_URL === 'PLACEHOLDER') return

    const connect = () => {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setWsConnected(true)
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const eventType = message.event_type
          const data = message.data

          setLiveEvents(prev => [
            `${new Date().toLocaleTimeString()} — ${eventType.replace('_', ' ')}: ${data?.title || data?.incident_id || ''}`,
            ...prev.slice(0, 4)
          ])

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['incidents'] })
        } catch (e) {
          console.error('WebSocket message parse error:', e)
        }
      }

      ws.onclose = () => {
        setWsConnected(false)
        setTimeout(connect, 3000) // Reconnect after 3s
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => wsRef.current?.close()
  }, [queryClient])

  const simulateIncident = async (severity: string) => {
    setSimulating(true)
    const service = SERVICES[Math.floor(Math.random() * SERVICES.length)]
    const titles = TITLES[severity]
    const title = titles[Math.floor(Math.random() * titles.length)]

    try {
      await axios.post(`${API}/incidents`, {
        action: 'create',
        title,
        description: `Automated simulation of a ${severity} incident for demonstration purposes.`,
        severity,
        service,
        source: 'simulation'
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (e) {
      console.error('Simulation failed:', e)
    } finally {
      setTimeout(() => setSimulating(false), 1000)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            {wsConnected
              ? <><Wifi size={12} className="text-green-400" /><span className="text-xs text-green-400">Live — WebSocket connected</span></>
              : <><WifiOff size={12} className="text-gray-500" /><span className="text-xs text-gray-500">Connecting...</span></>
            }
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 mr-1">Simulate:</span>
          {['P1', 'P2', 'P3'].map(sev => (
            <button
              key={sev}
              onClick={() => simulateIncident(sev)}
              disabled={simulating}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 hover:opacity-80"
              style={{
                background: sev === 'P1' ? 'rgba(239,68,68,0.15)' : sev === 'P2' ? 'rgba(249,115,22,0.15)' : 'rgba(234,179,8,0.15)',
                color: sev === 'P1' ? '#f87171' : sev === 'P2' ? '#fb923c' : '#facc15',
                borderColor: sev === 'P1' ? 'rgba(239,68,68,0.4)' : sev === 'P2' ? 'rgba(249,115,22,0.4)' : 'rgba(234,179,8,0.4)'
              }}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Activity size={16} />
            <span className="text-xs">Total</span>
          </div>
          <p className="text-3xl font-semibold text-white">{data?.total_incidents || 0}</p>
        </div>
        <div className="bg-gray-800 border border-red-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle size={16} />
            <span className="text-xs">Triggered</span>
          </div>
          <p className="text-3xl font-semibold text-red-400">{data?.triggered || 0}</p>
        </div>
        <div className="bg-gray-800 border border-yellow-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <Activity size={16} />
            <span className="text-xs">Acknowledged</span>
          </div>
          <p className="text-3xl font-semibold text-yellow-400">{data?.acknowledged || 0}</p>
        </div>
        <div className="bg-gray-800 border border-green-900/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle size={16} />
            <span className="text-xs">Resolved</span>
          </div>
          <p className="text-3xl font-semibold text-green-400">{data?.resolved || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent incidents */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Recent incidents</h2>
          {!data?.recent_incidents?.length ? (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
              <AlertTriangle className="mx-auto mb-3 text-gray-600" size={32} />
              <p className="text-gray-500 text-sm">No incidents yet</p>
              <p className="text-gray-600 text-xs mt-1">Use the Simulate buttons above to trigger an incident</p>
            </div>
          ) : (
            data.recent_incidents.map((incident: any) => (
              <IncidentCard key={incident.incident_id} incident={incident} />
            ))
          )}
        </div>

        {/* Live event feed */}
        <div>
          <h2 className="text-sm font-medium text-gray-400 mb-3">Live event feed</h2>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 h-64 overflow-y-auto">
            {liveEvents.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-gray-600 text-center">
                  {wsConnected ? 'Waiting for events...' : 'Connecting to WebSocket...'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {liveEvents.map((event, i) => (
                  <div key={i} className={`text-xs p-2 rounded bg-gray-900 border border-gray-700 ${i === 0 ? 'border-green-800' : ''}`}>
                    <span className="text-gray-400">{event}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}