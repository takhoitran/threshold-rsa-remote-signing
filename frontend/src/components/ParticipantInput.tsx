import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { userApi } from '../api/client'
import type { UserInfo } from '../api/client'
import { BadgeCheck, Building2, Shield, ExternalLink } from 'lucide-react'

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
]

export function avatarColor(username: string): string {
  const n = username.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

export function UserAvatar({ username, size = 'sm' }: { username: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-14 h-14 text-2xl' : size === 'md' ? 'w-9 h-9 text-base' : 'w-7 h-7 text-xs'
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 ${avatarColor(username)}`}>
      {username[0]?.toUpperCase()}
    </div>
  )
}

function MiniProfileCard({
  user,
  onMouseEnter,
  onMouseLeave,
}: {
  user: UserInfo
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const navigate = useNavigate()
  return (
    <div
      className="absolute left-full top-0 ml-1 z-50 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-3"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <UserAvatar username={user.username} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{user.username}</p>
          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
          }`}>
            <Shield size={8} />{user.role}
          </span>
        </div>
      </div>
      <div className="space-y-1.5 text-xs text-slate-500 mb-2.5">
        {user.email && (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 font-medium text-xs">@</span>
            <span className="truncate">{user.email}</span>
          </div>
        )}
        {user.employeeId && (
          <div className="flex items-center gap-1.5">
            <BadgeCheck size={11} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{user.employeeId}</span>
          </div>
        )}
        {user.unit && (
          <div className="flex items-center gap-1.5">
            <Building2 size={11} className="text-slate-400 flex-shrink-0" />
            <span className="truncate">{user.unit}</span>
          </div>
        )}
      </div>
      <button
        onClick={() => navigate(`/users/${user.username}`)}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 py-1.5 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        <ExternalLink size={11} />View full profile
      </button>
    </div>
  )
}

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  inputClassName?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export default function ParticipantInput({ value, onChange, placeholder, inputClassName, onKeyDown }: Props) {
  const [suggestions, setSuggestions] = useState<UserInfo[]>([])
  const [open, setOpen] = useState(false)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(searchTimerRef.current)
    const q = value.trim()
    if (!q) { setSuggestions([]); setOpen(false); return }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await userApi.search(q)
        setSuggestions(res.data)
        setOpen(res.data.length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 300)
    return () => clearTimeout(searchTimerRef.current)
  }, [value])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setHoveredIdx(null)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const select = (u: UserInfo) => {
    onChange(u.username)
    setOpen(false)
    setHoveredIdx(null)
  }

  const clearHide = () => clearTimeout(hideTimerRef.current)
  const scheduleHide = () => {
    hideTimerRef.current = setTimeout(() => setHoveredIdx(null), 120)
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
        onKeyDown={e => {
          if (e.key === 'Escape') { setOpen(false); setHoveredIdx(null) }
          onKeyDown?.(e)
        }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-40 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
          {suggestions.map((u, idx) => (
            <li
              key={u.username}
              className="relative"
              onMouseEnter={() => { clearHide(); setHoveredIdx(idx) }}
              onMouseLeave={scheduleHide}
            >
              <div
                className="flex items-center gap-2 px-3 py-2 hover:bg-indigo-50 cursor-pointer"
                onClick={() => select(u)}
              >
                <UserAvatar username={u.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-700 block truncate">{u.username}</span>
                  {u.employeeId && (
                    <span className="text-xs text-slate-400 block truncate">ID: {u.employeeId}</span>
                  )}
                </div>
                {u.unit && (
                  <span className="text-xs text-slate-400 truncate max-w-[90px]">{u.unit}</span>
                )}
              </div>

              {hoveredIdx === idx && (
                <MiniProfileCard
                  user={u}
                  onMouseEnter={clearHide}
                  onMouseLeave={scheduleHide}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
