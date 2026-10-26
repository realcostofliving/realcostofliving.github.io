import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAzimuthalEqualArea, geoPath, geoCentroid } from 'd3-geo';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useApp } from '../lib/state';
import { describeFlag, fmtSigned, fmtValue, inRegion, obsAt, previousObs, sourceName } from '../lib/data';
import { colorScale } from '../lib/scales';
import Flag from './Flag';

type F = Feature<Geometry, { id: string; covered: number; name?: string }>;

// Small states get a round hit target so they stay easy to click and tap.
const MARKERS = ['MT', 'LU', 'CY', 'XK', 'ME'];
const WB_IDS = ['AL', 'BA', 'XK', 'ME', 'MK', 'RS'];

export default function EuropeMap() {
  const { data, topo, filters, indicator, selectCountry, set, countryName } = useApp();
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState({ w: 800, h: 640 });
  const [k, setK] = useState(1);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

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

  const shapes = useMemo(() => features.map((f) => ({ f, d: path(f) ?? '', c: path.centroid(f) })), [features, path]);

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
  const valueOf = (id: string) => obsAt(indicator.series[id], year)?.[1];
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
        </g>
      </svg>
      <div className="map-controls" role="group" aria-label="Map zoom">
        <button onClick={() => zoomBy(1.6)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomBy(1 / 1.6)} aria-label="Zoom out">−</button>
        <button onClick={() => zoomTo(null)} aria-label="Reset zoom" className="txt">Europe</button>
        <button onClick={() => zoomTo(WB_IDS)} className="txt">Balkans</button>
        {filters.focus && <button onClick={() => set({ focus: null })} className="txt">Clear selection</button>}
      </div>
      <p className="map-hint">Drag to pan · Ctrl + scroll or buttons to zoom</p>
      {hover && <MapTooltip id={hover.id} x={hover.x} y={hover.y} w={size.w} h={size.h} />}
    </div>
  );
}

function MapTooltip({ id, x, y, w, h }: { id: string; x: number; y: number; w: number; h: number }) {
  const { data, filters, indicator, countryName } = useApp();
  const year = filters.year;
  const series = indicator.series[id];
  const o = obsAt(series, year);
  const prev = previousObs(series, year);
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
      <div className="tt-ind">{indicator.short} · {year}</div>
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
      <dl className="tt-rows">
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
      {src && <div className="tt-src">{sourceName(data, src.s)}{src.d ? ' · derived' : ''}</div>}
    </div>
  );
}

