import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signingApi, keyGroupApi } from '../api/client'
import type { SigningRequestDto } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Clock, Send, Loader, AlertCircle, CheckCircle, Key, ShieldCheck } from 'lucide-react'

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod
    exp >>= 1n
    base = (base * base) % mod
  }
  return result
}

function bigIntToBytes(n: bigint): Uint8Array {
  if (n === 0n) return new Uint8Array(1)
  let hex = n.toString(16)
  if (hex.length % 2) hex = '0' + hex
  return new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
}

function computeRsaPartialSig(docHashBase64: string, yHex: string, rsaModulusHex: string): string {
  const docHashBytes = Uint8Array.from(atob(docHashBase64), (c) => c.charCodeAt(0))
  const docHashHex = Array.from(docHashBytes).map((b) => b.toString(16).padStart(2, '0')).join('')
  const n = BigInt('0x' + rsaModulusHex)
  const yi = BigInt('0x' + yHex)
  const hashModN = BigInt('0x' + docHashHex) % n
  const partialSig = modPow(hashModN, yi, n)
  return btoa(String.fromCharCode(...bigIntToBytes(partialSig)))
}

/** Render signing order badges for all participants of a request */
function OrderingBadges({ req, myUsername }: { req: SigningRequestDto; myUsername: string }) {
  const orders = req.signingOrders ?? {}
  const signed = req.signedParticipantIds ?? []
  const hasOrdering = Object.keys(orders).length > 0 && new Set(Object.values(orders)).size > 1
  if (!hasOrdering) return null

  // Group by order value, sorted
  const groups: Record<number, string[]> = {}
  req.participantIds.forEach((pid) => {
    const o = orders[pid] ?? 1
    if (!groups[o]) groups[o] = []
    groups[o].push(pid)
  })
  const steps = Object.keys(groups).map(Number).sort((a, b) => a - b)

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {steps.map((step, si) => {
        const members = groups[step]
        const allSigned = members.every((p) => signed.includes(p))
        const isCurrentStep = !allSigned && steps.slice(0, si).every((s) =>
          groups[s].every((p) => signed.includes(p))
        )
        return (
          <span key={step} className="flex items-center gap-1">
            {si > 0 && <span className="text-slate-300 text-xs">→</span>}
            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              allSigned
                ? 'bg-green-100 text-green-700'
                : isCurrentStep
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <span className="opacity-60 text-[10px]">{step}.</span>
              {members.map((pid, mi) => (
                <span key={pid}>
                  {mi > 0 && <span className="opacity-50 mx-0.5">/</span>}
                  <span className={pid === myUsername ? 'font-bold' : ''}>
                    {signed.includes(pid) ? <><span className="line-through opacity-60">{pid}</span> ✓</> : pid}
                  </span>
                </span>
              ))}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export default function PendingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<SigningRequestDto[]>([])
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState<string | null>(null)
  const [shareInputs, setShareInputs] = useState<Record<string, string>>({})
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({})
  const [computing, setComputing] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, { type: 'success' | 'error'; text: string }>>({})

  const fetchPending = () => {
    signingApi.pending().then((r) => setRequests(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchPending() }, [])

  const handleSign = async (req: SigningRequestDto) => {
    const participantId = user?.username || ''
    const yHex = shareInputs[req.requestId]?.trim()
    const otp = otpInputs[req.requestId]?.trim()

    if (!yHex) {
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: 'Please enter your y-share (hex)' } }))
      return
    }
    if (!otp) {
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: 'Please enter your Signing PIN (6 digits)' } }))
      return
    }
    if (!/^\d{6}$/.test(otp)) {
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: 'Signing PIN must be exactly 6 digits' } }))
      return
    }

    setSigning(req.requestId)
    setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: '' } }))

    try {
      let partialSignatureBase64: string
      if (req.keyGroupId && req.documentHashBase64 && req.rsaModulusHex) {
        setComputing(req.requestId)
        try {
          partialSignatureBase64 = computeRsaPartialSig(req.documentHashBase64, yHex, req.rsaModulusHex)
        } finally {
          setComputing(null)
        }
      } else {
        partialSignatureBase64 = yHex
      }

      await signingApi.partialSign(req.requestId, { participantId, partialSignatureBase64, confirmOtp: otp })
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'success', text: 'Partial signature submitted successfully!' } }))
      fetchPending()
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || 'Signing failed'
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: msg } }))
    } finally {
      setSigning(null)
    }
  }

  const autoFetchShare = async (req: SigningRequestDto) => {
    if (!req.keyGroupId || !user?.username) return
    try {
      const res = await keyGroupApi.getShare(req.keyGroupId, user.username)
      setShareInputs((prev) => ({ ...prev, [req.requestId]: res.data.shareEncoded }))
    } catch {
      setMessages((prev) => ({ ...prev, [req.requestId]: { type: 'error', text: 'Failed to fetch key share automatically' } }))
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400 p-8">
      <Loader size={20} className="animate-spin mr-2" />Loading...
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Pending Signatures</h1>
        <p className="text-slate-500 text-sm mt-1">
          Signing requests awaiting confirmation from <strong>{user?.username}</strong>
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl flex flex-col items-center py-16 text-slate-400">
          <Clock size={40} className="mb-3 text-slate-300" />
          <p className="text-sm">No pending requests for you</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const pids = req.participantIds ?? []
            const signed = req.signedParticipantIds ?? []
            const myUsername = user?.username || ''
            const alreadySigned = signed.includes(myUsername)
            // Check if it's my turn: I must be in currentSignerIds
            const currentSigners = req.currentSignerIds ?? pids.filter(p => !signed.includes(p))
            const isMyTurn = currentSigners.includes(myUsername)

            return (
              <div key={req.requestId} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-slate-800">{req.documentName || `Document #${req.documentId}`}</h2>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                        {req.requestId.substring(0, 8)}...
                      </span>
                      {req.keyGroupId && (
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">RSA Key Group</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Threshold {req.threshold}-of-{pids.length} · Signed: {signed.length}/{req.threshold}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/requests/${req.requestId}`)}
                    className="text-xs text-slate-500 hover:text-indigo-600 shrink-0 ml-2"
                  >
                    View details →
                  </button>
                </div>

                {/* Signing order badges */}
                <OrderingBadges req={req} myUsername={myUsername} />

                {messages[req.requestId]?.text && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 ${
                    messages[req.requestId].type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}>
                    {messages[req.requestId].type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {messages[req.requestId].text}
                  </div>
                )}

                {alreadySigned ? (
                  <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 px-3 py-2 rounded-lg">
                    <CheckCircle size={13} />You have already signed this request.
                  </div>
                ) : !isMyTurn ? (
                  <div className="flex items-center gap-2 text-xs bg-amber-50 text-amber-700 px-3 py-2 rounded-lg">
                    <Clock size={13} />
                    Not your turn yet. Waiting for{' '}
                    <strong>{currentSigners.filter(p => p !== myUsername).join(', ') || 'previous signer'}</strong>{' '}
                    to sign first.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        y-share (hex){req.keyGroupId && <span className="text-indigo-500 ml-1">— RSA partial signature will be computed automatically</span>}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={shareInputs[req.requestId] || ''}
                          onChange={(e) => setShareInputs((prev) => ({ ...prev, [req.requestId]: e.target.value }))}
                          placeholder="Paste your y-share (hex) here..."
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                        {req.keyGroupId && (
                          <button
                            onClick={() => autoFetchShare(req)}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 px-2.5 py-2 rounded-lg hover:bg-indigo-50 transition-colors whitespace-nowrap"
                          >
                            <Key size={13} />Fetch share
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1">
                        <ShieldCheck size={11} />
                        Signing PIN <span className="text-red-500 ml-0.5">*</span>
                        <span className="text-slate-400 font-normal ml-1">(6 digits)</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpInputs[req.requestId] || ''}
                        onChange={(e) => setOtpInputs((prev) => ({
                          ...prev,
                          [req.requestId]: e.target.value.replace(/\D/g, '').slice(0, 6)
                        }))}
                        placeholder="______"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest font-mono"
                      />
                    </div>

                    <button
                      onClick={() => handleSign(req)}
                      disabled={signing === req.requestId}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {signing === req.requestId ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                      {computing === req.requestId ? 'Computing RSA...' : signing === req.requestId ? 'Submitting...' : 'Submit Signature'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
