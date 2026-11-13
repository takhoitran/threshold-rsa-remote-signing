import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/client'
import {
  User, Mail, BadgeCheck, Building2, Calendar, Shield,
  KeyRound, Lock, CheckCircle, AlertCircle, Loader, Eye, EyeOff, X, ChevronRight
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

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

function PasswordField({
  label, value, onChange, show, onToggle, placeholder
}: {
  label: string; value: string; onChange: (v: string) => void
  show: boolean; onToggle: () => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-9 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, icon: Icon, onClose, children }: {
  title: string; icon: React.ElementType; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-indigo-600" />
            <span className="font-semibold text-slate-800 text-sm">{title}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Security action button ────────────────────────────────────────────────────

function SecurityButton({ icon: Icon, label, description, onClick }: {
  icon: React.ElementType; label: string; description: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors text-left group"
    >
      <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center flex-shrink-0 transition-colors">
        <Icon size={16} className="text-slate-500 group-hover:text-indigo-600 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
      </div>
      <ChevronRight size={15} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ActiveModal = null | 'password' | 'pin'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // Change password state
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPwCurrent, setShowPwCurrent] = useState(false)
  const [showPwNew, setShowPwNew] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Change signing PIN state
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [showPinCurrent, setShowPinCurrent] = useState(false)
  const [showPinNew, setShowPinNew] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [pinMsg, setPinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const closeModal = () => {
    setActiveModal(null)
    setPwMsg(null); setPwCurrent(''); setPwNew(''); setPwConfirm('')
    setPinMsg(null); setPinCurrent(''); setPinNew(''); setPinConfirm('')
    setShowPwCurrent(false); setShowPwNew(false)
    setShowPinCurrent(false); setShowPinNew(false)
  }

  const handleChangePassword = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwNew !== pwConfirm) { setPwMsg({ type: 'error', text: 'New passwords do not match' }); return }
    if (pwNew.length < 6) { setPwMsg({ type: 'error', text: 'New password must be at least 6 characters' }); return }
    setPwLoading(true)
    try {
      await authApi.changePassword({ currentPassword: pwCurrent, newPassword: pwNew })
      setPwMsg({ type: 'success', text: 'Password changed successfully' })
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err.response?.data || 'Failed to change password' })
    } finally {
      setPwLoading(false)
    }
  }

  const handleChangeSigningPin = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setPinMsg(null)
    if (pinNew !== pinConfirm) { setPinMsg({ type: 'error', text: 'New PINs do not match' }); return }
    if (!/^\d{6}$/.test(pinNew)) { setPinMsg({ type: 'error', text: 'Signing PIN must be exactly 6 digits' }); return }
    setPinLoading(true)
    try {
      await authApi.changeSigningPin({ currentPin: pinCurrent, newPin: pinNew })
      setPinMsg({ type: 'success', text: 'Signing PIN changed successfully' })
      setPinCurrent(''); setPinNew(''); setPinConfirm('')
      await refreshUser()
    } catch (err: any) {
      setPinMsg({ type: 'error', text: err.response?.data || 'Failed to change signing PIN' })
    } finally {
      setPinLoading(false)
    }
  }

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : undefined

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Profile</h1>
        <p className="text-slate-500 text-sm mt-1">View account information and manage security settings</p>
      </div>

      {/* Account card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        {/* Avatar row */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl flex-shrink-0">
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-lg">{user?.username}</p>
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
              user?.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              <Shield size={10} />
              {user?.role}
            </span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          <InfoRow icon={User}      label="Username"         value={user?.username} />
          <InfoRow icon={Mail}      label="Email"            value={user?.email} />
          <InfoRow icon={BadgeCheck} label="Employee ID"     value={user?.employeeId} />
          <InfoRow icon={Building2}  label="Unit / Department" value={user?.unit} />
          <InfoRow icon={Calendar}   label="Member since"    value={joinedDate} />
        </div>
      </div>

      {/* Security section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">Security</h2>
        <div className="space-y-3">
          <SecurityButton
            icon={Lock}
            label="Change Password"
            description="Update your login password"
            onClick={() => setActiveModal('password')}
          />
          <SecurityButton
            icon={KeyRound}
            label="Change Signing PIN"
            description="Update the 6-digit PIN used to confirm signatures"
            onClick={() => setActiveModal('pin')}
          />
        </div>
      </div>

      {/* ── Change Password Modal ── */}
      {activeModal === 'password' && (
        <Modal title="Change Password" icon={Lock} onClose={closeModal}>
          {pwMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${
              pwMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {pwMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {pwMsg.text}
            </div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-3">
            <PasswordField
              label="Current password"
              value={pwCurrent}
              onChange={setPwCurrent}
              show={showPwCurrent}
              onToggle={() => setShowPwCurrent(v => !v)}
              placeholder="Enter current password"
            />
            <PasswordField
              label="New password"
              value={pwNew}
              onChange={setPwNew}
              show={showPwNew}
              onToggle={() => setShowPwNew(v => !v)}
              placeholder="At least 6 characters"
            />
            <PasswordField
              label="Confirm new password"
              value={pwConfirm}
              onChange={setPwConfirm}
              show={showPwNew}
              onToggle={() => setShowPwNew(v => !v)}
              placeholder="Repeat new password"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {pwLoading ? <Loader size={14} className="animate-spin" /> : <Lock size={14} />}
                {pwLoading ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Change Signing PIN Modal ── */}
      {activeModal === 'pin' && (
        <Modal title="Change Signing PIN" icon={KeyRound} onClose={closeModal}>
          <p className="text-xs text-slate-400 mb-4">
            The 6-digit PIN used to authorize each partial signature.
          </p>
          {pinMsg && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${
              pinMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {pinMsg.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              {pinMsg.text}
            </div>
          )}
          <form onSubmit={handleChangeSigningPin} className="space-y-3">
            <PasswordField
              label="Current signing PIN"
              value={pinCurrent}
              onChange={setPinCurrent}
              show={showPinCurrent}
              onToggle={() => setShowPinCurrent(v => !v)}
              placeholder="6-digit current PIN"
            />
            <PasswordField
              label="New signing PIN"
              value={pinNew}
              onChange={setPinNew}
              show={showPinNew}
              onToggle={() => setShowPinNew(v => !v)}
              placeholder="6 digits"
            />
            <PasswordField
              label="Confirm new PIN"
              value={pinConfirm}
              onChange={setPinConfirm}
              show={showPinNew}
              onToggle={() => setShowPinNew(v => !v)}
              placeholder="Repeat new PIN"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={pinLoading || !pinCurrent || !pinNew || !pinConfirm}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {pinLoading ? <Loader size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {pinLoading ? 'Updating...' : 'Update Signing PIN'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
