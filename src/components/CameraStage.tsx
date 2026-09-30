import { type RefObject } from 'react';
import { Camera, CameraOff, FlipHorizontal2, LoaderCircle, SwitchCamera, Upload, X } from 'lucide-react';
import { type FilterId } from '../lib/photobooth';
import { effects, type EffectSettings } from '../lib/effects';
import { useLivePreview } from '../hooks/useLivePreview';

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>; status: 'off' | 'loading' | 'ready'; error: string;
  mirrored: boolean; filter: FilterId; effect: EffectSettings; ratio: number; canSwitch: boolean;
  busy: boolean; capturing: boolean; countdown: number | null; shot: number; count: number; flash: number;
  timer: number; retake: number | null; complete: boolean;
  onEnable: () => void; onClose: () => void; onSwitch: () => void; onMirror: () => void;
  onUpload: () => void; onCapture: () => void; onCancel: () => void; onClearRetake: () => void;
}
export function CameraStage(p: Props) {
  const { canvasRef, renderError } = useLivePreview(p.videoRef, p.status === 'ready', p.ratio, p.mirrored, p.filter, p.effect);

  return <section className="camera-column" aria-label="Camera workspace">
    <div className="intro"><h1>Make a moment<span>.</span></h1><p>Pick your frame. Strike a pose. Keep it.</p></div>
    <div className="camera-shell">
      <div className={`viewfinder ${p.status === 'ready' ? 'is-live' : ''}`}>
        <video ref={p.videoRef} autoPlay playsInline muted className="source-video" aria-hidden="true" />
        <canvas ref={canvasRef} className="live-canvas" style={{ aspectRatio: p.ratio }} aria-label="Live camera preview" hidden={p.status !== 'ready'} />
        <div className="viewfinder-corners" aria-hidden="true"><i /><i /><i /><i /></div>
        {p.status === 'ready' && p.effect.id !== 'none' && <span className="effect-badge">{effects.find(item => item.id === p.effect.id)?.name} · {p.effect.amount}%</span>}
        {p.status !== 'ready' && <div className="camera-empty">
          {p.status === 'loading' ? <LoaderCircle className="animate-spin camera-symbol" strokeWidth={1.1} /> : <Camera className="camera-symbol" strokeWidth={1.1} />}
          <h2>{p.status === 'loading' ? 'Finding your camera…' : p.error ? 'Let’s try another way.' : 'Camera’s off'}</h2>
          <p>{p.status === 'loading' ? 'Allow camera access in your browser to get started.' : p.error || 'Your next favorite photo starts here.'}</p>
          {p.status === 'loading' ? <button className="button secondary" onClick={p.onClose}>Cancel camera request</button> : <button className="button primary enable-button" onClick={p.onEnable} disabled={p.busy}>{p.error ? 'Try camera again' : 'Enable camera'}</button>}
          <button className="text-button" onClick={p.onUpload} disabled={p.busy}>Upload photos</button>
        </div>}
        {renderError && <p className="camera-render-error" role="alert">{renderError}</p>}
        {p.capturing && <div className="capture-overlay"><span className="shot-label">Shot {p.shot} of {p.count}</span>{p.countdown !== null && <strong key={`${p.shot}-${p.countdown}`} className="countdown">{p.countdown || 'Smile.'}</strong>}</div>}
        {p.flash > 0 && <div key={p.flash} className="shutter-flash" aria-hidden="true" />}
      </div>
      <div className="camera-toolbar">
        <span className="camera-status">{p.status === 'ready' ? <span className="live-dot" /> : <CameraOff size={14} />}<span>{p.status === 'ready' ? 'Live view' : p.status === 'loading' ? 'Connecting' : 'Camera off'}</span></span>
        <div className="flex items-center gap-1">
          <button className="toolbar-button" onClick={p.onMirror} aria-label="Mirror camera" aria-pressed={p.mirrored} disabled={p.busy} title="Mirror camera"><FlipHorizontal2 size={17} /><span>Mirror</span></button>
          <button className="toolbar-button" onClick={p.onSwitch} aria-label="Switch camera" disabled={!p.canSwitch || p.status !== 'ready' || p.busy} title={p.canSwitch ? 'Switch camera' : 'A second camera is not available'}><SwitchCamera size={18} /></button>
          <button className="toolbar-button" onClick={p.onClose} aria-label="Close camera" disabled={p.status === 'off'} title="Close camera"><X size={18} /></button>
        </div>
      </div>
    </div>
    <div className="capture-controls">
      <div className="capture-caption">
        <p aria-live="polite">{p.capturing ? `Shot ${p.shot} of ${p.count} · Tap to cancel` : p.retake !== null ? `Retaking photo ${p.retake + 1}` : p.complete ? 'Looking good. Make it yours.' : `${p.count} photos · ${p.timer ? `${p.timer}s timer` : 'no timer'}`}</p>
        {p.retake !== null && !p.capturing && <button onClick={p.onClearRetake} className="cancel-retake">Cancel retake</button>}
      </div>
      {p.capturing ? <button className="shutter cancel-shutter" onClick={p.onCancel} aria-label="Cancel capture session"><span /></button> : <button className="shutter" aria-label={p.retake !== null ? `Retake photo ${p.retake + 1}` : 'Start photo session'} disabled={p.status !== 'ready' || p.busy || (p.complete && p.retake === null) || !!renderError} onClick={p.onCapture}><span /></button>}
      <button className="upload-control" onClick={p.onUpload} disabled={p.busy || (p.complete && p.retake === null)}><Upload size={16} />{p.retake !== null ? 'Upload replacement' : 'Upload photos'}</button>
    </div>
  </section>;
}
