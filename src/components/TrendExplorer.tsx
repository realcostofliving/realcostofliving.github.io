import { useMemo } from 'react';
import { useApp } from '../lib/state';
import { describeFlag, fmt, inRegion, modeSupported, modeUnit, obsAt, transform } from '../lib/data';
import { BENCHMARK_COLOR, SERIES, colorScale, NO_DATA } from '../lib/scales';
import type { Indicator, Obs, ValueMode } from '../lib/types';
import EChart, { axisCommon, baseOption, INK, INK_3 } from './EChart';
import Info from './Info';
import { MODE_LABELS } from './FilterBar';

const THEMES: [string, string][] = [
  ['hpi', 'House prices'],
  ['rent_index', 'Rents'],
  ['inflation', 'Inflation'],
  ['housing_cost_share', 'Housing costs vs income'],
  ['pti', 'Affordability'],
  ['median_income_pps', 'Income'],
];

export function years(a: number, b: number) {
  const out: number[] = [];
  for (let y = a; y <= b; y++) out.push(y);
  return out;
}

/** Build line-chart series for the selected countries (+ optional benchmark). */
export function lineSeries(ind: Indicator, ids: string[], mode: ValueMode, baseYear: number, xs: number[], benchmark: boolean, name: (id: string) => string) {
  const m = modeSupported(ind, mode) ? mode : 'original';
  const toData = (s: Obs[]) => {
    const t = transform(s, ind, m, baseYear);
    return xs.map((y) => {
      const o = obsAt(t, y);
      if (!o) return null;
      return { value: [String(y), o[1]], flag: o[2], symbol: o[2] ? 'emptyCircle' : 'circle', symbolSize: o[2] ? 7 : 4 };
    });
  };
  const out: any[] = [];
  const missing: string[] = [];
  ids.forEach((id, i) => {
    const s = ind.series[id];
    const d = s ? toData(s) : [];
    // Only report "no data" when the source has nothing; a missing base year is reported separately.
    if (!s?.length) missing.push(name(id));
    out.push({
      name: name(id),
      type: 'line',
      data: d,
      connectNulls: false,
      showSymbol: true,
      lineStyle: { width: 2, color: SERIES[i] },
      itemStyle: { color: SERIES[i], borderColor: SERIES[i] },
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
      labelLayout: { moveOverlap: 'shiftY' },
      endLabel: ids.length <= 4 ? { show: true, formatter: () => name(id), color: INK, fontSize: 11, fontWeight: 500, distance: 6 } : undefined,
      z: 3,
    });
  });
  if (benchmark && ind.benchmarkSeries) {
    const label = ind.benchmarkId === 'EA' ? 'Euro area' : 'EU-27';
    out.push({
      name: label,
      type: 'line',
      data: toData(ind.benchmarkSeries),
      connectNulls: false,
      showSymbol: false,
      lineStyle: { width: 2.5, color: BENCHMARK_COLOR, type: 'solid', opacity: 0.85 },
      itemStyle: { color: BENCHMARK_COLOR },
      endLabel: { show: true, formatter: label, color: BENCHMARK_COLOR, fontSize: 11, fontWeight: 600, distance: 6 },
      labelLayout: { moveOverlap: 'shiftY' },
      z: 2,
    });
  }
  return { series: out, missing, mode: m };
}

export function lineOption(ind: Indicator, series: any[], xs: number[], unit: string, decimals: number): any {
  return {
    ...baseOption(),
    grid: { left: 8, right: 92, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: INK, fontSize: 12 } },
    tooltip: {
      ...baseOption().tooltip as object,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#b9b0a0' } },
      formatter: (ps: any[]) => {
        const y = ps[0]?.axisValue;
        const rows = ps
          .filter((p) => p.data && p.data.value)
          .sort((a, b) => b.data.value[1] - a.data.value[1])
          .map((p) => {
            const f = describeFlag(p.data.flag);
            return `<div style="display:flex;gap:10px;justify-content:space-between;align-items:center"><span>${p.marker}${p.seriesName}</span><b style="font-variant-numeric:tabular-nums">${fmt(p.data.value[1], decimals)}</b></div>${f.length ? `<div style="color:#6b7385;font-size:11px;margin:-2px 0 2px 16px">${f.join(', ')}</div>` : ''}`;
          })
          .join('');
        return `<div style="font-weight:600;margin-bottom:4px">${y}</div>${rows || '<span style="color:#6b7385">No data</span>'}<div style="color:#6b7385;font-size:11px;margin-top:4px">${unit}</div>`;
      },
    },
    xAxis: { type: 'category', data: xs.map(String), boundaryGap: false, ...axisCommon, splitLine: { show: false } },
    yAxis: { type: 'value', scale: ind.kind === 'level', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => fmt(v, Math.abs(v) < 10 && v % 1 ? 1 : 0) } },
    series,
  };
}

export default function TrendExplorer() {
  const { filters, set, indicator, countryName } = useApp();
  const xs = useMemo(() => years(filters.startYear, filters.endYear), [filters.startYear, filters.endYear]);
  const { series, missing, mode } = useMemo(
    () => lineSeries(indicator, filters.countries, filters.mode, filters.baseYear, xs, filters.benchmark, countryName),
    [indicator, filters.countries, filters.mode, filters.baseYear, xs, filters.benchmark, countryName],
  );
  const unit = modeUnit(indicator, mode, filters.baseYear);
  const option = useMemo(() => lineOption(indicator, series, xs, unit, indicator.decimals), [indicator, series, xs, unit]);
  const noBase = (mode === 'index' || mode === 'change') ? filters.countries.filter((id) => indicator.series[id] && !obsAt(indicator.series[id], filters.baseYear)).map(countryName) : [];

  return (
    <section id="trends" className="section" aria-labelledby="trends-title">
      <div className="section-head">
        <p className="eyebrow">Historical trends · {filters.startYear}–{filters.endYear}</p>
        <h2 id="trends-title">How have costs changed over two decades?</h2>
        <p className="lede">Compare countries over time. Switch to <em>Indexed</em> to see who has seen the fastest rise, whatever their starting level.</p>
      </div>
      <div className="tabs" role="tablist" aria-label="Theme">
        {THEMES.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filters.indicator === id} className={`tab ${filters.indicator === id ? 'on' : ''}`} onClick={() => set({ indicator: id })}>
            {label}
          </button>
        ))}
      </div>
      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <h3 className="chart-title">{indicator.label}{mode !== 'original' ? ` — ${MODE_LABELS[mode].toLowerCase()}${mode === 'change' || mode === 'index' ? ` ${filters.baseYear}` : ''}` : ''}</h3>
            <p className="chart-unit">{unit}</p>
          </div>
          <div className="chart-tools">
            <div className="seg seg-sm" role="radiogroup" aria-label="Values">
              {(Object.keys(MODE_LABELS) as ValueMode[]).map((m) => (
                <button key={m} role="radio" aria-checked={filters.mode === m} className={filters.mode === m ? 'on' : ''} disabled={!modeSupported(indicator, m)} onClick={() => set({ mode: m })}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <Info title={indicator.label}>
              <p>{indicator.explainer}</p>
              <p className="muted">{indicator.definition}</p>
              {indicator.caveat && <p className="caveat">{indicator.caveat}</p>}
            </Info>
          </div>
        </div>
        <EChart option={option} height={380} ariaLabel={`Line chart of ${indicator.label} for ${filters.countries.map(countryName).join(', ')}`} />
        <p className="caption">
          {indicator.explainer}
          {filters.mode !== mode && ' Indicator is already a rate of change, so original values are shown.'}
          {' '}Hollow points are provisional, estimated or mark a break in the series. Gaps mean the source has no observation — nothing is filled in.
        </p>
        {(missing.length > 0 || noBase.length > 0) && (
          <p className="notice">
            {missing.length > 0 && <>No data for {missing.join(', ')} on this measure. </>}
            {noBase.length > 0 && <>{noBase.join(', ')}: no observation in {filters.baseYear}, so the series cannot be rebased — try another base year.</>}
          </p>
        )}
      </div>
      <HeatStripes />
      <div className="sr-only">
        <table>
          <caption>{indicator.label} ({unit})</caption>
          <thead><tr><th>Country</th>{xs.map((y) => <th key={y}>{y}</th>)}</tr></thead>
          <tbody>
            {series.map((s: any) => (
              <tr key={s.name}><th>{s.name}</th>{s.data.map((d: any, i: number) => <td key={i}>{d ? fmt(d.value[1], indicator.decimals) : '—'}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HeatStripes() {
  const { data, filters, indicator, set, selectCountry, countryName } = useApp();
  const xs = years(Math.max(filters.startYear, indicator.coverage.first), Math.min(filters.endYear, indicator.coverage.last));
  const rows = data.countries
    .filter((c) => inRegion(c, filters.region) && indicator.series[c.id])
    .map((c) => {
      const s = indicator.series[c.id];
      const last = s[s.length - 1];
      return { id: c.id, s, sort: last[1] };
    })
    .sort((a, b) => a.sort - b.sort);
  const scale = colorScale(indicator);
  const cells: any[] = [];
  rows.forEach((r, ri) => xs.forEach((y, xi) => { const o = obsAt(r.s, y); if (o) cells.push({ value: [xi, ri, o[1]], flag: o[2] }); }));
  // ECharts heatmaps take their colours from a visualMap; reuse the map's bins exactly.
  const pieces = scale.bins.map((b) => ({ ...(b.from !== undefined ? { gte: b.from } : {}), ...(b.to !== undefined ? { lt: b.to } : {}), color: b.color }));
  const option: any = {
    ...baseOption(),
    grid: { left: 8, right: 12, top: 8, bottom: 28, containLabel: true },
    tooltip: {
      ...(baseOption().tooltip as object),
      formatter: (p: any) => {
        const [xi, ri, v] = p.data.value;
        const f = describeFlag(p.data.flag);
        return `<b>${countryName(rows[ri].id)}</b> · ${xs[xi]}<br/><span style="font-size:15px;font-weight:600">${fmt(v, indicator.decimals, indicator.unitShort)}</span>${f.length ? `<br/><span style="color:#6b7385">${f.join(', ')}</span>` : ''}`;
      },
    },
    xAxis: { type: 'category', data: xs.map(String), ...axisCommon, axisLine: { show: false }, splitLine: { show: false } },
    yAxis: { type: 'category', data: rows.map((r) => countryName(r.id)), ...axisCommon, axisLine: { show: false }, splitLine: { show: false }, axisLabel: { ...axisCommon.axisLabel, color: INK_3, fontSize: 11 } },
    visualMap: { type: 'piecewise', show: false, dimension: 2, pieces, outOfRange: { color: NO_DATA } },
    series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: '#fffdf8', borderWidth: 1.5, borderRadius: 2 }, emphasis: { itemStyle: { borderColor: INK, borderWidth: 1.5 } }, progressive: 0 }],
  };
  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">Every country, every year: {indicator.short.toLowerCase()}</h3>
          <p className="chart-unit">{indicator.unit} · same colour scale as the map · sorted by latest value</p>
        </div>
      </div>
      {rows.length ? (
        <EChart renderer="svg" option={option} height={Math.max(220, rows.length * 19 + 50)} ariaLabel={`Heatmap of ${indicator.label} by country and year`} onClick={(p) => { if (p.data) { selectCountry(rows[p.data.value[1]].id); set({ year: xs[p.data.value[0]] }); } }} />
      ) : (
        <p className="empty">No country in this region has data on this measure.</p>
      )}
      <p className="caption">Each row is a country, each square a year. Blank squares are missing observations (<span className="inline-swatch" style={{ background: NO_DATA }} /> not zero). Click a square to show that country and year on the map.</p>
    </div>
  );
}
