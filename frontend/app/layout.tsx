import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import Link from 'next/link'
import { AlertTriangle, LayoutDashboard, Users, List } from 'lucide-react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Incident Management Platform',
  description: 'Real-time incident management with WebSocket-powered live updates',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-950 text-white">
            <nav className="bg-gray-900 border-b border-gray-800 px-6 py-4">
              <div className="max-w-6xl mx-auto flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                  <AlertTriangle className="text-red-500" size={20} />
                  <span className="font-semibold text-white">Incident Manager</span>
                </Link>
                <div className="flex items-center gap-6">
                  <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                    <LayoutDashboard size={15} /> Dashboard
                  </Link>
                  <Link href="/incidents" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                    <List size={15} /> Incidents
                  </Link>
                  <Link href="/oncall" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
                    <Users size={15} /> On-Call
                  </Link>
                </div>
              </div>
            </nav>
            <main className="max-w-6xl mx-auto px-6 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}