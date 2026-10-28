import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, CheckCircle, X, AlertCircle } from 'lucide-react';

export default function SelfieCaptureModal({ isOpen, onClose, onCaptured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [useFileFallback, setUseFileFallback] = useState(false);

  useEffect(() => {
    if (isOpen && !useFileFallback) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, useFileFallback]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      setCameraError(err.message || 'Could not access web camera. You may use manual photo upload.');
      setUseFileFallback(true);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      }
    }, 'image/jpeg', 0.85);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCapturedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRetake = () => {
    setCapturedBlob(null);
    setPreviewUrl(null);
    if (!useFileFallback) {
      startCamera();
    }
  };

  const handleConfirm = () => {
    if (capturedBlob) {
      onCaptured(capturedBlob);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            <Camera size={20} color="var(--forest-green)" />
            Student Selfie Verification
          </h3>
          <button onClick={onClose} style={{ background: 'transparent' }}><X size={20} /></button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Capture a real-time face photo to link with this BLE attendance session for teacher verification.
        </p>

        {previewUrl ? (
          <div>
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border-cream)', marginBottom: '1rem' }}>
              <img src={previewUrl} alt="Captured Selfie" style={{ width: '100%', height: '280px', objectFit: 'cover' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleRetake}>
                <RefreshCw size={16} /> Retake
              </button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                <CheckCircle size={16} /> Confirm & Attach
              </button>
            </div>
          </div>
        ) : useFileFallback ? (
          <div>
            {cameraError && (
              <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--warning-text)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={18} />
                <span>{cameraError}</span>
              </div>
            )}
            <div style={{ border: '2px dashed var(--border-cream)', borderRadius: 'var(--radius-md)', padding: '2rem 1rem', background: 'var(--bg-cream)', marginBottom: '1rem' }}>
              <Camera size={36} color="var(--forest-green)" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Upload Student Photo</div>
              <input type="file" accept="image/*" capture="user" onChange={handleFileUpload} />
            </div>
            <button className="btn btn-secondary" onClick={() => setUseFileFallback(false)}>
              Retry Live Camera
            </button>
          </div>
        ) : (
          <div>
            <div style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: '#000', marginBottom: '1rem', height: '280px' }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: '15px', border: '2px dashed rgba(255,255,255,0.4)', borderRadius: '50%', pointerEvents: 'none' }} />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={takeSnapshot} style={{ width: '100%' }}>
                <Camera size={18} /> Capture Photo
              </button>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <button onClick={() => setUseFileFallback(true)} style={{ background: 'transparent', fontSize: '0.78rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                Having camera issues? Switch to photo file upload
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
