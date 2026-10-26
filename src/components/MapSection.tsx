import { useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/state';
import { coverageAt, fmt } from '../lib/data';
import { colorScale, NO_DATA } from '../lib/scales';
import EuropeMap from './EuropeMap';
import CountryPanel from './CountryPanel';
import { IndicatorSelect } from './FilterBar';
import Info from './Info';

const QUICK = ['hpi_growth', 'hpi', 'rent_growth', 'rent_index', 'pti', 'overburden', 'inflation', 'aic_pps'];

export default function MapSection() {
  const { data, filters, set, indicator } = useApp();
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const first = indicator.coverage.first;
  const last = indicator.coverage.last;
  const ids = data.countries.map((c) => c.id);
  const covered = coverageAt(indicator, filters.year, ids);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      set({ year: filters.year >= last ? first : filters.year + 1 });
    }, 900);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, filters.year, first, last, set]);

  useEffect(() => { if (playing && filters.year >= last) setPlaying(false); }, [playing, filters.year, last]);

  const scale = colorScale(indicator);
  const isIndex = indicator.unit.startsWith('Index') && indicator.indexBase;

  return (
    <section id="map" className="section" aria-labelledby="map-title">
      <div className="section-head">
        <p className="eyebrow">The map</p>
        <h2 id="map-title">Where is living getting more expensive?</h2>
        <p className="lede">Pick a measure, then move through the years. Click any country to see its story in detail.</p>
      </div>
      <div className="quick" role="toolbar" aria-label="Map indicator">
        {QUICK.map((id) => {
          const ind = data.indicators.find((i) => i.id === id)!;
          return (
            <button key={id} className={`pill ${filters.indicator === id ? 'on' : ''}`} aria-pressed={filters.indicator === id} onClick={() => set({ indicator: id })}>
              {ind.short}
            </button>
          );
        })}
        <div className="quick-more"><IndicatorSelect label="More measures" /></div>
      </div>
      <div className="map-grid">
        <div className="map-card card">
          <div className="map-card-head">
            <div>
              <h3 className="chart-title">{indicator.label}, {filters.year}</h3>
              <p className="chart-unit">{indicator.unit}</p>
            </div>
            <Info title={indicator.label}>
              <p>{indicator.explainer}</p>
              <p className="muted">{indicator.definition}</p>
              {indicator.caveat && <p className="caveat">{indicator.caveat}</p>}
            </Info>
          </div>
          <EuropeMap />
          <div className="map-foot">
            <div className="legend" aria-label="Colour legend">
              {scale.bins.map((b, i) => (
                <span key={i} className="legend-item">
                  <span className="legend-swatch" style={{ background: b.color }} />
                  <span className="legend-label">
                    {b.from === undefined ? `< ${fmt(b.to, b.to! % 1 ? 1 : 0)}` : b.to === undefined ? `≥ ${fmt(b.from, b.from % 1 ? 1 : 0)}` : `${fmt(b.from, b.from % 1 ? 1 : 0)}–${fmt(b.to, b.to % 1 ? 1 : 0)}`}
                  </span>
                </span>
              ))}
              <span className="legend-item">
                <span className="legend-swatch nodata" style={{ background: NO_DATA }} />
                <span className="legend-label">No data</span>
              </span>
              <span className="legend-unit">{indicator.unitShort.trim() || indicator.unit}</span>
            </div>
            <div className="timeline">
              <button className="play" onClick={() => { if (!playing && filters.year >= last) set({ year: first }); setPlaying((p) => !p); }} aria-label={playing ? 'Pause animation' : 'Play through the years'}>
                {playing ? '❚❚' : '▶'}
              </button>
              <input
                type="range"
                min={first}
                max={last}
                value={filters.year}
                onChange={(e) => { setPlaying(false); set({ year: +e.target.value }); }}
                aria-label="Year"
                aria-valuetext={String(filters.year)}
              />
              <span className="timeline-year">{filters.year}</span>
            </div>
            <p className="map-note">
              {covered} of {ids.length} countries have data for {filters.year}. Hatched countries have no comparable data — they are not low values.
              {isIndex ? ` An index shows change since ${indicator.indexBase}, not which country is more expensive.` : ''}
              {last < data.lastYear ? ` Annual data end in ${last}; 2026 readings appear in the country panel where published.` : ''}
            </p>
          </div>
        </div>
        <CountryPanel />
      </div>
    </section>
  );
}
