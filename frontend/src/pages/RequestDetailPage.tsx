import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { signingApi } from '../api/client'
import type { SigningRequestDto } from '../api/client'
import {
  Loader, CheckCircle, Download, Clock,
  Users, ShieldCheck, Combine, RefreshCw
} from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    WAITING_PARTIALS: { cls: 'bg-amber-100 text-amber-700', label: 'Waiting for Signatures' },
    READY_TO_COMBINE: { cls: 'bg-blue-100 text-blue-700', label: 'Ready to Combine' },
    SIGNED: { cls: 'bg-green-100 text-green-700', label: 'Signed' },
  }
  const { cls, label } = map[status] || { cls: 'bg-slate-100 text-slate-600', label: status }
  return <span className={`text-sm font-medium px-3 py-1 rounded-full ${cls}`}>{label}</span>
}

export default function RequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()
  const [req, setReq] = useState<SigningRequestDto | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReq = () => {
    if (!requestId) return
    signingApi.get(requestId)
      .then((r) => setReq(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchReq() }, [requestId])

  const downloadPdf = async () => {
    if (!requestId) return
    const res = await signingApi.downloadSignedPdf(requestId)
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = req?.documentName ? `signed_${req.documentName}` : `signed_${requestId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 p-8"><Loader size={20} className="animate-spin mr-2" />Loading...</div>
  if (!req) return <div className="p-8 text-red-500">Signing request not found</div>

  const pids = req.participantIds ?? []
  const signed = req.signedParticipantIds ?? []
  const progress = pids.length ? signed.length / pids.length * 100 : 0

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Signing Request</h1>
          <p className="text-slate-500 text-sm mt-1">{req.documentName || `Document #${req.documentId}`}</p>
          <code className="text-xs text-slate-400">{req.requestId}</code>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchReq} className="text-slate-400 hover:text-slate-600"><RefreshCw size={16} /></button>
          <StatusBadge status={req.status} />
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <ShieldCheck size={18} className="text-indigo-600 mx-auto mb-2" />
          <p className="text-xl font-bold text-slate-800">{req.threshold}-of-{pids.length}</p>
          <p className="text-xs text-slate-500">Threshold</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Users size={18} className="text-violet-600 mx-auto mb-2" />
          <p className="text-xl font-bold text-slate-800">{signed.length}/{pids.length}</p>
          <p className="text-xs text-slate-500">Signed / Total</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
          <Clock size={18} className="text-amber-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">{new Date(req.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-slate-500">Created</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Signing Progress</h2>
          <span className="text-sm text-slate-500">{signed.length}/{pids.length} signed</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
          <div
            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2">
          {pids.map((pid) => {
            const hasSigned = signed.includes(pid)
            return (
              <div key={pid} className="flex items-center gap-3">
                {hasSigned
                  ? <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  : <Clock size={16} className="text-amber-400 flex-shrink-0" />
                }
                <span className={`text-sm ${hasSigned ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{pid}</span>
                {hasSigned && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Signed</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Combine action */}
      {req.status === 'READY_TO_COMBINE' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-4">
          <p className="text-sm text-blue-800 mb-3">
            <strong>{req.threshold} signatures collected!</strong> Select the signature position on the PDF before finalizing.
          </p>
          <button
            onClick={() => navigate(`/requests/${requestId}/sign-position`)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Combine size={15} />
            Select Position & Finalize
          </button>
        </div>
      )}

      {/* Download signed PDF */}
      {req.status === 'SIGNED' && req.signedPdfBase64 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
          <p className="text-sm text-green-800 mb-3 flex items-center gap-2">
            <CheckCircle size={15} />
            Document signed successfully!
          </p>
          <button
            onClick={downloadPdf}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={15} />
            Download Signed PDF
          </button>
        </div>
      )}

      {/* Signature info */}
      {req.finalSignatureBase64 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Digital Signature</h2>
          <code className="block text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-2 rounded font-mono break-all">
            {req.finalSignatureBase64.substring(0, 120)}...
          </code>
          {req.keyGroupId && (
            <p className="text-xs text-slate-400 mt-2">Key Group: <code className="bg-slate-100 px-1 rounded">{req.keyGroupId}</code></p>
          )}
        </div>
      )}
    </div>
  )
}
