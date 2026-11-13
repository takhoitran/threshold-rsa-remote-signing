import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signingApi, documentApi, keyGroupApi } from '../api/client'
import type { SigningRequestDto, DocumentDto, KeyGroupDto } from '../api/client'
import { ClipboardList, Plus, Loader, AlertCircle } from 'lucide-react'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    WAITING_PARTIALS: { cls: 'bg-amber-100 text-amber-700', label: 'Waiting' },
    READY_TO_COMBINE: { cls: 'bg-blue-100 text-blue-700', label: 'Ready to Combine' },
    SIGNED: { cls: 'bg-green-100 text-green-700', label: 'Signed' },
  }
  const { cls, label } = map[status] || { cls: 'bg-slate-100 text-slate-600', label: status }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
}

export default function RequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<SigningRequestDto[]>([])
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [keyGroups, setKeyGroups] = useState<KeyGroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [documentId, setDocumentId] = useState('')
  const [threshold, setThreshold] = useState(2)
  const [keyGroupId, setKeyGroupId] = useState('')
  // participants: list of { id, order }
  const [participants, setParticipants] = useState<{ id: string; order: number }[]>([])
  const [loadingGroup, setLoadingGroup] = useState(false)

  // Policy metadata
  const [contractValue, setContractValue] = useState('')
  const [docType, setDocType] = useState('internal')
  const [isExternal, setIsExternal] = useState(false)

  // Mirror backend PolicyEngineService logic for instant client-side hint
  const evaluatePolicy = (pids: { id: string }[], cv: string, dt: string, ext: boolean) => {
    const n = pids.filter(p => p.id.trim()).length
    if (n === 0) return null
    const val = Number(cv || 0)
    if (val >= 10_000_000_000) return { threshold: n, reason: `≥10B VND: unanimous consent required (${n}-of-${n})` }
    if (val >= 1_000_000_000) return { threshold: Math.min(2, n), reason: '≥1B VND: minimum 2 signers required' }
    if (dt === 'classified') return { threshold: Math.floor(n / 2) + 1, reason: `Classified document: majority required (${Math.floor(n / 2) + 1}-of-${n})` }
    if (dt === 'legal') return { threshold: Math.min(2, n), reason: 'Legal document: minimum 2 signers required' }
    if (ext) return { threshold: Math.min(2, n), reason: 'Cross-organization: minimum 2 signers required' }
    return { threshold: 1, reason: 'Default: 1 signer is sufficient' }
  }

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      signingApi.list().then((r) => setRequests(r.data)).catch(() => {}),
      documentApi.list().then((d) => setDocs(d.data)).catch(() => {}),
      keyGroupApi.list().then((kg) => setKeyGroups(kg.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [])

  const handleKeyGroupChange = (gid: string) => {
    setKeyGroupId(gid)
    if (!gid) {
      setParticipants([])
      return
    }
    const group = keyGroups.find((g) => g.groupId === gid)
    if (group) {
      setParticipants((group.participantIds ?? []).map((id) => ({ id, order: 1 })))
    } else {
      setLoadingGroup(true)
      keyGroupApi.get(gid)
        .then((res) => setParticipants((res.data.participantIds ?? []).map((id) => ({ id, order: 1 }))))
        .catch(() => setError('Failed to load key group participants'))
        .finally(() => setLoadingGroup(false))
    }
  }

  const updateOrder = (i: number, val: number) => {
    const next = [...participants]
    next[i] = { ...next[i], order: Math.max(1, val) }
    setParticipants(next)
  }

  const updateId = (i: number, val: string) => {
    const next = [...participants]
    next[i] = { ...next[i], id: val }
    setParticipants(next)
  }

  const isOrdered = participants.length > 1 &&
    new Set(participants.map((p) => p.order)).size > 1

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const valid = participants.filter((p) => p.id.trim())
    if (!documentId) { setError('Please select a document'); return }
    if (valid.length < 1) { setError('At least 1 participant is required'); return }
    if (threshold < 1 || threshold > valid.length) {
      setError(`Threshold must be between 1 and ${valid.length}`)
      return
    }

    const participantIds = valid.map((p) => p.id.trim())
    // Only send signingOrders if there are different values
    const ordersMap: Record<string, number> = {}
    valid.forEach((p) => { ordersMap[p.id.trim()] = p.order })
    const hasOrdering = new Set(Object.values(ordersMap)).size > 1

    const metadata: Record<string, unknown> = {}
    if (contractValue) metadata.contract_value = Number(contractValue)
    if (docType !== 'internal') metadata.doc_type = docType
    if (isExternal) metadata.is_external = true

    setSubmitting(true)
    try {
      const res = await signingApi.create({
        documentId,
        threshold,
        participantIds,
        ...(keyGroupId.trim() ? { keyGroupId: keyGroupId.trim() } : {}),
        ...(hasOrdering ? { signingOrders: ordersMap } : {}),
        ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
      })
      setShowForm(false)
      navigate(`/requests/${res.data.requestId}`)
    } catch (err: any) {
      const d = err.response?.data
      const msg = typeof d === 'string' && d ? d
        : d?.message || d?.error
        || err.message || 'Failed to create signing request'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setDocumentId('')
    setThreshold(2)
    setKeyGroupId('')
    setParticipants([])
    setContractValue('')
    setDocType('internal')
    setIsExternal(false)
    setError('')
    setShowForm(false)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Signing Requests</h1>
          <p className="text-slate-500 text-sm mt-1">Manage document signing requests</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />New Request
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">Create Signing Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                <AlertCircle size={15} />{error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Document *</label>
                <select
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select document --</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>{d.originalFileName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Threshold</label>
                <input
                  type="number" min={1} max={participants.filter(p => p.id.trim()).length || 1}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Key Group <span className="text-slate-400 font-normal">(select to auto-load participants)</span>
              </label>
              <select
                value={keyGroupId}
                onChange={(e) => handleKeyGroupChange(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- No key group (ephemeral) --</option>
                {keyGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupId.substring(0, 8)}... ({(g.participantIds ?? []).length} members, {g.threshold}-of-{(g.participantIds ?? []).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Participants with order input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Participants {loadingGroup && <Loader size={12} className="inline animate-spin ml-1" />}
                </label>
                <span className="text-xs text-slate-400">"Order" column = signing priority (same number = sign in parallel)</span>
              </div>

              {/* Header row */}
              {participants.length > 0 && (
                <div className="flex items-center gap-2 px-1 mb-1">
                  <span className="text-xs text-slate-400 font-medium w-16 text-center">Order</span>
                  <span className="text-xs text-slate-400 font-medium flex-1">Participant</span>
                </div>
              )}

              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* Order number input */}
                    <input
                      type="number"
                      min={1}
                      value={p.order}
                      onChange={(e) => updateOrder(i, Number(e.target.value))}
                      className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {keyGroupId ? (
                      /* Key group mode: read-only name */
                      <div className="flex-1 border border-slate-100 bg-slate-50 rounded-lg px-3 py-1.5 text-sm text-slate-700 font-medium">
                        {p.id}
                      </div>
                    ) : (
                      /* Free-text mode */
                      <input
                        type="text"
                        value={p.id}
                        onChange={(e) => updateId(i, e.target.value)}
                        placeholder={`participant_${i + 1}`}
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}

                    {!keyGroupId && (
                      <button
                        type="button"
                        onClick={() => setParticipants(participants.filter((_, j) => j !== i))}
                        className="text-xs text-red-400 hover:text-red-600 px-1"
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>

              {!keyGroupId && (
                <button
                  type="button"
                  onClick={() => setParticipants([...participants, { id: '', order: 1 }])}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-800"
                >+ Add participant</button>
              )}

              {/* Preview signing order */}
              {isOrdered && (() => {
                const groups: Record<number, string[]> = {}
                participants.filter(p => p.id.trim()).forEach(p => {
                  if (!groups[p.order]) groups[p.order] = []
                  groups[p.order].push(p.id)
                })
                const steps = Object.keys(groups).map(Number).sort((a, b) => a - b)
                return (
                  <div className="mt-3 p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                    <span className="font-semibold">Signing order: </span>
                    {steps.map((step, si) => (
                      <span key={step}>
                        <span className="font-medium">{groups[step].join(' or ')}</span>
                        {si < steps.length - 1 && <span className="mx-1.5 text-indigo-400">→</span>}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Policy metadata */}
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Policy Metadata (optional)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Contract Value (VND)</label>
                  <input
                    type="number" min={0}
                    value={contractValue}
                    onChange={(e) => setContractValue(e.target.value)}
                    placeholder="e.g. 5000000000"
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="internal">Internal (default)</option>
                    <option value="legal">Legal</option>
                    <option value="classified">Classified</option>
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isExternal}
                      onChange={(e) => setIsExternal(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 accent-indigo-600"
                    />
                    <span className="text-sm text-slate-700">Cross-organization</span>
                  </label>
                </div>
              </div>

              {/* Policy hint */}
              {(() => {
                const hint = evaluatePolicy(participants, contractValue, docType, isExternal)
                if (!hint) return null
                const triggered = hint.threshold > 1 || docType !== 'internal' || isExternal || Number(contractValue) > 0
                if (!triggered) return null
                return (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    <span className="font-semibold shrink-0">Policy suggestion:</span>
                    <span>{hint.reason} → threshold = <strong>{hint.threshold}</strong></span>
                  </div>
                )
              })()}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                {submitting && <Loader size={13} className="animate-spin" />}
                {submitting ? 'Creating...' : 'Create Request'}
              </button>
              <button type="button" onClick={resetForm}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader size={20} className="animate-spin mr-2" />Loading...
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ClipboardList size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">No signing requests yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="text-left px-6 py-3">ID</th>
                <th className="text-left px-6 py-3">Document</th>
                <th className="text-left px-6 py-3">Threshold</th>
                <th className="text-left px-6 py-3">Progress</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((req) => {
                const pids = req.participantIds ?? []
                const signed = req.signedParticipantIds ?? []
                const hasOrdering = Object.keys(req.signingOrders ?? {}).length > 0 &&
                  new Set(Object.values(req.signingOrders ?? {})).size > 1
                return (
                  <tr key={req.requestId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">{req.requestId.substring(0, 8)}...</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{req.documentName || `Doc #${req.documentId}`}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {req.threshold}-of-{pids.length}
                      {hasOrdering && (
                        <span className="ml-1.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">ordered</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all"
                            style={{ width: pids.length ? `${(signed.length / pids.length) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs text-slate-500">{signed.length}/{pids.length}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={req.status} /></td>
                    <td className="px-6 py-4 text-xs text-slate-400">{new Date(req.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/requests/${req.requestId}`)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >Details →</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
