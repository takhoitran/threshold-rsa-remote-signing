import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { documentApi, signingApi, auditApi } from '../api/client'
import { FileText, ClipboardList, Clock, ScrollText, ChevronRight, CheckCircle, Loader } from 'lucide-react'

interface Stats { docs: number; requests: number; pending: number; logs: number }

function StatCard({ icon: Icon, label, value, color, to }: {
  icon: React.ElementType; label: string; value: number | string; color: string; to: string
}) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow text-left w-full"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
      <ChevronRight size={16} className="text-slate-400" />
    </button>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({ docs: 0, requests: 0, pending: 0, logs: 0 })
  const [recentRequests, setRecentRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      documentApi.list(),
      signingApi.list(),
      signingApi.pending(),
      auditApi.list(),
    ]).then(([docs, reqs, pend, logs]) => {
      setStats({
        docs: docs.data.length,
        requests: reqs.data.length,
        pending: pend.data.length,
        logs: logs.data.length,
      })
      setRecentRequests(reqs.data.slice(0, 5))
    }).finally(() => setLoading(false))
  }, [])

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      WAITING_PARTIALS: 'bg-amber-100 text-amber-700',
      READY_TO_COMBINE: 'bg-blue-100 text-blue-700',
      SIGNED: 'bg-green-100 text-green-700',
    }
    const labels: Record<string, string> = {
      WAITING_PARTIALS: 'Waiting',
      READY_TO_COMBINE: 'Ready to Combine',
      SIGNED: 'Signed',
    }
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || 'bg-slate-100 text-slate-600'}`}>
        {labels[status] || status}
      </span>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <Loader size={20} className="animate-spin mr-2" />Loading...
    </div>
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Welcome, {user?.username}</h1>
        <p className="text-slate-500 mt-1">MPC Threshold Remote Signing Platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={FileText} label="Documents Uploaded" value={stats.docs} color="bg-indigo-500" to="/documents" />
        <StatCard icon={ClipboardList} label="Signing Requests" value={stats.requests} color="bg-violet-500" to="/requests" />
        <StatCard icon={Clock} label="Pending My Signature" value={stats.pending} color="bg-amber-500" to="/pending" />
        <StatCard icon={ScrollText} label="Audit Logs" value={stats.logs} color="bg-emerald-500" to="/audit-logs" />
      </div>

      {/* Recent requests */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Signing Requests</h2>
        </div>
        {recentRequests.length === 0 ? (
          <div className="px-6 py-10 text-center text-slate-400 text-sm">No signing requests yet</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentRequests.map((req) => (
              <div key={req.requestId} className="px-6 py-4 flex items-center gap-4">
                {req.status === 'SIGNED'
                  ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  : <Clock size={16} className="text-amber-500 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{req.documentName || `Document #${req.documentId}`}</p>
                  <p className="text-xs text-slate-400">
                    Threshold {req.threshold}-of-{(req.participantIds ?? []).length} · {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {statusBadge(req.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
