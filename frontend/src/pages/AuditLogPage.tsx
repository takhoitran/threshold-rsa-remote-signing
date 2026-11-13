import { useEffect, useState } from 'react'
import { auditApi } from '../api/client'
import type { AuditLogDto } from '../api/client'
import { ScrollText, Loader, RefreshCw } from 'lucide-react'

const actionColors: Record<string, string> = {
  DOCUMENT_UPLOADED: 'bg-blue-100 text-blue-700',
  REQUEST_CREATED: 'bg-violet-100 text-violet-700',
  PARTIAL_SUBMITTED: 'bg-amber-100 text-amber-700',
  SIGNATURE_COMBINED: 'bg-indigo-100 text-indigo-700',
  SIGNATURE_VERIFIED: 'bg-green-100 text-green-700',
  KEY_GROUP_INITIALIZED: 'bg-purple-100 text-purple-700',
  KEY_GROUP_PARTICIPANT_ADDED: 'bg-teal-100 text-teal-700',
  KEY_GROUP_PARTICIPANT_REMOVED: 'bg-red-100 text-red-700',
  SIGN_CONFIRM_FAILED: 'bg-red-100 text-red-700',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const fetchLogs = () => {
    setLoading(true)
    auditApi.list().then((r) => setLogs(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchLogs() }, [])

  const filtered = filter
    ? logs.filter((l) =>
        l.action.toLowerCase().includes(filter.toLowerCase()) ||
        (l.username ?? '').toLowerCase().includes(filter.toLowerCase()) ||
        (l.detail ?? '').toLowerCase().includes(filter.toLowerCase())
      )
    : logs

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audit Logs</h1>
          <p className="text-slate-500 text-sm mt-1">Full history of all system actions</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by action, user, detail..."
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          />
          <button onClick={fetchLogs} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader size={20} className="animate-spin mr-2" />Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ScrollText size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">{filter ? 'No results found' : 'No audit logs yet'}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="text-left px-6 py-3">Time</th>
                <th className="text-left px-6 py-3">Action</th>
                <th className="text-left px-6 py-3">User</th>
                <th className="text-left px-6 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColors[log.action] || 'bg-slate-100 text-slate-600'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-700 font-medium">{log.username ?? '—'}</td>
                  <td className="px-6 py-3 text-xs text-slate-500 max-w-xs truncate">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} / {logs.length} records
          </div>
        )}
      </div>
    </div>
  )
}
