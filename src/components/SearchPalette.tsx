import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, MAX_COUNTRIES } from '../lib/state';
import { displayObs, fmtEuroRound, fmtSigned, homeCost } from '../lib/data';
import { matchScore, scrollToId } from '../lib/ui';
import Flag from './Flag';
import { numLocale, t } from '../lib/i18n';

const REGION_NAMES = { N: 'Northern Europe', W: 'Western Europe', S: 'Southern Europe', E: 'Eastern Europe' };

/** The search button in the masthead, and the country finder it opens (also on "/" or Ctrl+K). */
export default function SearchPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-finder', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-finder', onOpen); };
  }, []);
  return (
    <>
      <button className="search-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SearchIcon />
        <span className="search-btn-text">{t('Search a country…')}</span>
        <kbd aria-hidden="true">/</kbd>
      </button>
      {open && <Finder onClose={() => setOpen(false)} />}
    </>
  );
}

export function openFinder() {
  window.dispatchEvent(new Event('open-finder'));
}

export function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Finder({ onClose }: { onClose: () => void }) {
  const { data, filters, set, selectCountry, ind } = useApp();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const hpi = ind('hpi_growth');
  const year = filters.year;

  const results = useMemo(
    () =>
      data.countries
        .map((c) => ({ c, s: matchScore(c, q) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s || (q ? a.c.name.localeCompare(b.c.name, numLocale()) : (b.c.wb ? 1 : 0) - (a.c.wb ? 1 : 0) || a.c.name.localeCompare(b.c.name)))
        .map((r) => r.c),
    [data, q],
  );

  useEffect(() => { input.current?.focus(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  useEffect(() => setActive(0), [q]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);

  const open = (id: string) => { selectCountry(id); onClose(); setTimeout(() => scrollToId('map'), 30); };
  const compare = (id: string) => {
    const has = filters.countries.includes(id);
    set({ countries: has ? filters.countries : [...filters.countries.slice(-(MAX_COUNTRIES - 1)), id], focus: id });
    onClose();
    setTimeout(() => scrollToId('table'), 30);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); (e.shiftKey ? compare : open)(results[active].id); }
  };

  return (
    <div className="finder-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="finder" role="dialog" aria-modal="true" aria-label={t('Search a country')} onKeyDown={onKey}>
        <div className="finder-input">
          <SearchIcon />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('Type a country, for example Albania, Germany or Kosovo')}
            aria-label={t('Country name')}
            role="combobox"
            aria-expanded="true"
            aria-controls="finder-list"
            aria-activedescendant={results[active] ? `finder-${results[active].id}` : undefined}
          />
          <button className="finder-close" onClick={onClose} aria-label={t('Close search')}>Esc</button>
        </div>
        <ul className="finder-list" id="finder-list" role="listbox" ref={list}>
          {results.map((c, i) => {
            const home = homeCost(data, c.id, year);
            const g = displayObs(hpi, c.id, year);
            const inCompare = filters.countries.includes(c.id);
            return (
              <li key={c.id} id={`finder-${c.id}`} role="option" aria-selected={i === active} data-i={i} className={`finder-row ${i === active ? 'on' : ''}`} onMouseEnter={() => setActive(i)}>
                <button className="finder-main" onClick={() => open(c.id)}>
                  <Flag id={c.id} size="md" />
                  <span className="finder-name">
                    {c.name}
                    <span className="finder-sub">{t(REGION_NAMES[c.region])}{c.eu ? ` · ${t('EU')}` : ''}{c.wb ? ` · ${t('Western Balkans')}` : ''}</span>
                  </span>
                  <span className="finder-facts">
                    {home ? <span><b>{fmtEuroRound(home.price)}</b> {t('for 70 m²')}</span> : <span className="muted">{t('no price data')}</span>}
                    {g && <span>{t('house prices {v} ({year})', { v: fmtSigned(g[1], 1, '%'), year: g[0] })}</span>}
                  </span>
                </button>
                <button className={`finder-add ${inCompare ? 'on' : ''}`} onClick={() => compare(c.id)} title={inCompare ? t('Already in your comparison') : t('Add to the comparison table')}>
                  {inCompare ? `✓ ${t('Comparing')}` : `+ ${t('Compare')}`}
                </button>
              </li>
            );
          })}
          {!results.length && <li className="finder-empty">{t('No country matches “{q}”. This explorer covers {n} European countries.', { q, n: data.countries.length })}</li>}
        </ul>
        <p className="finder-foot">
          <kbd>↑</kbd><kbd>↓</kbd> {t('to move')} · <kbd>Enter</kbd> {t('to open')} · <kbd>Shift</kbd>+<kbd>Enter</kbd> {t('to compare')} · <kbd>Esc</kbd> {t('to close')}
        </p>
      </div>
    </div>
  );
}
