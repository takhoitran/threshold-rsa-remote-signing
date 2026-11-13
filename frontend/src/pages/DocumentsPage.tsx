import { useEffect, useState, useRef } from 'react'
import { documentApi } from '../api/client'
import type { DocumentDto } from '../api/client'
import { Upload, FileText, Hash, Calendar, Loader, AlertCircle, CheckCircle } from 'lucide-react'

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentDto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchDocs = () => {
    documentApi.list().then((r) => setDocs(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setMessage(null)
    try {
      await documentApi.upload(file)
      setMessage({ type: 'success', text: `"${file.name}" uploaded successfully` })
      fetchDocs()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Upload failed' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
          <p className="text-slate-500 text-sm mt-1">Manage PDF documents for signing</p>
        </div>
        <label className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}>
          {uploading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
          {uploading ? 'Uploading...' : 'Upload PDF'}
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {message && (
        <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {message.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader size={20} className="animate-spin mr-2" />Loading...
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <FileText size={40} className="mb-3 text-slate-300" />
            <p className="text-sm">No documents yet. Upload your first PDF.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="text-left px-6 py-3">ID</th>
                <th className="text-left px-6 py-3">File Name</th>
                <th className="text-left px-6 py-3">SHA-256 Hash</th>
                <th className="text-left px-6 py-3">Uploaded At</th>
                <th className="text-left px-6 py-3">Uploaded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs text-slate-400 font-mono">{doc.id.substring(0, 8)}...</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={15} className="text-indigo-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700">{doc.originalFileName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Hash size={13} className="text-slate-400" />
                      <code className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded">
                        {doc.hashBase64.substring(0, 24)}...
                      </code>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar size={13} />
                      {new Date(doc.uploadedAt).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{doc.uploadedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
