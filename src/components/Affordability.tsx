import { useState } from 'react';
import { useApp } from '../lib/state';
import { defaultYear, describeFlag, fmt, fmtSigned, fmtValue, inRegion, obsAt, transform } from '../lib/data';
import { SERIES } from '../lib/scales';
import type { Indicator } from '../lib/types';
import EChart, { axisCommon, baseOption, INK, INK_3 } from './EChart';
import Flag from './Flag';
import { years } from './TrendExplorer';

const RANK = ['overburden', 'housing_cost_share', 'pti', 'hpi_growth', 'rent_growth', 'pli_housing', 'median_income_pps'];

const METRICS: { id: string; title: string; body: string }[] = [
  { id: 'pti', title: 'House price-to-income ratio', body: 'Are homes rising faster than what people earn? Above 100 means homes are less affordable relative to income than in 2015.' },
  { id: 'housing_cost_share', title: 'Housing costs as a share of income', body: 'The slice of a typical household’s income that goes on rent or mortgage interest, utilities and upkeep.' },
  { id: 'hpi', title: 'House price index & growth', body: 'How fast prices move. An index of 150 means prices are 50% higher than in 2015 — it is not the price of a home.' },
  { id: 'rent_index', title: 'Rent price index & growth', body: 'How fast rents paid by tenants are rising, from the official consumer price index.' },
  { id: 'overburden', title: 'Housing cost overburden', body: 'The share of people spending more than 40% of their disposable income on housing. Higher means more housing stress.' },
  { id: 'aic_pps', title: 'Purchasing power', body: 'How much people can actually consume after adjusting for price differences, compared with the EU average (100).' },
];

export default function Affordability() {
  return (
    <section id="affordability" className="section" aria-labelledby="aff-title">
      <div className="section-head">
        <p className="eyebrow">Housing affordability</p>
        <h2 id="aff-title">Can people afford a home?</h2>
        <p className="lede">No single number answers this. Read these measures together: price growth tells you about momentum, income ratios about affordability, and the overburden rate about real hardship.</p>
      </div>
      <div className="explainers">
        {METRICS.map((m) => <Explainer key={m.id} {...m} />)}
      </div>
      <p className="callout callout-accent">
        <strong>An index is not a price.</strong> If Hungary's house price index is far higher than Italy's, that does not mean homes cost more in Hungary. It means
        prices in Hungary have risen further since 2015. Official, comparable prices per square metre do not exist for most of Europe.
      </p>
      <KeptUp />
      <div className="aff-grid">
        <Ranking />
        <PriceVsWealth />
      </div>
    </section>
  );
}

function Explainer({ id, title, body }: { id: string; title: string; body: string }) {
  const { ind, set } = useApp();
  const i = ind(id);
  return (
    <article className="explainer">
      <h3>{title}</h3>
      <p>{body}</p>
      <p className="explainer-foot">
        {i.coverage.countries} countries · {i.coverage.first}–{i.coverage.last}
        <button className="linklike" onClick={() => { set({ indicator: id }); document.getElementById('map')?.scrollIntoView({ behavior: 'smooth' }); }}>Show on map →</button>
      </p>
    </article>
  );
}

function Ranking() {
  const { data, filters, ind, selectCountry, countryName } = useApp();
  const [metric, setMetric] = useState('overburden');
  const [order, setOrder] = useState<'affordable' | 'expensive'>('affordable');
  const indicator = ind(metric);
  const year = obsYear(indicator, filters.year);
  const rows = data.countries
    .filter((c) => inRegion(c, filters.region))
    .map((c) => ({ id: c.id, o: obsAt(indicator.series[c.id], year) }))
    .filter((r) => r.o);
  // "Most affordable": lowest cost measure, or highest income measure.
  const better = (a: number, b: number) => (indicator.polarity === 'benefit' ? b - a : a - b);
  rows.sort((a, b) => (order === 'affordable' ? better(a.o![1], b.o![1]) : -better(a.o![1], b.o![1])));
  const total = data.countries.filter((c) => inRegion(c, filters.region)).length;
  const bench = indicator.benchmarkSeries ? obsAt(indicator.benchmarkSeries, year) : undefined;
  const selected = new Map(filters.countries.map((id, i) => [id, SERIES[i]]));

  const option: any = {
    ...baseOption(),
    grid: { left: 4, right: 48, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...(baseOption().tooltip as object),
      formatter: (p: any) => {
        const r = rows[p.dataIndex];
        const f = describeFlag(r.o![2]);
        return `<b>${p.dataIndex + 1}. ${countryName(r.id)}</b><br/>${fmtValue(indicator, r.o![1])} <span style="color:#6b7385">${indicator.unit}</span>${f.length ? `<br/><span style="color:#6b7385">${f.join(', ')}</span>` : ''}`;
      },
    },
    xAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => fmt(v, 0) } },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => countryName(r.id)), ...axisCommon, splitLine: { show: false }, axisLabel: { ...axisCommon.axisLabel, color: INK, fontSize: 11 } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 12,
        data: rows.map((r) => ({ value: r.o![1], itemStyle: { color: selected.get(r.id) ?? '#a9bcd2', borderRadius: [0, 3, 3, 0] } })),
        label: { show: true, position: 'right', color: INK_3, fontSize: 10, formatter: (p: any) => fmt(p.value, indicator.decimals) },
        markLine: bench ? { symbol: 'none', silent: true, lineStyle: { color: '#2b2f3a', width: 1.5, type: 'solid' }, label: { formatter: indicator.benchmarkId === 'EA' ? 'Euro area' : 'EU-27', color: INK, fontSize: 10, position: 'end' }, data: [{ xAxis: bench[1] }] } : undefined,
      },
    ],
  };

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">Affordability ranking, {year}</h3>
          <p className="chart-unit">{indicator.label} · {indicator.unit}</p>
        </div>
        <div className="seg seg-sm" role="radiogroup" aria-label="Order">
          <button role="radio" aria-checked={order === 'affordable'} className={order === 'affordable' ? 'on' : ''} onClick={() => setOrder('affordable')}>Most affordable first</button>
          <button role="radio" aria-checked={order === 'expensive'} className={order === 'expensive' ? 'on' : ''} onClick={() => setOrder('expensive')}>Least affordable first</button>
        </div>
      </div>
      <div className="pills" role="toolbar" aria-label="Ranking measure">
        {RANK.map((k) => (
          <button key={k} className={`pill sm ${metric === k ? 'on' : ''}`} aria-pressed={metric === k} onClick={() => setMetric(k)}>{ind(k).short}</button>
        ))}
      </div>
      <EChart option={option} height={Math.max(240, rows.length * 18 + 30)} ariaLabel={`Ranking of countries by ${indicator.label}`} onClick={(p) => rows[p.dataIndex] && selectCountry(rows[p.dataIndex].id)} />
      <p className="caption">
        <strong>How the ranking works:</strong> {indicator.polarity === 'benefit' ? 'higher' : 'lower'} values count as more affordable. Covers {rows.length} of {total} countries in the selected region for {year}
        {year !== filters.year ? ` (the latest year with wide coverage for this measure; ${filters.year} is not yet available)` : ''}. Countries without data are left out, not ranked last.
        {indicator.kind === 'level' && indicator.indexBase ? ` This index ranks change since ${indicator.indexBase}, not price levels.` : ''}
      </p>
    </div>
  );
}

function obsYear(ind: Indicator, wanted: number): number {
  const counts = Object.values(ind.series).filter((s) => obsAt(s, wanted)).length;
  return counts >= ind.coverage.countries * 0.6 ? wanted : defaultYear(ind);
}

function KeptUp() {
  const { filters, ind, countryName, set } = useApp();
  const id = filters.focus ?? filters.countries[0];
  const parts: [string, string][] = [
    ['hpi', 'House prices'],
    ['rent_index', 'Rents'],
    ['hicp_index', 'Consumer prices'],
    ['median_income_nac', 'Median income'],
  ];
  // If the chosen base year predates some of this country's data (e.g. Albania's income
  // survey starts in 2017), move the base to the first year covering the most series.
  const has = (y: number) => parts.filter(([k]) => obsAt(ind(k).series[id ?? ''], y)).length;
  const span = years(filters.baseYear, filters.endYear - 1);
  const best = Math.max(0, ...span.map(has));
  const base = has(filters.baseYear) === best ? filters.baseYear : span.find((y) => has(y) === best) ?? filters.baseYear;
  const xs = years(Math.max(filters.startYear, 2005, base - 3), filters.endYear);
  const series = parts.map(([k, label], i) => {
    const t = transform(ind(k).series[id ?? ''], ind(k), 'index', base);
    return {
      name: label,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 2, color: SERIES[i] },
      itemStyle: { color: SERIES[i] },
      endLabel: { show: true, formatter: label, color: INK, fontSize: 11, distance: 6 },
      data: xs.map((y) => { const o = obsAt(t, y); return o ? [String(y), o[1]] : null; }),
    };
  });
  const empty = series.filter((s) => !s.data.some(Boolean)).map((s) => s.name);
  const option: any = {
    ...baseOption(),
    grid: { left: 8, right: 108, top: 32, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: INK, fontSize: 12 } },
    tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (v: number) => fmt(v, 1) },
    xAxis: { type: 'category', data: xs.map(String), boundaryGap: false, ...axisCommon, splitLine: { show: false } },
    yAxis: { type: 'value', scale: true, ...axisCommon },
    series: [
      ...series,
      { type: 'line', data: [], markLine: { symbol: 'none', silent: true, lineStyle: { color: '#b9b0a0', width: 1, type: 'solid' }, label: { show: false }, data: [{ yAxis: 100 }] } },
    ],
  };
  const hp = ind('hpi'), inc = ind('median_income_nac');
  const a = obsAt(hp.series[id ?? ''], base), b = hp.series[id ?? '']?.at(-1);
  const c = obsAt(inc.series[id ?? ''], base), d = inc.series[id ?? '']?.at(-1);
  const gap = a && b && c && d ? (b[1] / a[1] - 1) * 100 - (d[1] / c[1] - 1) * 100 : undefined;

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">{id ? <><Flag id={id} /> {countryName(id)}:</> : null} prices vs pay since {base}</h3>
          <p className="chart-unit">Index, {base} = 100</p>
        </div>
        <div className="pills">
          {filters.countries.map((c) => (
            <button key={c} className={`pill sm ${c === id ? 'on' : ''}`} onClick={() => set({ focus: c })}><Flag id={c} /> {c}</button>
          ))}
        </div>
      </div>
      <EChart option={option} height={340} ariaLabel={`House prices, rents, consumer prices and median income indexed to ${base}`} />
      <p className="caption">
        {gap !== undefined
          ? <>Since {base}, house prices in {countryName(id!)} have grown <strong>{fmtSigned(gap, 0, ' percentage points')}</strong> {gap > 0 ? 'faster' : 'slower'} than median income (to {b![0]} and {d![0]}).</>
          : 'Not every series is available for this country and base year.'}
        {empty.length > 0 && ` No data: ${empty.join(', ')}.`}
        {base !== filters.baseYear && ` The base year was moved from ${filters.baseYear} to ${base} because ${countryName(id!)}'s data start later.`} Income is median equivalised household income in national currency (EU-SILC), so it compares the country with itself.
      </p>
    </div>
  );
}

function PriceVsWealth() {
  const { data, filters, ind, countryName, selectCountry } = useApp();
  const pli = ind('pli'), aic = ind('aic_pps');
  const year = Math.min(filters.year, pli.coverage.last, aic.coverage.last);
  const groups: [string, string, (c: (typeof data.countries)[number]) => boolean][] = [
    ['Western Balkans', SERIES[1], (c) => c.wb],
    ['EU member states', SERIES[0], (c) => c.eu],
    ['Other European countries', SERIES[2], (c) => !c.eu && !c.wb],
  ];
  const pts = (test: (c: (typeof data.countries)[number]) => boolean) =>
    data.countries.filter((c) => test(c) && inRegion(c, filters.region)).flatMap((c) => {
      const x = obsAt(aic.series[c.id], year)?.[1];
      const y = obsAt(pli.series[c.id], year)?.[1];
      return x !== undefined && y !== undefined ? [{ value: [x, y], id: c.id, name: countryName(c.id) }] : [];
    });
  const series = groups.map(([name, color, test]) => ({
    name,
    type: 'scatter',
    symbolSize: (_: any, p: any) => (filters.countries.includes(p.data.id) ? 13 : 9),
    itemStyle: { color, borderColor: '#fffdf8', borderWidth: 1.5, opacity: 0.9 },
    label: { show: true, formatter: (p: any) => p.data.id, position: 'right', color: INK_3, fontSize: 10 },
    emphasis: { scale: 1.4, label: { color: INK, fontWeight: 600 } },
    data: pts(test),
  }));
  const option: any = {
    ...baseOption(),
    grid: { left: 8, right: 24, top: 36, bottom: 28, containLabel: true },
    legend: { top: 0, right: 0, textStyle: { color: INK, fontSize: 12 } },
    tooltip: { ...(baseOption().tooltip as object), formatter: (p: any) => `<b>${p.data.name}</b>, ${year}<br/>Consumption per person: <b>${p.data.value[0]}</b> (EU = 100)<br/>Price level: <b>${p.data.value[1]}</b> (EU = 100)` },
    xAxis: { type: 'value', name: 'Consumption per person in purchasing power (EU-27 = 100) →', nameLocation: 'middle', nameGap: 26, scale: true, ...axisCommon },
    yAxis: { type: 'value', name: 'Price level (EU-27 = 100)', nameLocation: 'end', scale: true, ...axisCommon },
    series: [
      ...series,
      { type: 'scatter', data: [], markLine: { symbol: 'none', silent: true, lineStyle: { color: '#b9b0a0', width: 1, type: 'solid' }, label: { formatter: 'EU average', color: INK_3, fontSize: 10, position: 'insideEndTop' }, data: [{ xAxis: 100 }, { yAxis: 100 }] } },
    ],
  };
  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">Cheaper, but poorer? Prices and living standards, {year}</h3>
          <p className="chart-unit">Both axes: EU-27 = 100 · Eurostat purchasing power parities</p>
        </div>
      </div>
      <EChart option={option} height={420} ariaLabel={`Scatter plot of price levels against consumption per person, ${year}`} onClick={(p) => p.data?.id && selectCountry(p.data.id)} />
      <p className="caption">
        Countries to the bottom-left are cheap but households can afford less; top-right are expensive but richer. Western Balkan prices sit well below the EU
        average, but so does what people can consume. Kosovo, Ukraine, Moldova and Belarus are not covered by Eurostat's purchasing power programme for this measure.
      </p>
    </div>
  );
}
