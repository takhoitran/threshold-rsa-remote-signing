import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('jwt')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('jwt')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  register: (data: { username: string; email: string; password: string; signingPin: string; employeeId: string; unit: string }) =>
    api.post('/auth/register', data),
  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; username: string; role: string }>('/auth/login', data),
  me: () => api.get<UserInfo>('/auth/me'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.put<string>('/auth/change-password', data),
  changeSigningPin: (data: { currentPin: string; newPin: string }) =>
    api.put<string>('/auth/change-signing-pin', data),
}

// ── Documents ─────────────────────────────────────────
export const documentApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<DocumentDto>('/remote-signing/documents/upload', form)
  },
  list: () => api.get<DocumentDto[]>('/remote-signing/documents'),
  getContent: (documentId: string) =>
    api.get<{ contentBase64: string }>(`/remote-signing/documents/${documentId}/content`),
}

// ── Key Groups ────────────────────────────────────────
export const keyGroupApi = {
  list: () => api.get<KeyGroupDto[]>('/remote-signing/keys/groups'),
  create: (data: { threshold: number; participantIds: string[] }) =>
    api.post<KeyGroupDto>('/remote-signing/keys/groups', data),
  get: (groupId: string) =>
    api.get<KeyGroupDto>(`/remote-signing/keys/groups/${groupId}`),
  getShare: (groupId: string, participantId: string) =>
    api.get<{ participantId: string; shareEncoded: string; groupId: string; x: number }>(
      `/remote-signing/keys/groups/${groupId}/participants/${participantId}/share`
    ),
  addParticipant: (groupId: string, participantId: string) =>
    api.post<KeyGroupDto>(`/remote-signing/keys/groups/${groupId}/participants`, { participantId }),
  removeParticipant: (groupId: string, participantId: string) =>
    api.delete<KeyGroupDto>(`/remote-signing/keys/groups/${groupId}/participants/${participantId}`),
  delete: (groupId: string) =>
    api.delete(`/remote-signing/keys/groups/${groupId}`),
}

// ── Signing Requests ──────────────────────────────────
export const signingApi = {
  create: (data: {
    documentId: string
    threshold: number
    participantIds: string[]
    keyGroupId?: string
    signingOrders?: Record<string, number>
    metadata?: Record<string, unknown>
  }) => api.post<SigningRequestDto>('/remote-signing/requests', data),
  list: () => api.get<SigningRequestDto[]>('/remote-signing/requests'),
  pending: () => api.get<SigningRequestDto[]>('/remote-signing/requests/pending'),
  get: (id: string) => api.get<SigningRequestDto>(`/remote-signing/requests/${id}`),
  partialSign: (id: string, data: { participantId: string; partialSignatureBase64: string; confirmOtp: string }) =>
    api.post(`/remote-signing/requests/${id}/partial-sign`, data),
  combine: (id: string, position?: SignaturePosition) =>
    api.post<SigningRequestDto>(`/remote-signing/requests/${id}/combine`, position ?? null),
  verifyPdf: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ valid: boolean; message: string; signers: SignerInfo[] }>('/remote-signing/verify-pdf', form)
  },
  downloadSignedPdf: (requestId: string) =>
    api.get<Blob>(`/remote-signing/requests/${requestId}/signed-pdf`, { responseType: 'blob' }),
}

// ── Notifications ─────────────────────────────────────
export const notificationApi = {
  list: () => api.get<NotificationDto[]>('/remote-signing/notifications'),
  unreadCount: () => api.get<{ count: number }>('/remote-signing/notifications/unread-count'),
  markRead: (id: string) => api.put(`/remote-signing/notifications/${id}/read`),
  markAllRead: () => api.put('/remote-signing/notifications/read-all'),
}

// ── Audit Logs ────────────────────────────────────────
export const auditApi = {
  list: () => api.get<AuditLogDto[]>('/remote-signing/audit-logs'),
}

// ── Users ─────────────────────────────────────────────
export const userApi = {
  search: (q: string) => api.get<UserInfo[]>(`/auth/users/search?q=${encodeURIComponent(q)}`),
  getProfile: (username: string) => api.get<UserInfo>(`/auth/users/${encodeURIComponent(username)}`),
}

// ── Types ─────────────────────────────────────────────
export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  employeeId?: string
  unit?: string
  createdAt?: string
}

export interface SignerInfo {
  username: string
  employeeId?: string
  unit?: string
}

export interface SignaturePosition {
  page?: number
  xPct?: number
  yPct?: number
  widthPct?: number
  heightPct?: number
  signatureDisplayType?: 'name' | 'id'
}

// ── DTOs ──────────────────────────────────────────────
export interface DocumentDto {
  id: string
  originalFileName: string
  hashBase64: string
  uploadedAt: string
  uploadedBy: string
}

export interface KeyGroupDto {
  groupId: string
  threshold: number
  totalParticipants: number
  version: number
  participantIds: string[]
  rsaModulusHex: string
  rsaPublicExponentHex: string
}

export interface SigningRequestDto {
  requestId: string
  documentId: string
  documentName: string
  threshold: number
  participantIds: string[]
  signedParticipantIds: string[]
  status: 'WAITING_PARTIALS' | 'READY_TO_COMBINE' | 'SIGNED'
  finalSignatureBase64?: string
  signedPdfBase64?: string
  keyGroupId?: string
  createdBy: string
  createdAt: string
  documentHashBase64?: string
  rsaModulusHex?: string
  // participantId -> order number (1-based). Empty = no ordering.
  signingOrders: Record<string, number>
  // participants who can sign right now
  currentSignerIds: string[]
  // employee IDs for each signed participant (same order as signedParticipantIds)
  signedParticipantDisplayIds?: string[]
}

export interface NotificationDto {
  id: string
  message: string
  signingRequestId: string
  read: boolean
  createdAt: string
}

export interface AuditLogDto {
  id: string
  timestamp: string
  action: string
  detail: string
  username: string
}
