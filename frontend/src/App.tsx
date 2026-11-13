import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicLayout from './components/PublicLayout'
import Layout from './components/Layout'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DocumentsPage from './pages/DocumentsPage'
import KeyGroupsPage from './pages/KeyGroupsPage'
import KeyGroupDetailPage from './pages/KeyGroupDetailPage'
import RequestsPage from './pages/RequestsPage'
import RequestDetailPage from './pages/RequestDetailPage'
import SignaturePositionPage from './pages/SignaturePositionPage'
import PendingPage from './pages/PendingPage'
import VerifyPage from './pages/VerifyPage'
import AuditLogPage from './pages/AuditLogPage'
import ProfilePage from './pages/ProfilePage'
import UserProfilePage from './pages/UserProfilePage'

function AppRoutes() {
  const location = useLocation()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Public verify — no login required */}
      <Route
        path="/verify"
        element={
          <PublicLayout>
            <VerifyPage />
          </PublicLayout>
        }
      />

      {/* Protected routes with sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/key-groups" element={<KeyGroupsPage />} />
        <Route path="/key-groups/:groupId" element={<KeyGroupDetailPage />} />
        <Route path="/requests" element={<RequestsPage key={location.key} />} />
        <Route path="/requests/:requestId" element={<RequestDetailPage />} />
        <Route path="/requests/:requestId/sign-position" element={<SignaturePositionPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/audit-logs" element={<AuditLogPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/users/:username" element={<UserProfilePage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
