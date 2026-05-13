'use client'
export default function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    TRIGGERED: 'bg-red-500/20 text-red-400 border-red-500/30',
    ACKNOWLEDGED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    RESOLVED: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  const dots: Record<string, string> = {
    TRIGGERED: 'bg-red-500 animate-pulse',
    ACKNOWLEDGED: 'bg-yellow-500',
    RESOLVED: 'bg-green-500',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border ${styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || 'bg-gray-500'}`}></span>
      {status}
    </span>
  )
}