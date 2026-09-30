import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, Image, RotateCcw } from 'lucide-react';
import { compositionSize, frameColors, layouts, renderComposition, processedPhoto, type FilterId, type FrameSettings, type LayoutId, type Photo } from '../lib/photobooth';
import { type EffectSettings } from '../lib/effects';

function Thumbnail({ photo, index, filter, effect, ratio, photoWidth, selected, disabled, onSelect }: { photo: Photo | null; index: number; filter: FilterId; effect: EffectSettings; ratio: number; photoWidth: number; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!photo || !ref.current) return;
    try {
      const canvas = ref.current;
      canvas.width = 160; canvas.height = Math.round(160 / ratio);
      canvas.getContext('2d')?.drawImage(processedPhoto(photo, photoWidth, Math.round(photoWidth / ratio), filter, effect), 0, 0, canvas.width, canvas.height);
    } catch { /* The main composition displays the actionable render error. */ }
  }, [photo, filter, effect, ratio, photoWidth]);
  return <button className={`thumbnail ${selected ? 'selected' : ''}`} disabled={disabled} onClick={onSelect} aria-label={photo ? `Select photo ${index + 1} to retake or replace` : `Upload photo ${index + 1}`} aria-pressed={selected}>
    {photo ? <><canvas ref={ref} /><span className="thumbnail-retake"><RotateCcw size={17} /></span><span className="thumbnail-number">0{index + 1}</span></> : <><Image size={18} /><span className="sr-only">Empty</span></>}
  </button>;
}

interface Props {
  photos: (Photo | null)[]; layout: LayoutId; filter: FilterId; effect: EffectSettings; frame: FrameSettings; date: Date;
  busy: boolean; retake: number | null; onRetake: (index: number) => void;
  onFrame: (frame: FrameSettings) => void; onNew: () => void; onError: (message: string) => void;
}
export function StripPanel(p: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [renderError, setRenderError] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const layout = layouts.find(l => l.id === p.layout)!;
  const filled = p.photos.filter(Boolean).length;
  const size = compositionSize(p.layout, p.frame);
  useEffect(() => { let active = true; void document.fonts.ready.then(() => { if (active) setFontsReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => {
    setDownloaded(false);
    if (!canvasRef.current) return;
    try { renderComposition(canvasRef.current, p.photos, p.layout, p.filter, p.frame, p.date, p.effect); setRenderError(''); }
    catch { setRenderError('We couldn’t render this strip. Try another photo or start a new session.'); }
  }, [p.photos, p.layout, p.filter, p.effect, p.frame, p.date, fontsReady]);
  const update = (partial: Partial<FrameSettings>) => p.onFrame({ ...p.frame, ...partial });
  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas || filled !== layout.count || exporting || !fontsReady) return;
    setExporting(true);
    try {
      // Serialize the displayed canvas directly. Repainting here can change
      // text antialiasing when a browser changes its canvas rendering backend.
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG creation failed')), 'image/png'));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `noir-booth-${p.date.getFullYear()}-${String(p.date.getMonth() + 1).padStart(2, '0')}-${String(p.date.getDate()).padStart(2, '0')}.png`;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloaded(true);
    } catch { p.onError('Your download could not be created. Please try again.'); }
    finally { setExporting(false); }
  };
  return <aside className="strip-panel panel" aria-label="Photo strip preview">
    <div className="strip-heading"><h2 className="section-label">Your strip</h2><span className="mono">{filled}/{layout.count}</span></div>
    <div className={`strip-preview ${p.layout}`}><canvas ref={canvasRef} aria-label={`Your ${layout.name} composition, ${filled} of ${layout.count} photos`} data-testid="composition" /></div>
    {renderError && <p role="alert" className="error-text">{renderError}</p>}
    <div className="thumbnails" style={{ gridTemplateColumns: `repeat(${layout.count}, minmax(0, 1fr))` }}>{Array.from({ length: layout.count }, (_, i) => <Thumbnail key={i} index={i} photo={p.photos[i]} filter={p.filter} effect={p.effect} ratio={layout.ratio} photoWidth={size.photoW} selected={p.retake === i} disabled={p.busy} onSelect={() => p.onRetake(i)} />)}</div>
    {filled > 0 && <p className="retake-hint">Tap a photo for another take.</p>}
    <fieldset disabled={p.busy || exporting} className="frame-settings">
      <legend className="sr-only">Frame customization</legend>
      <span className="field-label">Frame color</span>
      <div className="color-options">{frameColors.map((color, i) => <button key={color.name} aria-label={`${color.name} frame`} aria-pressed={p.frame.color === i} className="color-option" onClick={() => update({ color: i })} style={{ background: color.value, color: color.ink }} title={color.name}>{p.frame.color === i && <Check size={14} />}</button>)}</div>
      <button className="customize-toggle" aria-expanded={expanded} aria-controls="customize-frame" onClick={() => setExpanded(!expanded)}><span>Customize frame</span><ChevronDown className={expanded ? 'rotated' : ''} size={16} /></button>
      {expanded && <div id="customize-frame" className="customization">
        <label className="range-label" htmlFor="spacing">Photo spacing <span>{p.frame.spacing}</span></label><input id="spacing" type="range" min="0" max="40" value={p.frame.spacing} onChange={e => update({ spacing: +e.target.value })} />
        <label className="range-label" htmlFor="padding">Frame padding <span>{p.frame.padding}</span></label><input id="padding" type="range" min="12" max="64" value={p.frame.padding} onChange={e => update({ padding: +e.target.value })} />
        <label className="field-label" htmlFor="caption">A few words <span className="muted">{Array.from(p.frame.caption).length}/36</span></label>
        <input id="caption" type="text" placeholder="Something to remember" value={p.frame.caption} onChange={e => update({ caption: Array.from(e.target.value).slice(0, 36).join('') })} />
        <label className="checkbox-label"><input type="checkbox" checked={p.frame.showDate} onChange={e => update({ showDate: e.target.checked })} />Add the date</label>
        <label className="field-label" htmlFor="decoration">Little details</label><select id="decoration" value={p.frame.decoration} onChange={e => update({ decoration: e.target.value as FrameSettings['decoration'] })}><option value="none">Keep it simple</option><option value="stars">Tiny stars ✦</option><option value="hearts">Little hearts ♡</option><option value="timestamp">Film timestamp</option></select>
      </div>}
    </fieldset>
    <button className="button primary download-button" onClick={() => void download()} disabled={filled !== layout.count || p.busy || exporting || !fontsReady || !!renderError}><Download size={16} />{exporting ? 'Preparing PNG…' : downloaded ? 'Download again' : 'Download photo'}</button>
    {filled === layout.count && <p className="export-info mono" role="status">{downloaded ? 'PNG ready. Keep this one.' : `${size.width} × ${size.height} · PNG`}</p>}
    <button className="button secondary new-session" onClick={p.onNew} disabled={p.busy || exporting}><RotateCcw size={16} />New session</button>
  </aside>;
}
