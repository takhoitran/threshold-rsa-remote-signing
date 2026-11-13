import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FileSignature, LayoutDashboard, LogIn } from 'lucide-react'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature className="text-indigo-600" size={20} />
          <span className="font-semibold text-slate-800 text-sm">MPC Sign</span>
          <span className="text-slate-300 text-xs ml-1">Remote Signing Platform</span>
        </div>
        {user ? (
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <LayoutDashboard size={15} />
            Về Dashboard
          </Link>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            <LogIn size={14} />
            Đăng nhập
          </Link>
        )}
      </header>
      <main className="flex-1 flex justify-center pt-8 px-4">
        {children}
      </main>
    </div>
  )
}
