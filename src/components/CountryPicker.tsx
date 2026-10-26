import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useApp, MAX_COUNTRIES } from '../lib/state';
import { inRegion } from '../lib/data';
import { SERIES } from '../lib/scales';
import Flag from './Flag';

interface Props {
  min?: number;
  compact?: boolean;
}

const GROUPS: [string, (c: { wb: boolean; eu: boolean }) => boolean][] = [
  ['Western Balkans', (c) => c.wb],
  ['European Union', (c) => c.eu],
  ['Other European countries', (c) => !c.wb && !c.eu],
];

const PRESETS: { label: string; ids: string[] }[] = [
  { label: 'Western Balkans', ids: ['AL', 'RS', 'MK', 'ME', 'XK'] },
  { label: 'Albania vs Belgium', ids: ['AL', 'BE'] },
  { label: 'Serbia vs Germany', ids: ['RS', 'DE'] },
  { label: 'Balkans vs West', ids: ['AL', 'RS', 'BA', 'AT', 'FR'] },
  { label: 'Big four EU', ids: ['DE', 'FR', 'IT', 'ES'] },
];

export default function CountryPicker({ min = 1, compact }: Props) {
  const { data, filters, set } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const sel = filters.countries;

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const options = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.countries.filter((c) => inRegion(c, filters.region) || filters.region === 'ALL').filter((c) => !t || c.name.toLowerCase().includes(t) || c.id.toLowerCase() === t);
  }, [data, q, filters.region]);

  const toggle = (id: string) => {
    if (sel.includes(id)) {
      if (sel.length <= min) return;
      set({ countries: sel.filter((x) => x !== id), focus: filters.focus === id ? null : filters.focus });
    } else if (sel.length < MAX_COUNTRIES) set({ countries: [...sel, id] });
  };

  const name = (id: string) => data.countries.find((c) => c.id === id)?.name ?? id;

  return (
    <div className={`picker ${compact ? 'picker-compact' : ''}`} ref={box}>
      <ul className="chips" aria-label="Selected countries">
        {sel.map((id, i) => (
          <li key={id} className="chip">
            <span className="swatch" style={{ background: SERIES[i] }} aria-hidden="true" />
            <Flag id={id} />
            <span className="chip-name">{name(id)}</span>
            <button className="chip-x" onClick={() => toggle(id)} disabled={sel.length <= min} aria-label={`Remove ${name(id)}`} title={sel.length <= min ? `Keep at least ${min}` : `Remove ${name(id)}`}>
              ×
            </button>
          </li>
        ))}
        <li>
          <button className="chip-add" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={listId} disabled={sel.length >= MAX_COUNTRIES && !open}>
            + Add country {sel.length >= MAX_COUNTRIES ? '(max 5)' : ''}
          </button>
        </li>
      </ul>
      {open && (
        <div className="popover" id={listId} role="dialog" aria-label="Choose countries">
          <input ref={input} className="search" type="search" placeholder="Search countries…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search countries" />
          {!q && (
            <div className="presets">
              <span className="eyebrow">Quick comparisons</span>
              <div className="preset-row">
                {PRESETS.map((p) => (
                  <button key={p.label} className="preset" onClick={() => { set({ countries: p.ids, focus: p.ids[0] }); setOpen(false); }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="options" role="listbox" aria-multiselectable="true" aria-label="Countries">
            {GROUPS.map(([label, test]) => {
              const list = options.filter(test);
              if (!list.length) return null;
              return (
                <div key={label} className="opt-group">
                  <div className="eyebrow">{label}</div>
                  {list.map((c) => {
                    const on = sel.includes(c.id);
                    const disabled = !on && sel.length >= MAX_COUNTRIES;
                    return (
                      <button key={c.id} role="option" aria-selected={on} className={`opt ${on ? 'on' : ''}`} disabled={disabled} onClick={() => toggle(c.id)}>
                        <Flag id={c.id} /> {c.name}
                        {on && <span className="tick" aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <p className="popover-note">Up to {MAX_COUNTRIES} countries. Colours follow the order of selection.</p>
        </div>
      )}
    </div>
  );
}
