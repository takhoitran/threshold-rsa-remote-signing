import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as pdfjsLib from 'pdfjs-dist'
import { signingApi, documentApi } from '../api/client'
import type { SigningRequestDto, SignaturePosition } from '../api/client'
import {
  Loader, AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Move, Combine, ArrowLeft
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

type SignatureDisplayType = 'name' | 'id'

interface SigBox {
  xPct: number
  yPct: number
  widthPct: number
  heightPct: number
}

const DEFAULT_BOX: SigBox = { xPct: 5, yPct: 79, widthPct: 42, heightPct: 9 }

export default function SignaturePositionPage() {
  const { requestId } = useParams<{ requestId: string }>()
  const navigate = useNavigate()

  const [req, setReq] = useState<SigningRequestDto | null>(null)
  const [loadingReq, setLoadingReq] = useState(true)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [combining, setCombining] = useState(false)
  const [error, setError] = useState('')

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [numPages, setNumPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [canvasReady, setCanvasReady] = useState(false)

  const [sigBox, setSigBox] = useState<SigBox>(DEFAULT_BOX)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [signatureDisplayType, setSignatureDisplayType] = useState<SignatureDisplayType>('name')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)

  // Load signing request
  useEffect(() => {
    if (!requestId) return
    signingApi.get(requestId)
      .then(r => {
        if (r.data.status !== 'READY_TO_COMBINE') {
          navigate(`/requests/${requestId}`, { replace: true })
          return
        }
        setReq(r.data)
      })
      .catch(() => setError('Signing request not found'))
      .finally(() => setLoadingReq(false))
  }, [requestId, navigate])

  // Load PDF content when request is ready
  useEffect(() => {
    if (!req) return
    setLoadingPdf(true)
    documentApi.getContent(req.documentId)
      .then(async r => {
        const b64 = r.data.contentBase64
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
        const doc = await pdfjsLib.getDocument({ data: bytes }).promise
        setPdfDoc(doc)
        setNumPages(doc.numPages)
      })
      .catch(() => setError('Failed to load document content'))
      .finally(() => setLoadingPdf(false))
  }, [req])

  // Render PDF page whenever pdfDoc or currentPage changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current) return
    setCanvasReady(false)

    const render = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
      }
      const page = await pdfDoc.getPage(currentPage)
      const containerWidth = containerRef.current!.clientWidth || 600
      const viewport1 = page.getViewport({ scale: 1 })
      const scale = containerWidth / viewport1.width
      const viewport = page.getViewport({ scale })

      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height

      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx, viewport, canvas: canvas })
      renderTaskRef.current = task
      try {
        await task.promise
        setCanvasReady(true)
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          setError('PDF render error')
        }
      }
    }
    render()
  }, [pdfDoc, currentPage])

  // Global mouse move + up for drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const boxW = (sigBox.widthPct / 100) * rect.width
    const boxH = (sigBox.heightPct / 100) * rect.height
    let x = e.clientX - rect.left - dragOffset.x
    let y = e.clientY - rect.top - dragOffset.y
    x = Math.max(0, Math.min(x, rect.width - boxW))
    y = Math.max(0, Math.min(y, rect.height - boxH))
    setSigBox(prev => ({ ...prev, xPct: (x / rect.width) * 100, yPct: (y / rect.height) * 100 }))
  }, [isDragging, dragOffset, sigBox.widthPct, sigBox.heightPct])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleBoxMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!overlayRef.current) return
    const rect = overlayRef.current.getBoundingClientRect()
    const boxLeft = (sigBox.xPct / 100) * rect.width
    const boxTop = (sigBox.yPct / 100) * rect.height
    setDragOffset({ x: e.clientX - rect.left - boxLeft, y: e.clientY - rect.top - boxTop })
    setIsDragging(true)
  }

  const handleCombine = async () => {
    if (!requestId) return
    setCombining(true)
    setError('')
    const position: SignaturePosition = {
      page: currentPage,
      xPct: parseFloat(sigBox.xPct.toFixed(2)),
      yPct: parseFloat(sigBox.yPct.toFixed(2)),
      widthPct: parseFloat(sigBox.widthPct.toFixed(2)),
      heightPct: parseFloat(sigBox.heightPct.toFixed(2)),
      signatureDisplayType,
    }
    try {
      await signingApi.combine(requestId, position)
      navigate(`/requests/${requestId}`)
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data || 'Combine failed')
      setCombining(false)
    }
  }

  if (loadingReq) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-slate-400">
        <Loader size={20} className="animate-spin mr-2" /> Loading...
      </div>
    )
  }

  if (!req) {
    return (
      <div className="p-8 text-red-500">
        <AlertCircle size={16} className="inline mr-2" />
        {error || 'Signing request not found'}
      </div>
    )
  }

  const signers = req.signedParticipantIds ?? []
  const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-5">
        <button
          onClick={() => navigate(`/requests/${requestId}`)}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Select Signature Position</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            {req.documentName || req.documentId} — Drag the signature box to the desired location
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg mb-4">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* PDF preview area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Page controls */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <span className="text-xs font-medium text-slate-600">Document Preview</span>
              {numPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-slate-600">
                    Page {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    disabled={currentPage === numPages}
                    className="p-1 rounded text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Canvas + overlay */}
            <div
              ref={containerRef}
              className="relative bg-slate-200"
              style={{ userSelect: 'none' }}
            >
              {(loadingPdf || !canvasReady) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <Loader size={24} className="animate-spin text-indigo-500" />
                </div>
              )}

              <canvas ref={canvasRef} className="block w-full" />

              {/* Transparent overlay for drag interaction */}
              {canvasReady && (
                <div
                  ref={overlayRef}
                  className="absolute inset-0"
                  style={{ cursor: isDragging ? 'grabbing' : 'default' }}
                >
                  {/* Signature box */}
                  <div
                    onMouseDown={handleBoxMouseDown}
                    style={{
                      position: 'absolute',
                      left: `${sigBox.xPct}%`,
                      top: `${sigBox.yPct}%`,
                      width: `${sigBox.widthPct}%`,
                      height: `${sigBox.heightPct}%`,
                      cursor: isDragging ? 'grabbing' : 'grab',
                    }}
                    className="border-2 border-indigo-500 bg-indigo-100/40 rounded flex flex-col items-center justify-center gap-0.5 shadow-md hover:bg-indigo-100/60 transition-colors"
                  >
                    <Move size={12} className="text-indigo-600 opacity-70" />
                    <span className="text-[9px] font-bold text-indigo-700 text-center leading-tight px-1">
                      MPC Threshold Signature
                    </span>
                    <span className="text-[8px] text-indigo-500 text-center leading-tight px-1">
                      {signatureDisplayType === 'name'
                        ? signers.join(', ')
                        : (req.signedParticipantDisplayIds ?? signers).join(', ')}
                    </span>
                    <span className="text-[7px] text-indigo-400 text-center leading-tight px-1">
                      {now}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {numPages > 1 && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Signature will be placed on page <strong>{currentPage}</strong>
            </p>
          )}
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
          {/* Signature display type */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Signature Display</h2>
            <p className="text-xs text-slate-400 mb-3">Choose what is shown on the signature block</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sigDisplay"
                  value="name"
                  checked={signatureDisplayType === 'name'}
                  onChange={() => setSignatureDisplayType('name')}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">Display Name</p>
                  <p className="text-[11px] text-slate-400">Shows username of each signer</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="sigDisplay"
                  value="id"
                  checked={signatureDisplayType === 'id'}
                  onChange={() => setSignatureDisplayType('id')}
                  className="accent-indigo-600"
                />
                <div>
                  <p className="text-xs font-medium text-slate-700">Display Employee ID</p>
                  <p className="text-[11px] text-slate-400">Shows employee ID of each signer</p>
                </div>
              </label>
            </div>
          </div>

          {/* Signature info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Signature Info</h2>
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-700 space-y-1">
              <p className="font-semibold">MPC Threshold Signature</p>
              <p>{req.threshold}-of-{req.participantIds.length} signatures</p>
              <p>Signers: {signers.join(', ')}</p>
              <p>Timestamp: {now}</p>
            </div>
          </div>

          {/* Position info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Signature Position</h2>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Page</span>
                <span className="font-medium">{currentPage}</span>
              </div>
              <div className="flex justify-between">
                <span>X (from left)</span>
                <span className="font-medium">{sigBox.xPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Y (from top)</span>
                <span className="font-medium">{sigBox.yPct.toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-3">
              Drag the blue box on the PDF to reposition
            </p>
          </div>

          {/* Participants who signed */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Signed by</h2>
            <div className="space-y-1.5">
              {signers.map(s => (
                <div key={s} className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-green-500 flex-shrink-0" />
                  <span className="text-xs text-slate-700">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleCombine}
            disabled={combining || !canvasReady}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            {combining ? <Loader size={15} className="animate-spin" /> : <Combine size={15} />}
            {combining ? 'Processing...' : 'Confirm & Finalize Signature'}
          </button>

          <button
            onClick={() => navigate(`/requests/${requestId}`)}
            disabled={combining}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <ArrowLeft size={15} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
