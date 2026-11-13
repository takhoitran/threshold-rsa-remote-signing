import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { keyGroupApi, userApi } from '../api/client'
import type { KeyGroupDto, UserInfo } from '../api/client'
import { Key, Users, ShieldCheck, Plus, Trash2, Copy, Loader, AlertCircle, CheckCircle, BadgeCheck, Building2, Shield, ExternalLink } from 'lucide-react'
import ParticipantInput, { UserAvatar } from '../components/ParticipantInput'

function ParticipantRow({
  pid,
  onRemove,
  onGetShare,
  loadingShare,
  shareData,
  copied,
  onCopy,
}: {
  pid: string
  onRemove: () => void
  onGetShare: () => void
  loadingShare: boolean
  shareData?: string
  copied: boolean
  onCopy: () => void
}) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserInfo | null>(null)
  const [hovered, setHovered] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fetchedRef = useRef(false)

  const clearHide = () => clearTimeout(hideTimerRef.current)
  const scheduleHide = () => { hideTimerRef.current = setTimeout(() => setHovered(false), 120) }

  const handleMouseEnter = async () => {
    clearHide()
    setHovered(true)
    if (!fetchedRef.current) {
      fetchedRef.current = true
      setProfileLoading(true)
      try {
        const res = await userApi.getProfile(pid)
        setProfile(res.data)
      } catch { /* user not found, show basic info */ }
      setProfileLoading(false)
    }
  }

  return (
    <div className="px-5 py-3">
      <div className="flex items-center gap-3">
        <div
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={scheduleHide}
        >
          <UserAvatar username={pid} size="sm" />

          {hovered && (
            <div
              className="absolute left-full top-0 ml-2 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-3"
              onMouseEnter={clearHide}
              onMouseLeave={scheduleHide}
              onClick={e => e.stopPropagation()}
            >
              {profileLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                  <Loader size={13} className="animate-spin" />Loading...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-2.5">
                    <UserAvatar username={pid} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{pid}</p>
                      {profile?.role && (
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          profile.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          <Shield size={8} />{profile.role}
                        </span>
                      )}
                    </div>
                  </div>
                  {profile && (
                    <div className="space-y-1.5 text-xs text-slate-500 mb-2.5">
                      {profile.email && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 font-medium">@</span>
                          <span className="truncate">{profile.email}</span>
                        </div>
                      )}
                      {profile.employeeId && (
                        <div className="flex items-center gap-1.5">
                          <BadgeCheck size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{profile.employeeId}</span>
                        </div>
                      )}
                      {profile.unit && (
                        <div className="flex items-center gap-1.5">
                          <Building2 size={11} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">{profile.unit}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/users/${pid}`)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <ExternalLink size={11} />View full profile
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-slate-700">{pid}</span>
        <button
          onClick={onGetShare}
          disabled={loadingShare}
          className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
        >
          {loadingShare ? <Loader size={12} className="animate-spin" /> : 'View Share'}
        </button>
        <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>

      {shareData && (
        <div className="mt-2 ml-10 flex items-center gap-2">
          <code className="flex-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded font-mono truncate">
            {shareData}
          </code>
          <button onClick={onCopy} className="text-slate-400 hover:text-indigo-600 transition-colors">
            {copied ? <CheckCircle size={13} className="text-green-500" /> : <Copy size={13} />}
          </button>
        </div>
      )}
    </div>
  )
}

export default function KeyGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const [group, setGroup] = useState<KeyGroupDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newParticipant, setNewParticipant] = useState('')
  const [adding, setAdding] = useState(false)
  const [shareData, setShareData] = useState<Record<string, string>>({})
  const [loadingShare, setLoadingShare] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const fetchGroup = () => {
    if (!groupId) return
    setLoading(true)
    keyGroupApi.get(groupId)
      .then((r) => setGroup(r.data))
      .catch(() => setError('Key group not found'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchGroup() }, [groupId])

  const getShare = async (participantId: string) => {
    if (!groupId) return
    setLoadingShare(participantId)
    try {
      const res = await keyGroupApi.getShare(groupId, participantId)
      setShareData((prev) => ({ ...prev, [participantId]: res.data.shareEncoded }))
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to fetch key share' })
    } finally {
      setLoadingShare(null)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleAdd = async () => {
    if (!groupId || !newParticipant.trim()) return
    setAdding(true)
    setActionMsg(null)
    try {
      await keyGroupApi.addParticipant(groupId, newParticipant.trim())
      setActionMsg({ type: 'success', text: `Added "${newParticipant.trim()}"` })
      setNewParticipant('')
      fetchGroup()
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || err.response?.data || 'Failed to add participant' })
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (pid: string) => {
    if (!groupId || !confirm(`Remove participant "${pid}"?`)) return
    setActionMsg(null)
    try {
      await keyGroupApi.removeParticipant(groupId, pid)
      setActionMsg({ type: 'success', text: `Removed "${pid}"` })
      fetchGroup()
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.response?.data?.message || err.response?.data || 'Failed to remove participant' })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400 p-8"><Loader size={20} className="animate-spin mr-2" />Loading...</div>
  if (error) return <div className="p-8 text-red-500">{error}</div>
  if (!group) return null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Key size={20} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">Key Group</h1>
        </div>
        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{group.groupId}</code>
      </div>

      {actionMsg && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg mb-4 ${actionMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {actionMsg.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {actionMsg.text}
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Threshold', value: `${group.threshold}-of-${group.totalParticipants}`, icon: ShieldCheck, color: 'text-indigo-600' },
          { label: 'Participants', value: group.totalParticipants, icon: Users, color: 'text-violet-600' },
          { label: 'Version', value: `v${group.version}`, icon: Key, color: 'text-emerald-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
            <Icon size={18} className={`${color} mx-auto mb-2`} />
            <p className="text-xl font-bold text-slate-800">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {/* RSA Info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">RSA Parameters</h2>
        <div className="space-y-2">
          {[
            { label: 'Modulus (n)', value: group.rsaModulusHex },
            { label: 'Public Exponent (e)', value: group.rsaPublicExponentHex },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded font-mono truncate">
                  {value?.substring(0, 60)}...
                </code>
                <button onClick={() => copyToClipboard(value, label)} className="text-slate-400 hover:text-indigo-600 transition-colors">
                  {copied === label ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Participants */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Users size={15} />Participants & Key Shares</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {(group.participantIds ?? []).map((pid) => (
            <ParticipantRow
              key={pid}
              pid={pid}
              onRemove={() => handleRemove(pid)}
              onGetShare={() => getShare(pid)}
              loadingShare={loadingShare === pid}
              shareData={shareData[pid]}
              copied={copied === pid}
              onCopy={() => copyToClipboard(shareData[pid], pid)}
            />
          ))}
        </div>

        {/* Add participant */}
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2">
          <ParticipantInput
            value={newParticipant}
            onChange={setNewParticipant}
            placeholder="New participant ID..."
            inputClassName="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newParticipant.trim()}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {adding ? <Loader size={13} className="animate-spin" /> : <Plus size={13} />}
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
