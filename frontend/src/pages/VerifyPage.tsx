import { useRef, useState } from 'react'
import { signingApi } from '../api/client'
import type { SignerInfo } from '../api/client'
import { ShieldCheck, ShieldX, Loader, Upload, FileText, X, BadgeCheck, Building2, Users } from 'lucide-react'

export default function VerifyPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ valid: boolean; message: string; signers: SignerInfo[] } | null>(null)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setSelectedFile(file)
    setResult(null)
    setError('')
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      setResult(null)
      setError('')
    } else {
      setError('Only PDF files are accepted')
    }
  }

  const handleVerify = async () => {
    if (!selectedFile) return
    setError('')
    setResult(null)
    setLoading(true)
    try {
      const res = await signingApi.verifyPdf(selectedFile)
      setResult(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setResult(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Verify Signature</h1>
        <p className="text-slate-500 text-sm mt-1">Upload a signed PDF document to verify the digital signature</p>
      </div>

      {/* Drop zone */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            selectedFile
              ? 'border-indigo-300 bg-indigo-50 cursor-default'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 cursor-pointer'
          }`}
        >
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={28} className="text-indigo-500 flex-shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{selectedFile.name}</p>
                <p className="text-xs text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); clearFile() }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={32} className="text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">Drag & drop a PDF here or click to select</p>
              <p className="text-xs text-slate-400 mt-1">Only digitally signed PDF files are supported</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        <button
          onClick={handleVerify}
          disabled={loading || !selectedFile}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          {loading ? <Loader size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {loading ? 'Verifying...' : 'Verify Signature'}
        </button>
      </div>

      {result && (
        <div className={`rounded-xl border p-6 ${result.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3 mb-4">
            {result.valid
              ? <ShieldCheck size={32} className="text-green-600" />
              : <ShieldX size={32} className="text-red-600" />
            }
            <div>
              <p className={`text-lg font-bold ${result.valid ? 'text-green-800' : 'text-red-800'}`}>
                {result.valid ? 'Chữ ký HỢP LỆ ✓' : 'Chữ ký KHÔNG HỢP LỆ ✗'}
              </p>
              <p className={`text-sm ${result.valid ? 'text-green-700' : 'text-red-700'}`}>{result.message}</p>
            </div>
          </div>

          {result.signers.length > 0 && (
            <div className="border-t border-green-200 pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
                <Users size={13} />
                <span>Người đã ký ({result.signers.length})</span>
              </div>
              <div className="space-y-2">
                {result.signers.map((s) => (
                  <div key={s.username} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2.5 border border-slate-100">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {s.username[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">{s.username}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                        {s.employeeId && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <BadgeCheck size={11} className="text-slate-400" />
                            {s.employeeId}
                          </span>
                        )}
                        {s.unit && (
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Building2 size={11} className="text-slate-400" />
                            {s.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification info */}
      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-700 mb-2">Verification Method (RSA Threshold)</p>
        <p className="font-mono bg-white border border-slate-200 px-3 py-2 rounded text-xs mb-2">
          sig<sup>e</sup> mod n == SHA-256(document) mod n
        </p>
        <ul className="list-disc list-inside space-y-1 text-slate-500 text-xs">
          <li>Reads CMS/PKCS#7 signature embedded in the PDF</li>
          <li>Verifies the integrity of the digital signature</li>
          <li>Checks the attached certificate</li>
        </ul>
      </div>
    </div>
  )
}
