import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAzimuthalEqualArea, geoPath, geoCentroid } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useApp } from '../lib/state';
import { describeFlag, displayObs, fmt, fmtEuroRound, fmtSigned, fmtValue, homeCost, inRegion, obsAt, PRICE_BASIS, previousObs, sourceName, TYPICAL_HOME_M2 } from '../lib/data';
import { colorScale } from '../lib/scales';
import Flag from './Flag';

type F = Feature<Geometry, { id: string; covered: number; name?: string }>;

// Small states get a round hit target so they stay easy to click and tap.
const MARKERS = ['MT', 'LU', 'CY', 'XK', 'ME'];
const WB_IDS = ['AL', 'BA', 'XK', 'ME', 'MK', 'RS'];

// Label anchors (lon, lat) where a shape's centroid falls awkwardly (coasts, islands, odd shapes).
const LABEL_AT: Record<string, [number, number]> = {
  HR: [16.2, 45.7], NO: [9.6, 61.6], GR: [22.0, 39.6], IT: [12.6, 42.9], GB: [-1.7, 52.8], SE: [15.2, 62.6], FI: [26.0, 62.6],
  PT: [-8.1, 39.7], ES: [-3.6, 40.2], DK: [9.2, 56.1], NL: [5.6, 52.3], TR: [34.5, 39.0], AL: [20.05, 41.0], ME: [19.25, 42.75],
  RS: [20.8, 44.1], BA: [17.8, 44.2], RO: [24.9, 45.9], HU: [19.4, 47.1], SK: [19.6, 48.7], CZ: [15.4, 49.8], AT: [14.4, 47.6],
  DE: [10.3, 51.1], BE: [4.6, 50.6], LU: [6.1, 49.75], PL: [19.3, 52.1], IE: [-8.0, 53.2], SI: [14.8, 46.1], FR: [2.4, 46.6],
  IS: [-18.6, 64.9], LT: [23.9, 55.3], LV: [25.6, 56.9], EE: [25.8, 58.7], BG: [25.3, 42.7], MK: [21.7, 41.6], XK: [20.9, 42.6],
  UA: [31.4, 49.0], BY: [28.0, 53.5], MD: [28.5, 47.2], CH: [8.2, 46.8], CY: [33.2, 35.0], MT: [14.4, 35.9],
};

function labelText(ind: { id: string; kind: string; decimals: number; unitShort: string }, v: number): string {
  if (ind.id === 'price_m2') return `€${Math.round(v).toLocaleString('en-GB')}`;
  const u = ind.unitShort.trim() === '%' ? '%' : '';
  const d = Math.abs(v) >= 100 ? 0 : ind.decimals;
  return ind.kind === 'rate' ? fmtSigned(v, d, u) : fmt(v, d, u);
}

export default function EuropeMap() {
  const { data, topo, filters, indicator, selectCountry, set, countryName } = useApp();
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 640 });
  const [k, setK] = useState(1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  // Values written on the map: on by default for real prices, otherwise on request.
  const [labelPref, setLabelPref] = useState<boolean | null>(null);
  useEffect(() => setLabelPref(null), [indicator.id]);
  const showLabels = labelPref ?? indicator.id === 'price_m2';

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.max(300, e.contentRect.width);
      setSize({ w, h: Math.round(Math.min(w * 0.86, 720)) });
    });
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const features = useMemo(() => (feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, F['properties']>).features as F[], [topo]);

  const { path, projection } = useMemo(() => {
    const covered = { type: 'FeatureCollection', features: features.filter((f) => f.properties.covered) } as FeatureCollection;
    const projection = geoAzimuthalEqualArea().rotate([-12, -52]).fitExtent([[12, 12], [size.w - 12, size.h - 12]], covered);
    return { projection, path: geoPath(projection) };
  }, [features, size]);

  const shapes = useMemo(() => features.map((f) => ({ f, d: path(f) ?? '', c: path.centroid(f), a: path.area(f) })), [features, path]);

  // Zoom & pan
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .translateExtent([[0, 0], [size.w, size.h]])
      .filter((ev: any) => (ev.type === 'wheel' ? ev.ctrlKey || ev.metaKey : ev.type.startsWith('touch') ? ev.touches.length > 1 : !ev.button))
      .on('zoom', (ev) => {
        gRef.current?.setAttribute('transform', ev.transform.toString());
        setK(ev.transform.k);
        setHover(null);
      });
    zoomRef.current = z;
    select(svg).call(z);
    return () => { select(svg).on('.zoom', null); };
  }, [size]);

  const zoomTo = (ids: string[] | null) => {
    const svg = svgRef.current, z = zoomRef.current;
    if (!svg || !z) return;
    if (!ids) { select(svg).transition().duration(600).call(z.transform, zoomIdentity); return; }
    const fc = { type: 'FeatureCollection', features: features.filter((f) => ids.includes(f.properties.id)) } as FeatureCollection;
    const [[x0, y0], [x1, y1]] = path.bounds(fc);
    const scale = Math.min(8, 0.85 / Math.max((x1 - x0) / size.w, (y1 - y0) / size.h));
    const t = zoomIdentity.translate(size.w / 2, size.h / 2).scale(scale).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    select(svg).transition().duration(750).call(z.transform, t);
  };
  const zoomBy = (f: number) => { const svg = svgRef.current, z = zoomRef.current; if (svg && z) select(svg).transition().duration(300).call(z.scaleBy, f); };

  const scale = colorScale(indicator);
  const year = filters.year;
  const valueOf = (id: string) => displayObs(indicator, id, year)?.[1];
  const regionIds = new Set(data.countries.filter((c) => inRegion(c, filters.region)).map((c) => c.id));

  const onMove = (id: string, ev: React.MouseEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    setHover({ id, x: ev.clientX - r.left, y: ev.clientY - r.top });
  };
  const onFocus = (id: string, c: [number, number]) => {
    const t = gRef.current?.transform.baseVal.consolidate()?.matrix;
    const x = t ? t.a * c[0] + t.e : c[0], y = t ? t.d * c[1] + t.f : c[1];
    setHover({ id, x, y });
  };

  const sorted = [...shapes].sort((a, b) => (a.f.properties.id === filters.focus ? 1 : 0) - (b.f.properties.id === filters.focus ? 1 : 0));

  return (
    <div className="map-wrap" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg ref={svgRef} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} className="map" role="group" aria-label={`Map of Europe: ${indicator.label}, ${year}. Use Tab to move between countries and Enter to select.`}>
        <defs>
          <pattern id="nodata" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#f3efe7" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#cfc6b6" strokeWidth="1.4" />
          </pattern>
        </defs>
        <rect width={size.w} height={size.h} fill="transparent" />
        <g ref={gRef}>
          {sorted.map(({ f, d, c }) => {
            const id = f.properties.id;
            if (!f.properties.covered) return <path key={id} d={d} className="ctx" />;
            const v = valueOf(id);
            const fill = v === undefined ? 'url(#nodata)' : scale.color(v);
            const dim = !regionIds.has(id);
            const sel = filters.focus === id;
            const name = countryName(id);
            return (
              <path
                key={id}
                d={d}
                fill={fill}
                className={`country ${dim ? 'dim' : ''} ${sel ? 'sel' : ''} ${hover?.id === id ? 'hov' : ''}`}
                tabIndex={dim ? -1 : 0}
                role="button"
                aria-pressed={sel}
                aria-label={`${name}: ${v === undefined ? 'data unavailable' : fmtValue(indicator, v)}`}
                onMouseMove={(e) => onMove(id, e)}
                onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) onFocus(id, c as [number, number]); }}
                onBlur={() => setHover(null)}
                onClick={() => selectCountry(id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCountry(id); } }}
              />
            );
          })}
          {MARKERS.map((id) => {
            const s = shapes.find((x) => x.f.properties.id === id);
            if (!s) return null;
            const v = valueOf(id);
            const [cx, cy] = id === 'CY' || id === 'ME' || id === 'XK' ? s.c : projection(geoCentroid(s.f)) ?? s.c;
            const tiny = id === 'MT' || id === 'LU';
            if (!tiny && k > 2.5) return null;
            return (
              <circle
                key={`m-${id}`}
                cx={cx}
                cy={cy}
                r={(tiny ? 5.5 : 4) / Math.sqrt(k)}
                fill={tiny ? (v === undefined ? '#f3efe7' : scale.color(v)) : 'transparent'}
                className={`marker ${tiny ? 'tiny' : 'hit'} ${filters.focus === id ? 'sel' : ''}`}
                onMouseMove={(e) => onMove(id, e)}
                onClick={() => selectCountry(id)}
                aria-hidden="true"
              />
            );
          })}
          {showLabels && <MapLabels shapes={shapes} projection={projection} k={k} valueOf={valueOf} regionIds={regionIds} />}
        </g>
      </svg>
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
        <button onClick={() => zoomTo(null)} aria-label="Reset zoom" className="txt">Europe</button>
        <button onClick={() => zoomTo(WB_IDS)} className="txt">Balkans</button>
        <button onClick={() => setLabelPref(!showLabels)} className={`txt ${showLabels ? 'on' : ''}`} aria-pressed={showLabels}>
          {showLabels ? 'Hide values' : 'Show values'}
        </button>
        {filters.focus && <button onClick={() => set({ focus: null })} className="txt">Clear selection</button>}
      </div>
      <p className="map-hint">Drag to pan · Ctrl + scroll or buttons to zoom</p>
      {hover && <MapTooltip id={hover.id} x={hover.x} y={hover.y} w={size.w} h={size.h} />}
    </div>
  );
}

function MapLabels({ shapes, projection, k, valueOf, regionIds }: { shapes: { f: F; c: [number, number]; a: number }[]; projection: (p: [number, number]) => [number, number] | null; k: number; valueOf: (id: string) => number | undefined; regionIds: Set<string> }) {
  const { indicator, filters } = useApp();
  const fs = 10.5 / k;
  // Place labels greedily — selected country, then the Western Balkans, then by size — skipping overlaps.
  const items = shapes
    .filter(({ f }) => f.properties.covered && regionIds.has(f.properties.id) && valueOf(f.properties.id) !== undefined)
    .map(({ f, c, a }) => {
      const id = f.properties.id;
      const at = LABEL_AT[id] ? projection(LABEL_AT[id]) : c;
      const text = labelText(indicator, valueOf(id)!);
      const rank = id === filters.focus ? 3e9 : WB_IDS.includes(id) ? 2e9 : a;
      return { id, x: at?.[0] ?? c[0], y: at?.[1] ?? c[1], text, rank, w: text.length * fs * 0.64 + 6 / k, h: fs * 1.5 };
    })
    .sort((p, q) => q.rank - p.rank);
  const placed: typeof items = [];
  for (const it of items) {
    if (placed.some((p) => Math.abs(p.x - it.x) < (p.w + it.w) / 2 && Math.abs(p.y - it.y) < (p.h + it.h) / 2)) continue;
    placed.push(it);
  }
  return (
    <g className="map-labels" aria-hidden="true" style={{ fontSize: fs }}>
      {placed.map((p) => (
        <text key={p.id} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" strokeWidth={3 / k}>
          {p.text}
        </text>
      ))}
    </g>
  );
}

function MapTooltip({ id, x, y, w, h }: { id: string; x: number; y: number; w: number; h: number }) {
  const { data, filters, indicator, countryName } = useApp();
  const year = filters.year;
  const series = indicator.series[id];
  const o = displayObs(indicator, id, year);
  const prev = indicator.snapshot ? undefined : previousObs(series, year);
  const home = indicator.id === 'price_m2' ? homeCost(data, id, year) : undefined;
  const extra = indicator.extra?.[id];
  const bench = indicator.benchmarkSeries ? obsAt(indicator.benchmarkSeries, year) : undefined;
  const last = series?.[series.length - 1];
  const flags = describeFlag(o?.[2]);
  const status = !o ? 'Missing' : flags.includes('provisional') ? 'Provisional' : flags.includes('estimated') ? 'Estimated' : 'Actual';
  const src = indicator.countrySource[id];
  const rate = indicator.kind === 'rate';
  const left = x > w - 290 ? Math.max(4, x - 280) : x + 16;
  const top = y > h - 230 ? Math.max(8, y - 230) : Math.max(8, y - 24);
  const deltaUnit = rate || indicator.unitShort === '%' ? ' pp' : indicator.unitShort || ' pts';
  return (
    <div className="tooltip" style={{ left, top }} role="status">
      <div className="tt-head">
        <Flag id={id} size="md" /> <strong>{countryName(id)}</strong>
      </div>
      <div className="tt-ind">{indicator.short} · {o && o[0] !== year ? `${o[0]} (latest available)` : year}</div>
      {o ? (
        <div className="tt-value">
          {rate ? fmtSigned(o[1], indicator.decimals, indicator.unitShort) : fmtValue(indicator, o[1])}
          <span className="tt-unit">{indicator.unit}</span>
        </div>
      ) : (
        <div className="tt-value tt-na">
          Data unavailable
          <span className="tt-unit">{last ? `Latest available: ${fmtValue(indicator, last[1])} (${last[0]})` : 'Not covered by this source'}</span>
        </div>
      )}
      {home && (
        <div className="tt-home">
          A {TYPICAL_HOME_M2} m² home: <strong>about {fmtEuroRound(home.price)}</strong>
          {home.years !== undefined && <span>≈ {fmt(home.years, 1)} years of a typical person’s disposable income</span>}
        </div>
      )}
      <dl className="tt-rows">
        {extra?.basis && (
          <div>
            <dt>Basis</dt>
            <dd>{PRICE_BASIS[extra.basis] ?? extra.basis}</dd>
          </div>
        )}
        {extra?.change !== undefined && (
          <div>
            <dt>Change vs {(o?.[0] ?? year) - 1}</dt>
            <dd>{fmtSigned(extra.change, 1, '%')}</dd>
          </div>
        )}
        {o && prev && (
          <div>
            <dt>Change vs {prev[0]}{prev[0] !== year - 1 ? ' (gap)' : ''}</dt>
            <dd>{fmtSigned(o[1] - prev[1], indicator.decimals, deltaUnit)}</dd>
          </div>
        )}
        {bench && filters.benchmark && (
          <div>
            <dt>{indicator.benchmarkId === 'EA' ? 'Euro area' : 'EU-27'}</dt>
            <dd>{rate ? fmtSigned(bench[1], indicator.decimals, indicator.unitShort) : fmtValue(indicator, bench[1])}</dd>
          </div>
        )}
        <div>
          <dt>Status</dt>
          <dd><span className={`status status-${status.toLowerCase()}`}>{status}</span>{flags.filter((f) => f !== 'provisional' && f !== 'estimated').map((f) => ` · ${f}`)}</dd>
        </div>
      </dl>
      {extra?.note && <div className="tt-note">{extra.note.replace('EUR ', '€').replace('/m2', '/m²')}</div>}
      {src && <div className="tt-src">{sourceName(data, src.s)}{src.d ? ' · derived' : ''}{indicator.id === 'price_m2' && src.s.startsWith('deloitte') ? ' · not official statistics' : ''}</div>}
    </div>
  );
}

