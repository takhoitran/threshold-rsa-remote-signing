import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { userApi } from '../api/client'
import type { UserInfo } from '../api/client'
import { UserAvatar } from '../components/ParticipantInput'
import { Mail, BadgeCheck, Building2, Calendar, Shield, Loader, AlertCircle, ArrowLeft } from 'lucide-react'

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-indigo-600" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-800 mt-0.5">{value || '—'}</p>
      </div>
    </div>
  )
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!username) return
    setLoading(true)
    userApi.getProfile(username)
      .then(r => setUser(r.data))
      .catch(() => setError('User not found'))
      .finally(() => setLoading(false))
  }, [username])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 p-8">
        <Loader size={20} className="animate-spin mr-2" />Loading...
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="p-8 max-w-xl">
        <div className="flex items-center gap-2 text-red-500 mb-4">
          <AlertCircle size={18} />{error || 'User not found'}
        </div>
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} />Go back
        </button>
      </div>
    )
  }

  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : undefined

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Profile</h1>
          <p className="text-slate-500 text-sm mt-0.5">Viewing @{user.username}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <UserAvatar username={user.username} size="lg" />
          <div>
            <p className="font-semibold text-slate-800 text-lg">{user.username}</p>
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
              user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              <Shield size={10} />{user.role}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <InfoRow icon={Mail}      label="Email"               value={user.email} />
          <InfoRow icon={BadgeCheck} label="Employee ID"        value={user.employeeId} />
          <InfoRow icon={Building2}  label="Unit / Department"  value={user.unit} />
          <InfoRow icon={Calendar}   label="Member since"       value={joinedDate} />
        </div>
      </div>
    </div>
  )
}
