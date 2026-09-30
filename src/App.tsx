import { useCallback, useEffect, useRef, useState } from 'react';
import { Aperture, Info, Volume2, VolumeX, X } from 'lucide-react';
import { CameraStage } from './components/CameraStage';
import { SettingsPanel } from './components/SettingsPanel';
import { StripPanel } from './components/StripPanel';
import { Modal } from './components/Modal';
import { useCamera } from './hooks/useCamera';
import { abortableDelay, defaultFrame, importPhoto, layouts, imageFromCanvas, type FilterId, type FrameSettings, type LayoutId, type Photo } from './lib/photobooth';
import { defaultEffect, type EffectSettings } from './lib/effects';

export default function App() {
  const [layoutId, setLayoutId] = useState<LayoutId>('strip3');
  const [timer, setTimer] = useState(3);
  const [filter, setFilter] = useState<FilterId>('original');
  const [effect, setEffect] = useState<EffectSettings>(defaultEffect);
  const [frame, setFrame] = useState<FrameSettings>(defaultFrame);
  const [photos, setPhotos] = useState<(Photo | null)[]>([null, null, null]);
  const [date, setDate] = useState(() => new Date());
  const [mirrored, setMirrored] = useState(true);
  const [sound, setSound] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [shot, setShot] = useState(0);
  const [flash, setFlash] = useState(0);
  const [retake, setRetake] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [help, setHelp] = useState(false);
  const [confirmation, setConfirmation] = useState<LayoutId | 'new' | null>(null);
  const camera = useCamera();
  const layout = layouts.find(item => item.id === layoutId)!;
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadIndex = useRef<number | null>(null);
  const importingRef = useRef(false);
  const mounted = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const busy = capturing || importing;
  const complete = photos.every(Boolean);

  const cancel = useCallback(() => { abortRef.current?.abort(); }, []);
  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => { if (document.hidden) cancel(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { mounted.current = false; cancel(); void audioRef.current?.close(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [cancel]);
  useEffect(() => { if (camera.status !== 'ready') cancel(); }, [camera.status, cancel]);

  function prepareAudio() {
    try {
      if (!audioRef.current || audioRef.current.state === 'closed') audioRef.current = new AudioContext();
      void audioRef.current.resume().catch(() => {});
    } catch { /* Silent capture remains available when Web Audio is unsupported. */ }
  }
  function playShutter() {
    const ctx = audioRef.current;
    if (!sound || !ctx || ctx.state !== 'running') return;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(780, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + .065);
    gain.gain.setValueAtTime(.08, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .09);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + .1);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  async function capture() {
    if (abortRef.current || importingRef.current || camera.status !== 'ready' || (complete && retake === null)) return;
    if (sound) prepareAudio();
    const controller = new AbortController(); abortRef.current = controller;
    setCapturing(true); setMessage('');
    const indices = retake !== null ? [retake] : photos.flatMap((photo, i) => photo ? [] : [i]);
    try {
      for (const index of indices) {
        setShot(index + 1);
        for (let value = timer; value > 0; value--) { setCountdown(value); await abortableDelay(1000, controller.signal); }
        setCountdown(0);
        if (controller.signal.aborted) break;
        const video = camera.videoRef.current;
        if (!video?.videoWidth || video.readyState < 2) throw new Error('The camera isn’t ready. Enable it again and try another take.');
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 2400 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Your browser couldn’t capture the photo. Try uploading a photo.');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const takenAt = new Date();
        const photo = { image: await imageFromCanvas(canvas), mirrored, takenAt };
        if (controller.signal.aborted || !mounted.current) break;
        setPhotos(previous => previous.map((current, i) => i === index ? photo : current));
        setFlash(previous => previous + 1); playShutter();
        await abortableDelay(timer === 0 ? 1000 : 500, controller.signal);
      }
      if (!controller.signal.aborted) { setRetake(null); setMessage('A moment, kept. Add your finishing touches.'); }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setMessage(e instanceof Error ? e.message : 'Capture failed. Please try again.');
    } finally {
      if (mounted.current) { setCapturing(false); setCountdown(null); if (controller.signal.aborted) setMessage('Session paused. Your captured photos are kept.'); }
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function chooseUpload(index: number | null = retake) {
    if (busy || importingRef.current) return;
    uploadIndex.current = index;
    if (inputRef.current) { inputRef.current.multiple = index === null; inputRef.current.click(); }
  }

  async function upload(files: FileList | null) {
    if (!files?.length || importingRef.current || abortRef.current) return;
    const incoming = Array.from(files);
    const target = uploadIndex.current;
    const indices = target !== null ? [target] : photos.flatMap((photo, i) => photo ? [] : [i]);
    if (!indices.length) { setMessage('Your strip is full. Tap a thumbnail to replace a photo.'); return; }
    importingRef.current = true; setImporting(true); setMessage('Opening your photos…');
    let added = 0, failure = '';
    try {
      for (const file of incoming) {
        if (added >= indices.length) break;
        try {
          const photo = await importPhoto(file);
          if (!mounted.current) return;
          const index = indices[added++];
          setPhotos(previous => previous.map((current, i) => i === index ? photo : current));
        } catch (e) { failure = e instanceof Error ? e.message : 'An image could not be opened.'; }
      }
      if (added) setRetake(null);
      setMessage(failure ? `${added ? `${added} photo${added > 1 ? 's' : ''} added. ` : ''}${failure}` : `${added} photo${added > 1 ? 's' : ''} added.${incoming.length > indices.length ? ' Only the photos that fit were used.' : ' Make it yours.'}`);
    } finally { importingRef.current = false; if (mounted.current) setImporting(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  function reset(nextLayout: LayoutId = layoutId) {
    cancel(); setLayoutId(nextLayout); setPhotos(Array(layouts.find(l => l.id === nextLayout)!.count).fill(null));
    setRetake(null); setDate(new Date()); setMessage(''); setConfirmation(null);
  }
  function changeLayout(next: LayoutId) {
    if (next === layoutId) return;
    if (photos.some(Boolean)) setConfirmation(next); else reset(next);
  }
  function selectPhoto(index: number) {
    if (photos[index]) { setRetake(index); setMessage(`Photo ${index + 1} selected. Use the shutter or upload a replacement.`); }
    else chooseUpload(index);
  }

  return <div className="app-shell">
    <header className="site-header"><a href="#main" className="brand" aria-label="NOIR BOOTH workspace"><Aperture size={29} strokeWidth={1.3} /><span>NOIR BOOTH</span></a><nav aria-label="Studio controls"><button className="help-button" onClick={() => setHelp(true)}>How it works</button><span className="header-divider" /><button className="sound-button" aria-label={`Sound ${sound ? 'on' : 'off'}`} aria-pressed={sound} onClick={() => { if (!sound) prepareAudio(); setSound(!sound); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>Sound {sound ? 'on' : 'off'}</span></button></nav></header>
    <main id="main" className="workspace">
      <SettingsPanel layout={layoutId} timer={timer} filter={filter} effect={effect} disabled={busy} onLayout={changeLayout} onTimer={setTimer} onFilter={setFilter} onEffect={setEffect} />
      <CameraStage videoRef={camera.videoRef} status={camera.status} error={camera.error} mirrored={mirrored} filter={filter} effect={effect} ratio={layout.ratio} canSwitch={camera.canSwitch} busy={busy} capturing={capturing} countdown={countdown} shot={shot} count={layout.count} flash={flash} timer={timer} retake={retake} complete={complete} onEnable={() => void camera.enable()} onClose={() => { cancel(); camera.close(); }} onSwitch={camera.switchCamera} onMirror={() => setMirrored(!mirrored)} onUpload={() => chooseUpload()} onCapture={() => void capture()} onCancel={cancel} onClearRetake={() => setRetake(null)} />
      <StripPanel photos={photos} layout={layoutId} filter={filter} effect={effect} frame={frame} date={date} busy={busy} retake={retake} onRetake={selectPhoto} onFrame={setFrame} onNew={() => photos.some(Boolean) ? setConfirmation('new') : reset()} onError={setMessage} />
    </main>
    <footer className="site-footer"><p>A little moment, kept.</p><p><span className="privacy-dot" />Photos stay on your device.</p></footer>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/heic,image/heif" multiple hidden aria-label="Upload photo files" onChange={e => void upload(e.target.files)} />
    {message && <div className="toast" role="status"><Info size={16} /><p>{message}</p><button className="icon-button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16} /></button></div>}
    {help && <Modal title="A moment in three steps." onClose={() => setHelp(false)}><ol className="help-steps"><li><span>01</span><div><h3>Set the mood.</h3><p>Choose a layout, timer, and color filter. Layer on a camera effect and adjust its strength. Enable your camera when you’re ready, or upload photos from your device.</p></div></li><li><span>02</span><div><h3>Make a moment.</h3><p>Press the round shutter. We’ll count down before each photo. Tap the square to cancel; your captured photos stay. Select any thumbnail for another take.</p></div></li><li><span>03</span><div><h3>Keep it yours.</h3><p>Pick a frame color, adjust the spacing, and add a few words. Download your finished strip as a high-resolution PNG.</p></div></li></ol><p className="help-privacy">Your photos are processed in this browser. Nothing is uploaded or saved to a server. Download before leaving or refreshing this page.</p><button className="button primary w-full" onClick={() => setHelp(false)}>Let’s make a moment</button></Modal>}
    {confirmation && <Modal title={confirmation === 'new' ? 'Make a new moment?' : 'Change your layout?'} onClose={() => setConfirmation(null)}><p className="dialog-description">This will clear your current photos. Download your finished strip first if you’d like to keep it.</p><div className="dialog-actions"><button className="button secondary" autoFocus onClick={() => setConfirmation(null)}>Keep this session</button><button className="button primary" onClick={() => reset(confirmation === 'new' ? layoutId : confirmation)}>{confirmation === 'new' ? 'Start new session' : 'Clear & change layout'}</button></div></Modal>}
  </div>;
}
