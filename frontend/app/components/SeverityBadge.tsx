'use client'
export default function SeverityBadge({ severity, large = false }: { severity: string, large?: boolean }) {
  const styles: Record<string, string> = {
    P1: 'bg-red-500/20 text-red-400 border-red-500/50',
    P2: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    P3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  }
  const size = large ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5'
  return (
    <span className={`font-bold border rounded ${size} ${styles[severity] || 'bg-gray-500/20 text-gray-400 border-gray-500/50'}`}>
      {severity}
    </span>
  )
}