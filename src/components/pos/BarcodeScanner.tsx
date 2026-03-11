import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { CheckCircle, Camera, CameraOff, RefreshCcw } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  sessionId: string
}

export function BarcodeScanner({ onScan, sessionId }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<any>(null)
  const lastScannedRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)

  const handleDecode = useCallback(
    (barcode: string) => {
      if (barcode === lastScannedRef.current) return

      lastScannedRef.current = barcode
      setLastScanned(barcode)
      setShowSuccess(true)
      onScan(barcode)

      if (navigator.vibrate) navigator.vibrate([100, 50, 100])

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        lastScannedRef.current = ''
        setShowSuccess(false)
      }, 1500)
    },
    [onScan]
  )

  useEffect(() => {
    // Initial device list (might be empty labels before permission)
    BrowserMultiFormatReader.listVideoInputDevices().then((devices) => {
      setCameras(devices)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!videoRef.current) return

    // Configure hints for 1D barcodes and better sensitivity
    const hints = new Map()
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF
    ]
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
    hints.set(DecodeHintType.TRY_HARDER, true)

    const reader = new BrowserMultiFormatReader(hints)
    setScanning(true)
    setError(null)

    // Use environment camera by default if no specific camera selected
    const constraints: MediaStreamConstraints = selectedCamera
      ? { video: { deviceId: selectedCamera } }
      : { video: { facingMode: { exact: 'environment' } } }

    // Fallback constraints if 'exact' environment fails (some browsers/devices)
    const fallbackConstraints: MediaStreamConstraints = selectedCamera
      ? { video: { deviceId: selectedCamera } }
      : { video: { facingMode: 'environment' } }

    async function startScanning(cons: MediaStreamConstraints) {
      try {
        const controls = await reader.decodeFromConstraints(cons, videoRef.current!, (result, err) => {
          if (result) {
            handleDecode(result.getText())
          }
          if (err && !(err instanceof NotFoundException)) {
            // Ignore common scan errors
          }
        })
        controlsRef.current = controls

        // Now that permission is granted, refresh camera list to get labels
        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        setCameras(devices)
      } catch (e: any) {
        if (cons === constraints && !selectedCamera) {
          // Try fallback without 'exact'
          startScanning(fallbackConstraints)
          return
        }
        setError(
          e.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access.'
            : e.name === 'OverconstrainedError' 
            ? 'No back camera found. Trying default camera...'
            : `Camera error: ${e.message}`
        )
        setScanning(false)
      }
    }

    startScanning(constraints)

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
      setScanning(false)
    }
  }, [selectedCamera, handleDecode])

  function switchCamera() {
    const idx = cameras.findIndex((c) => c.deviceId === selectedCamera)
    const next = cameras[(idx + 1) % cameras.length]
    setSelectedCamera(next.deviceId)
  }

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

        {/* Scanner overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-48 h-48">
            {/* Corner brackets */}
            {[
              'top-0 left-0 border-t-4 border-l-4 rounded-tl-lg',
              'top-0 right-0 border-t-4 border-r-4 rounded-tr-lg',
              'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg',
              'bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg',
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-8 h-8 ${cls} ${showSuccess ? 'border-emerald-400' : 'border-primary-400'} transition-colors duration-300`}
              />
            ))}

            {/* Scan line */}
            {scanning && !showSuccess && (
              <div
                className="absolute left-0 right-0 h-0.5 bg-primary-400 opacity-80 animate-scanner-line"
                style={{ boxShadow: '0 0 8px #38bdf8' }}
              />
            )}
          </div>
        </div>

        {/* Success overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center animate-fade-in">
            <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-lg" />
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3 p-4 text-center">
            <CameraOff className="w-10 h-10 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!scanning && !error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <Camera className="w-12 h-12 text-surface-500 animate-pulse" />
          </div>
        )}
      </div>

      {/* Controls */}
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

      {/* Last scanned */}
      {lastScanned && (
        <div className="mt-4 w-full max-w-sm p-3 rounded-xl bg-surface-800/60 border border-white/10">
          <p className="text-xs text-surface-400 font-medium uppercase tracking-wider mb-1">Last Scanned</p>
          <p className="font-mono text-primary-300 font-semibold">{lastScanned}</p>
          {showSuccess && (
            <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> Item added to cart ✓
            </p>
          )}
        </div>
      )}
    </div>
  )
}
