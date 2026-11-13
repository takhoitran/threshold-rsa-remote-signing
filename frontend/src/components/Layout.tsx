import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useRef, useState } from 'react'
import { notificationApi } from '../api/client'
import type { NotificationDto } from '../api/client'
import {
  LayoutDashboard, FileText, Key, ClipboardList,
  Clock, ShieldCheck, ScrollText, LogOut, FileSignature, Bell, UserCircle
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/key-groups', icon: Key, label: 'Key Groups' },
  { to: '/requests', icon: ClipboardList, label: 'Signing Requests' },
  { to: '/pending', icon: Clock, label: 'Pending Signatures' },
  { to: '/verify', icon: ShieldCheck, label: 'Verify' },
  { to: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
  { to: '/profile', icon: UserCircle, label: 'My Profile' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const unreadCount = notifications.filter((n) => !n.read).length

  const fetchNotifications = () => {
    notificationApi.list().then((r) => setNotifications(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 15000)
    return () => clearInterval(interval)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleBellClick = () => {
    setShowDropdown((v) => !v)
  }

  const handleMarkRead = async (n: NotificationDto) => {
    if (!n.read) {
      await notificationApi.markRead(n.id)
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x))
    }
    if (n.signingRequestId) {
      setShowDropdown(false)
      navigate(`/requests/${n.signingRequestId}`)
    }
  }

  const handleMarkAllRead = async () => {
    await notificationApi.markAllRead()
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileSignature className="text-indigo-600" size={22} />
            <div>
              <p className="font-semibold text-slate-800 text-sm leading-tight">MPC Sign</p>
              <p className="text-xs text-slate-400">Remote Signing Platform</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{user?.username}</p>
              <p className="text-xs text-slate-400">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with notification bell */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-end">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleBellClick}
              className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl border border-slate-200 shadow-lg z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-sm font-semibold text-slate-800">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleMarkRead(n)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${!n.read ? 'bg-indigo-50/40' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          {!n.read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          )}
                          <div className={!n.read ? '' : 'ml-4'}>
                            <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {new Date(n.createdAt).toLocaleString('en-US')}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
