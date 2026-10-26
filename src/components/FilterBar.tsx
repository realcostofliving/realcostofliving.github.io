import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/state';
import { modeSupported } from '../lib/data';
import type { RegionId, ValueMode } from '../lib/types';
import CountryPicker from './CountryPicker';

export const MODE_LABELS: Record<ValueMode, string> = {
  original: 'Original',
  yoy: 'Yearly change',
  change: 'Change since',
  index: 'Indexed',
};

const CATEGORY_LABELS = { housing: 'Housing', prices: 'Prices & cost of living', income: 'Income & living standards' };

export function IndicatorSelect({ id, label = 'Indicator', onChange }: { id?: string; label?: string; onChange?: (id: string) => void }) {
  const { data, filters, set } = useApp();
  const value = id ?? filters.indicator;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => (onChange ? onChange(e.target.value) : set({ indicator: e.target.value }))}>
        {(['housing', 'prices', 'income'] as const).map((cat) => (
          <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
            {data.indicators.filter((i) => i.category === cat && i.crossCountry !== false).map((i) => (
              <option key={i.id} value={i.id}>{i.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

export function years(from: number, to: number) {
  const out: number[] = [];
  for (let y = from; y <= to; y++) out.push(y);
  return out;
}

export default function FilterBar() {
  const { data, filters, set, reset, indicator } = useApp();
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  // Expose the bar's height so sticky panels and anchor scrolling clear it.
  useEffect(() => {
    if (!bar.current) return;
    const ro = new ResizeObserver(([e]) => document.documentElement.style.setProperty('--fb-h', `${Math.round(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)}px`));
    ro.observe(bar.current);
    return () => ro.disconnect();
  }, []);
  const yearOptions = years(indicator.coverage.first, indicator.coverage.last);
  const allYears = years(data.firstYear, data.lastYear - 1);

  return (
    <div className="filterbar" role="region" aria-label="Filters" ref={bar}>
      <div className="filterbar-inner">
        <button className="filter-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Filters <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
        <div className={`filters ${open ? 'open' : ''}`}>
          <label className="field">
            <span className="field-label">Region</span>
            <select value={filters.region} onChange={(e) => set({ region: e.target.value as RegionId })}>
              {data.regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <IndicatorSelect />
          <label className="field field-narrow">
            <span className="field-label">Year</span>
            <select value={filters.year} onChange={(e) => set({ year: +e.target.value })}>
              {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="field-label" id="period-label">Period</span>
            <div className="range" role="group" aria-labelledby="period-label">
              <select aria-label="Start year" value={filters.startYear} onChange={(e) => set({ startYear: Math.min(+e.target.value, filters.endYear - 1) })}>
                {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <span aria-hidden="true">–</span>
              <select aria-label="End year" value={filters.endYear} onChange={(e) => set({ endYear: Math.max(+e.target.value, filters.startYear + 1) })}>
                {years(data.firstYear + 1, data.lastYear).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <span className="field-label" id="values-label">Values</span>
            <div className="seg" role="radiogroup" aria-labelledby="values-label">
              {(Object.keys(MODE_LABELS) as ValueMode[]).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={filters.mode === m}
                  className={filters.mode === m ? 'on' : ''}
                  disabled={!modeSupported(indicator, m)}
                  title={!modeSupported(indicator, m) ? 'Not meaningful for an indicator that is already a rate of change' : undefined}
                  onClick={() => set({ mode: m })}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          <label className="field field-narrow">
            <span className="field-label">Base year</span>
            <select value={filters.baseYear} disabled={filters.mode === 'original' || filters.mode === 'yoy'} onChange={(e) => set({ baseYear: +e.target.value })}>
              {allYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="switch">
            <input type="checkbox" checked={filters.benchmark} onChange={(e) => set({ benchmark: e.target.checked })} />
            <span className="switch-track" aria-hidden="true" />
            <span className="field-label">Benchmark</span>
            <span className="switch-text">{indicator.benchmarkId === 'EA' ? 'Euro area' : 'EU-27'}</span>
          </label>
          <button className="btn btn-ghost" onClick={reset}>Reset filters</button>
        </div>
        <div className={`filter-countries ${open ? 'open' : ''}`}>
          <span className="field-label">Countries</span>
          <CountryPicker />
        </div>
      </div>
    </div>
  );
}
