import { Check, Circle, CircleDashed, ScanLine, Sparkles, Sun, Copy, FlipHorizontal2, FlipVertical2, Grid2X2, Video, Aperture, Focus, Waves, Wind, Palette, CircleDot, Contrast, Layers } from 'lucide-react';
import { useState } from 'react';
import { filters, layouts, type FilterId, type LayoutId } from '../lib/photobooth';
import { effects, type EffectSettings, type EffectId } from '../lib/effects';

const effectIcons = { none: Circle, grain: CircleDashed, vignette: ScanLine, leak: Sun, glow: Sparkles, prism: Copy, mirror: FlipHorizontal2, pixel: Grid2X2, vhs: Video, kaleidoscope: Aperture, 'mirror-stack': FlipVertical2, fisheye: Focus, tunnel: CircleDot, ripple: Waves, motion: Wind, rgb: Palette, halftone: CircleDashed, poster: Layers, solar: Contrast };

export function LayoutIcon({ id }: { id: LayoutId }) {
  return <span aria-hidden="true" className={`layout-diagram ${id}`}>{Array.from({ length: layouts.find(l => l.id === id)!.count }, (_, i) => <i key={i} />)}</span>;
}

interface Props { layout: LayoutId; timer: number; filter: FilterId; effect: EffectSettings; disabled: boolean; onLayout: (value: LayoutId) => void; onTimer: (value: number) => void; onFilter: (value: FilterId) => void; onEffect: (value: EffectSettings) => void }
export function SettingsPanel({ layout, timer, filter, effect, disabled, onLayout, onTimer, onFilter, onEffect }: Props) {
  const [tab, setTab] = useState('Layout');
  const [lookTab, setLookTab] = useState('Filter');
  const chooseTab = (label: string) => { setTab(label); if (label === 'Filter' || label === 'Effects') setLookTab(label); };
  const selectedEffect = effects.find(item => item.id === effect.id)!;
  const chooseEffect = (id: EffectId) => onEffect({ ...effect, id });
  return <aside className="settings-panel panel" aria-label="Capture settings">
    <div className="mobile-tabs" aria-label="Settings sections">{['Layout', 'Timer', 'Filter', 'Effects'].map(label => <button key={label} aria-pressed={tab === label} onClick={() => chooseTab(label)}>{label}</button>)}</div>
    <fieldset disabled={disabled}>
      <section className={`settings-section ${tab === 'Layout' ? 'mobile-active' : ''}`}>
        <h2 className="section-label"><span>01</span> Layout</h2>
        <div className="layout-options">{layouts.map(item => <button key={item.id} onClick={() => onLayout(item.id)} aria-pressed={layout === item.id} className="layout-option"><LayoutIcon id={item.id} /><span>{item.name}</span></button>)}</div>
      </section>
      <section className={`settings-section ${tab === 'Timer' ? 'mobile-active' : ''}`}>
        <h2 className="section-label"><span>02</span> Timer</h2>
        <div className="timer-options">{[0, 3, 5, 10].map(seconds => <button aria-label={seconds ? `${seconds} second timer` : 'Timer off'} aria-pressed={timer === seconds} key={seconds} onClick={() => onTimer(seconds)}>{seconds ? `${seconds}s` : 'Off'}</button>)}</div>
      </section>
      <section className={`settings-section look-section ${tab === 'Filter' || tab === 'Effects' ? 'mobile-active' : ''}`}>
        <h2 className="sr-only">Your look</h2>
        <div className="look-tabs" role="group" aria-label="Look controls">{['Filter', 'Effects'].map(label => <button key={label} aria-pressed={lookTab === label} onClick={() => chooseTab(label)}>{label}<span aria-hidden="true">{label === 'Filter' ? filters.length : effects.length - 1}</span></button>)}</div>
        {lookTab === 'Filter' ? <div className="filters-panel">
        <p className="filter-selection" aria-live="polite">{filters.find(item => item.id === filter)?.name}<span>{filters.length} looks</span></p>
        <div className="filter-options" role="group" aria-label="Photo filters">{filters.map(item => <button key={item.id} onClick={() => onFilter(item.id)} aria-pressed={filter === item.id}><span className="filter-swatch" style={{ background: item.color }} /><span>{item.name}</span>{filter === item.id && <Check size={14} />}</button>)}</div>
        </div> : <div className="effects-panel">
          <p className="filter-selection" aria-live="polite">{selectedEffect.name}<span>{effects.length - 1} effects</span></p>
          <div className="effect-options" role="group" aria-label="Camera effects">{effects.map(item => {
            const Icon = effectIcons[item.id];
            return <button key={item.id} onClick={() => chooseEffect(item.id)} aria-pressed={effect.id === item.id} title={item.description}><Icon size={19} strokeWidth={1.3} /><span>{item.name}</span></button>;
          })}</div>
          <label className="range-label" htmlFor="effect-strength">Effect strength <span>{effect.id === 'none' ? '—' : `${effect.amount}%`}</span></label>
          <input id="effect-strength" type="range" min="0" max="100" step="5" value={effect.amount} disabled={effect.id === 'none'} onChange={event => onEffect({ ...effect, amount: +event.target.value })} />
          <button className="reset-look" disabled={filter === 'original' && effect.id === 'none'} onClick={() => { onFilter('original'); onEffect({ id: 'none', amount: 65 }); }}>Reset filter & effect</button>
        </div>}
      </section>
    </fieldset>
  </aside>;
}
