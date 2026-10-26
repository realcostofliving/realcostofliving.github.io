import { useMemo } from 'react';
import { useApp } from '../lib/state';
import { describeFlag, fmtSigned, fmtValue, obsAt } from '../lib/data';
import { BENCHMARK_COLOR, SERIES } from '../lib/scales';
import type { Indicator, Obs } from '../lib/types';
import EChart, { axisCommon, baseOption, INK } from './EChart';
import CountryPicker from './CountryPicker';
import Flag from './Flag';
import { lineOption, lineSeries, years } from './TrendExplorer';
import { t } from '../lib/i18n';

const TABLE = ['hpi_growth', 'rent_growth', 'pti', 'median_income_pps', 'aic_pps', 'inflation', 'housing_cost_share', 'overburden'];
const MULTIPLES: [string, 'index' | 'original', string][] = [
  ['hpi', 'index', 'House prices'],
  ['rent_index', 'index', 'Rents'],
  ['inflation', 'original', 'Inflation'],
  ['median_income_pps', 'original', 'Median income (PPS)'],
];
const GROWTH: [string, string][] = [
  ['hpi', 'House prices'],
  ['rent_index', 'Rents'],
  ['hicp_index', 'Consumer prices'],
  ['median_income_nac', 'Median income'],
];

/** Observation at `year`, or the latest one before it. */
function atOrBefore(s: Obs[] | undefined, year: number): Obs | undefined {
  if (!s) return undefined;
  let r: Obs | undefined;
  for (const o of s) if (o[0] <= year) r = o;
  return r;
}

export function pctChange(ind: Indicator, id: string, from: number, to: number): { v: number; from: number; to: number } | undefined {
  const s = ind.series[id];
  const a = obsAt(s, from);
  const b = atOrBefore(s, to);
  if (!a || !b || b[0] <= from) return undefined;
  return { v: (b[1] / a[1] - 1) * 100, from, to: b[0] };
}

/**
 * Start year for one country in the "did incomes keep up" chart: the chosen base year if the
 * country has its measures then, otherwise the first later year that covers the most of them
 * (e.g. Albania's rents start in 2016 and its income survey in 2017). All of a country's bars
 * use the same start year so they stay comparable with each other.
 */
export function startYearFor(ind: (id: string) => Indicator, id: string, base: number, end: number): number {
  const count = (y: number) => GROWTH.filter(([k]) => obsAt(ind(k).series[id], y)).length;
  let best = base, bestN = count(base);
  for (let y = base + 1; y < end; y++) { const n = count(y); if (n > bestN) { best = y; bestN = n; } }
  return best;
}

export default function Comparison() {
  const { filters, ind, countryName } = useApp();
  const ids = filters.countries;
  const base = filters.baseYear;
  const end = filters.endYear;

  const starts = useMemo(() => new Map(ids.map((id) => [id, startYearFor(ind, id, base, end)])), [ids, ind, base, end]);
  const shifted = ids.filter((id) => starts.get(id) !== base);

  const growthOption = useMemo(() => {
    const series = ids.map((id, i) => ({
      name: starts.get(id) !== base ? `${countryName(id)} (${t('from {year}', { year: starts.get(id)! })})` : countryName(id),
      type: 'bar',
      barMaxWidth: 22,
      barGap: '12%',
      itemStyle: { color: SERIES[i], borderRadius: [3, 3, 0, 0] },
      data: GROWTH.map(([k]) => {
        const c = pctChange(ind(k), id, starts.get(id)!, end);
        return c ? { value: c.v, from: c.from, to: c.to } : null;
      }),
    }));
    return {
      ...baseOption(),
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: INK, fontSize: 12 } },
      tooltip: {
        ...(baseOption().tooltip as object),
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(29,42,68,0.05)' } },
        formatter: (ps: any[]) =>
          `<b>${ps[0].axisValue}</b><br/>` +
          ps.map((p) => `${p.marker}${countryName(ids[p.seriesIndex])}: <b>${p.data ? fmtSigned(p.data.value, 0, '%') : t('no data')}</b>${p.data ? ` <span style="color:#6b7385">${p.data.from}–${p.data.to}</span>` : ''}`).join('<br/>'),
      },
      xAxis: { type: 'category', data: GROWTH.map(([, l]) => t(l)), ...axisCommon, splitLine: { show: false }, axisLabel: { ...axisCommon.axisLabel, color: INK, fontSize: 12 } },
      yAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${v}%` } },
      series,
    };
  }, [ids, base, end, ind, countryName, starts]);

  return (
    <section id="compare" className="section" aria-labelledby="compare-title">
      <div className="section-head">
        <p className="eyebrow">{t('Country comparison')}</p>
        <h2 id="compare-title">{t('Side by side')}</h2>
        <p className="lede">{t('Choose two to five countries — put a Balkan country next to Belgium, Germany, France or Austria and see how their paths differ.')}</p>
      </div>
      <div className="card picker-card">
        <CountryPicker min={1} />
        {ids.length < 2 && <p className="notice">{t('Add at least one more country to compare.')}</p>}
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <h3 className="chart-title">{t('Did incomes keep up? Change {from} to {to}', { from: base, to: end })}</h3>
            <p className="chart-unit">{t('% change in each index over the period · base year and period set in the filter bar')}</p>
          </div>
        </div>
        <EChart option={growthOption} height={320} ariaLabel={t('Bar chart comparing growth in house prices, rents, consumer prices and income since {year}', { year: base })} />
        <p className="caption">
          {t('Each bar compares a country with its own past, so differences in currencies and price levels cancel out. Income growth uses median household income in national currency (EU-SILC). If a series ends before {year}, the latest year is used and shown in the tooltip.', { year: end })}
          {shifted.length > 0 && (
            <>
              {' '}
              <strong>
                {shifted.map((id) => t('{country} is measured from {year}', { country: countryName(id), year: starts.get(id)! })).join('; ')}
              </strong>{' '}
              {t('because its official series start after {year} (for Albania: rents and consumer prices from 2016, the EU income survey from 2017). Its bars cover a shorter period than the others.', { year: base })}
            </>
          )}
          {' '}{t('A missing bar means that measure has no data for the country.')}
        </p>
      </div>

      <ComparisonTable />

      <div className="multiples">
        {MULTIPLES.map(([k, mode, title]) => <Multiple key={k} indicator={ind(k)} mode={mode} title={title} />)}
      </div>
      <p className="callout">
        <strong>{t('Why these charts use indices, not euros.')}</strong>{' '}
        {t('Official house price indices measure how prices change within each country; they are not prices per square metre and they cover different housing markets. Use them to compare speed of change. For actual prices in euros, see “Home prices (€ per m²)” on the map, in the table and in the calculator — those come from the Deloitte Property Index and are not official statistics.')}
      </p>
    </section>
  );
}

function MultipleNote({ indicator, mode }: { indicator: Indicator; mode: 'index' | 'original' }) {
  const { filters, countryName } = useApp();
  const notes = filters.countries.flatMap((id) => {
    const s = indicator.series[id];
    if (!s?.length) return [`${countryName(id)}: ${t('no data')}`];
    if (mode === 'index' && !obsAt(s, filters.baseYear)) return [`${countryName(id)}: ${t('starts {year}, so it can’t be indexed to {base}', { year: s[0][0], base: filters.baseYear })}`];
    return [];
  });
  return notes.length ? <p className="multiple-note">{notes.join(' · ')}</p> : null;
}

function Multiple({ indicator, mode, title }: { indicator: Indicator; mode: 'index' | 'original'; title: string }) {
  const { filters, countryName } = useApp();
  const xs = years(filters.startYear, Math.min(filters.endYear, indicator.coverage.last));
  const { series } = lineSeries(indicator, filters.countries, mode, filters.baseYear, xs, filters.benchmark, countryName);
  series.forEach((s: any) => (s.endLabel = undefined));
  const unit = mode === 'index' ? t('Index, {year} = 100', { year: filters.baseYear }) : indicator.unit;
  const opt = lineOption(indicator, series, xs, unit, indicator.decimals);
  opt.legend = { show: false };
  opt.grid = { left: 4, right: 12, top: 12, bottom: 4, containLabel: true };
  return (
    <div className="card multiple">
      <h3 className="chart-title sm">{t(title)}</h3>
      <p className="chart-unit">{unit}</p>
      <EChart option={opt} height={190} ariaLabel={t('{name} for selected countries', { name: t(title) })} />
      <MultipleNote indicator={indicator} mode={mode} />
    </div>
  );
}

function ComparisonTable() {
  const { filters, ind, countryName, set } = useApp();
  const ids = filters.countries;
  return (
    <div className="card table-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">{t('Key figures, {year}', { year: filters.year })}</h3>
          <p className="chart-unit">{t('Where a country has no value for {year}, the latest earlier year is shown in small type', { year: filters.year })}</p>
        </div>
      </div>
      <div className="table-scroll">
        <table className="cmp">
          <thead>
            <tr>
              <th scope="col">{t('Measure')}</th>
              {ids.map((id, i) => (
                <th key={id} scope="col">
                  <span className="swatch" style={{ background: SERIES[i] }} /> <Flag id={id} /> {countryName(id)}
                </th>
              ))}
              {filters.benchmark && <th scope="col"><span className="swatch" style={{ background: BENCHMARK_COLOR }} /> <Flag id="EU27" /> {t('Benchmark')}</th>}
            </tr>
          </thead>
          <tbody>
            {TABLE.map((k) => {
              const indicator = ind(k);
              const cell = (s: Obs[] | null | undefined) => {
                const o = atOrBefore(s ?? undefined, filters.year);
                if (!o) return <span className="na">—</span>;
                const f = describeFlag(o[2]);
                return (
                  <>
                    {indicator.kind === 'rate' ? fmtSigned(o[1], indicator.decimals, indicator.unitShort) : fmtValue(indicator, o[1])}
                    {o[0] !== filters.year && <span className="yr">{o[0]}</span>}
                    {f.length > 0 && <span className="flagmark" title={f.join(', ')}>{o[2]![0]}</span>}
                  </>
                );
              };
              return (
                <tr key={k}>
                  <th scope="row">
                    <button className="linklike" onClick={() => set({ indicator: k })}>{indicator.label}</button>
                    <span className="unit">{indicator.unit}</span>
                  </th>
                  {ids.map((id) => <td key={id}>{cell(indicator.series[id])}</td>)}
                  {filters.benchmark && <td>{cell(indicator.benchmarkSeries)}{indicator.benchmarkSeries && <span className="yr">{indicator.benchmarkId === 'EA' ? 'EA' : 'EU-27'}</span>}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="caption">{t('Small letters mark status flags from the source: p = provisional, e = estimated, b = break in series, u = low reliability, d = definition differs.')}</p>
    </div>
  );
}
