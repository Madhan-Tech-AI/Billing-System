import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library'
import { CheckCircle, Camera, CameraOff, RefreshCcw } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Only accept 13-digit EAN-13 barcodes (supermarket standard) */
const EAN13_REGEX = /^[0-9]{13}$/

/** Number of consecutive identical reads required before accepting a scan */
const CONFIRM_FRAMES = 2

/** Minimum milliseconds between accepted scans (prevents duplicate inserts) */
const SCAN_COOLDOWN_MS = 800

// ─── Types ────────────────────────────────────────────────────────────────────

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  sessionId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BarcodeScanner({ onScan, sessionId }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<any>(null)

  // Confirmation accumulator: tracks consecutive reads of the same barcode
  const confirmBufferRef = useRef<{ code: string; count: number }>({ code: '', count: 0 })

  // Cooldown: timestamp of the last accepted scan
  const lastAcceptedRef = useRef<number>(0)

  // Debounce timer for success overlay reset
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(0) // 0-3 progress indicator

  // ─── Raw frame handler ──────────────────────────────────────────────────────

  const handleRawFrame = useCallback(
    (rawCode: string) => {
      // Step 1 — Validate: must be exactly 13 digits (EAN-13)
      if (!EAN13_REGEX.test(rawCode)) {
        console.debug('[Scanner] Ignored non-EAN13:', rawCode)
        return
      }

      // Step 2 — Multi-frame confirmation: same code must appear CONFIRM_FRAMES times
      const buf = confirmBufferRef.current
      if (rawCode === buf.code) {
        buf.count++
      } else {
        // Different code detected — reset buffer
        buf.code = rawCode
        buf.count = 1
      }

      // Update confirmation progress UI (1–3)
      setConfirming(buf.count)

      if (buf.count < CONFIRM_FRAMES) return

      // Step 3 — Cooldown: reject if same barcode within window
      const now = Date.now()
      if (now - lastAcceptedRef.current < SCAN_COOLDOWN_MS) return

      // ✅ Accepted scan
      lastAcceptedRef.current = now
      confirmBufferRef.current = { code: '', count: 0 }
      setConfirming(0)

      setLastScanned(rawCode)
      setShowSuccess(true)
      onScan(rawCode)

      if (navigator.vibrate) navigator.vibrate([100, 50, 100])

      if (successTimerRef.current) clearTimeout(successTimerRef.current)
      successTimerRef.current = setTimeout(() => {
        setShowSuccess(false)
      }, 1500)
    },
    [onScan]
  )

  // ─── Camera + ZXing reader setup ────────────────────────────────────────────

  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then(setCameras)
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!videoRef.current) return

    // Only EAN-13 format — eliminates partial reads (EAN-8, UPC, CODE128, etc.)
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13])
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints)
    setScanning(true)
    setError(null)

    // HD rear camera constraints for maximum decode accuracy
    const exactConstraints: MediaStreamConstraints = selectedCamera
      ? { video: { deviceId: { exact: selectedCamera } } }
      : {
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }

    const softConstraints: MediaStreamConstraints = selectedCamera
      ? { video: { deviceId: selectedCamera } }
      : {
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        }

    async function startScanning(cons: MediaStreamConstraints) {
      try {
        const controls = await reader.decodeFromConstraints(
          cons,
          videoRef.current!,
          (result, err) => {
            if (result) handleRawFrame(result.getText())
            if (err && !(err instanceof NotFoundException)) {
              // Suppress common "no barcode in frame" noise
            }
          }
        )
        controlsRef.current = controls

        // Re-fetch device list now that permission is granted (gets labels)
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        setCameras(devices)
      } catch (e: any) {
        // Retry once with softer constraints before showing error
        if (cons === exactConstraints) {
          startScanning(softConstraints)
          return
        }
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser.'
            : e.name === 'OverconstrainedError'
            ? 'No back camera found. Switch camera below.'
            : `Camera error: ${e.message}`
        )
        setScanning(false)
      }
    }

    startScanning(exactConstraints)

    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
      setScanning(false)
    }
  }, [selectedCamera, handleRawFrame])

  // ─── Switch camera ───────────────────────────────────────────────────────────

  function switchCamera() {
    const idx = cameras.findIndex((c) => c.deviceId === selectedCamera)
    const next = cameras[(idx + 1) % cameras.length]
    setSelectedCamera(next?.deviceId ?? null)
  }

  // ─── Confirmation dots UI ────────────────────────────────────────────────────

  function ConfirmDots() {
    return (
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {Array.from({ length: CONFIRM_FRAMES }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-150 ${
              i < confirming ? 'bg-amber-400 scale-110' : 'bg-surface-600'
            }`}
          />
        ))}
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center w-full h-full">
      {/* Session indicator */}
      <div className="text-xs font-mono text-surface-500 mb-2">
        Session: {sessionId.slice(0, 8)}...
      </div>

      {/* Camera view */}
      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border border-white/10">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Scanner overlay frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-48 h-32">
            {/* Corner brackets — wider aspect ratio suits EAN-13 */}
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-8 h-8 ${cls} ${
                  showSuccess ? 'border-emerald-400' : confirming > 0 ? 'border-amber-400' : 'border-primary-400'
                } transition-colors duration-200`}
              />
            ))}

            {/* Animated scan line */}
            {scanning && !showSuccess && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-primary-400 opacity-80 animate-scanner-line"
                style={{ boxShadow: '0 0 8px #38bdf8' }}
              />
            )}
          </div>
        </div>

        {/* Confirmation progress dots */}
        {confirming > 0 && !showSuccess && <ConfirmDots />}

        {/* Success flash overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center animate-fade-in">
            <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-lg" />
          </div>
        )}

        {/* Camera error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <CameraOff className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Initialising overlay */}
        {!scanning && !error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <Camera className="w-12 h-12 text-surface-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Camera switch */}
      <div className="mt-4 flex gap-3">
        {cameras.length > 1 && (
          <button
            id="switch-camera-btn"
            onClick={switchCamera}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 text-surface-300 hover:text-white hover:bg-surface-700 transition-all text-sm"
          >
            <RefreshCcw className="w-4 h-4" />
            Switch Camera
          </button>
        )}
      </div>

      {/* Last scanned barcode */}
      {lastScanned && (
        <div className="mt-4 w-full max-w-sm p-3 rounded-xl bg-surface-800/60 border border-white/10">
          <p className="text-xs text-surface-400 font-medium uppercase tracking-wider mb-1">Last Scanned</p>
          <p className="font-mono text-primary-300 font-semibold text-lg tracking-widest">{lastScanned}</p>
          {showSuccess && (
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Sent to billing terminal ✓
            </p>
          )}
        </div>
      )}

      {/* Hint text */}
      <p className="mt-3 text-xs text-surface-600 text-center max-w-xs">
        Hold barcode steady — scans after {CONFIRM_FRAMES} consecutive reads
      </p>
    </div>
  )
}
