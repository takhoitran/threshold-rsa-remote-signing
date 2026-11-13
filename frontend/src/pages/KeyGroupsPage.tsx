import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { keyGroupApi } from '../api/client'
import type { KeyGroupDto } from '../api/client'
import { Key, Plus, Trash2, AlertCircle, Loader, Users, ChevronRight, ShieldCheck } from 'lucide-react'
import ParticipantInput from '../components/ParticipantInput'

export default function KeyGroupsPage() {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<KeyGroupDto[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [threshold, setThreshold] = useState(3)
  const [participants, setParticipants] = useState<string[]>(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchGroups = () => {
    keyGroupApi.list()
      .then((r) => setGroups(r.data))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => { fetchGroups() }, [])

  const handleDelete = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    if (!confirm('Delete this key group? This action cannot be undone.')) return
    setDeletingId(groupId)
    try {
      await keyGroupApi.delete(groupId)
      setGroups((prev) => prev.filter((g) => g.groupId !== groupId))
    } catch (err: any) {
      alert(err.response?.data || 'Failed to delete key group')
    } finally {
      setDeletingId(null)
    }
  }

  const updateParticipant = (i: number, val: string) => {
    const next = [...participants]
    next[i] = val
    setParticipants(next)
  }

  const addParticipant = () => setParticipants([...participants, ''])
  const removeParticipant = (i: number) => {
    if (participants.length <= 2) return
    setParticipants(participants.filter((_, idx) => idx !== i))
  }

  const filledCount = participants.filter(p => p.trim()).length

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const ids = participants.map((p) => p.trim()).filter(Boolean)
    if (ids.length < 2) { setError('Need at least 2 participants'); return }
    if (threshold < 1 || threshold > ids.length) { setError(`Threshold must be between 1 and ${ids.length}`); return }
    if (new Set(ids).size !== ids.length) { setError('Participant IDs must be unique'); return }

    setLoading(true)
    try {
      const res = await keyGroupApi.create({ threshold, participantIds: ids })
      navigate(`/key-groups/${res.data.groupId}`)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'Failed to create key group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Key Groups</h1>
          <p className="text-slate-500 text-sm mt-1">Shamir Secret Sharing groups for RSA-2048 threshold signing</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />New Key Group
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-indigo-200 rounded-xl p-6 mb-6">
          {/* Info box */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 mb-4 text-xs text-indigo-700">
            <p className="font-semibold mb-1 flex items-center gap-1"><Key size={12} />How it works</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>System generates RSA-2048 key pair + X.509 self-signed certificate</li>
              <li>Private exponent <code className="bg-indigo-100 px-1 rounded">d</code> is split using Shamir Secret Sharing</li>
              <li>At least <strong>threshold</strong> participants must sign to reconstruct the signature</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                <AlertCircle size={15} />{error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Threshold (t-of-n)</label>
              <input
                type="number" min={1} max={filledCount || participants.length}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">
                Requires {threshold} out of {filledCount || '?'} participants.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Participants <span className="text-slate-400 font-normal text-xs">(registered usernames)</span>
              </label>
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-6 text-right">{i + 1}.</span>
                    <ParticipantInput
                      value={p}
                      onChange={(v) => updateParticipant(i, v)}
                      placeholder={`participant_${i + 1}`}
                      inputClassName="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeParticipant(i)}
                      disabled={participants.length <= 2}
                      className="text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addParticipant}
                className="mt-2 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
              >
                <Plus size={14} />Add participant
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-2.5 px-5 rounded-lg text-sm transition-colors"
              >
                {loading && <Loader size={15} className="animate-spin" />}
                {loading ? 'Creating...' : 'Initialize Key Group'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200">
        {loadingList ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader size={20} className="animate-spin mr-2" />Loading...
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Key size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">No key groups yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-indigo-600 text-sm hover:underline"
            >
              Create your first key group
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((g) => (
              <div
                key={g.groupId}
                onClick={() => navigate(`/key-groups/${g.groupId}`)}
                className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Key size={18} className="text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-slate-400 font-mono">{g.groupId.substring(0, 16)}...</code>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <ShieldCheck size={12} className="text-indigo-500" />
                      {g.threshold}-of-{g.totalParticipants} threshold
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Users size={12} />
                      {g.participantIds.join(', ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">v{g.version}</span>
                  <button
                    onClick={(e) => handleDelete(e, g.groupId)}
                    disabled={deletingId === g.groupId}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete key group"
                  >
                    {deletingId === g.groupId
                      ? <Loader size={15} className="animate-spin" />
                      : <Trash2 size={15} />}
                  </button>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
