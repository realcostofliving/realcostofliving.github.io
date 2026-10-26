import { useMemo } from 'react';
import { useApp } from '../lib/state';
import { describeFlag, fmt, fmtSigned, obsAt, periodLabel } from '../lib/data';
import { BENCHMARK_COLOR, SERIES } from '../lib/scales';
import EChart, { axisCommon, baseOption, INK } from './EChart';
import Flag from './Flag';
import { years } from './TrendExplorer';

const PLI: [string, string][] = [
  ['pli', 'All household consumption'],
  ['pli_food', 'Food'],
  ['pli_housing', 'Housing, water & energy'],
  ['pli_energy', 'Electricity, gas & fuels'],
  ['pli_transport', 'Transport'],
  ['pli_restaurants', 'Restaurants & hotels'],
];
const CPI: [string, string][] = [
  ['inflation', 'All items'],
  ['food_inflation', 'Food'],
  ['energy_inflation', 'Household energy'],
  ['transport_inflation', 'Transport'],
  ['housing_util_inflation', 'Housing & utilities'],
  ['rent_growth', 'Rents'],
];

export default function CostOfLiving() {
  return (
    <section id="cost-of-living" className="section" aria-labelledby="col-title">
      <div className="section-head">
        <p className="eyebrow">Cost of living</p>
        <h2 id="col-title">What everyday life costs</h2>
        <p className="lede">Two different questions, two different tools.</p>
      </div>
      <div className="two-up">
        <div className="callout">
          <strong>How expensive is a country right now?</strong> Use <em>price level indices</em>, built from purchasing power parities. They compare the cost of
          the same basket across countries in one year, with the EU average set to 100.
        </div>
        <div className="callout">
          <strong>How fast are prices rising?</strong> Use <em>inflation</em> from consumer price indices. They compare a country with its own past and say nothing
          about whether it is cheap or expensive.
        </div>
      </div>
      <PriceLevels />
      <CategoryInflation />
    </section>
  );
}

function PriceLevels() {
  const { filters, ind, countryName } = useApp();
  const ids = filters.countries;
  const year = Math.min(filters.year, ind('pli').coverage.last);
  const option = useMemo(() => {
    const cats = PLI.map(([, l]) => l);
    const series: any[] = ids.map((id, i) => ({
      name: countryName(id),
      type: 'scatter',
      symbolSize: 12,
      itemStyle: { color: SERIES[i], borderColor: '#fffdf8', borderWidth: 2 },
      data: PLI.map(([k], ci) => {
        const s = ind(k).series[id];
        let o = obsAt(s, year);
        if (!o && s) o = [...s].reverse().find((x) => x[0] < year);
        return o ? { value: [o[1], ci], y: o[0], flag: o[2] } : null;
      }),
      z: 3,
    }));
    // A thin range line per category to read the spread between selected countries.
    const ranges = PLI.map(([k], ci) => {
      const vals = ids.map((id) => obsAt(ind(k).series[id], year)?.[1]).filter((v): v is number => v !== undefined);
      return vals.length > 1 ? [[Math.min(...vals), ci], [Math.max(...vals), ci]] : null;
    });
    series.unshift({
      type: 'line',
      silent: true,
      showSymbol: false,
      lineStyle: { color: '#d8d0c2', width: 4, cap: 'round' },
      data: ranges.flatMap((r) => (r ? [...r, null] : [null])),
      connectNulls: false,
      z: 1,
      tooltip: { show: false },
    });
    return {
      ...baseOption(),
      grid: { left: 8, right: 24, top: 36, bottom: 24, containLabel: true },
      legend: { top: 0, left: 0, data: ids.map(countryName), textStyle: { color: INK, fontSize: 12 } },
      tooltip: {
        ...(baseOption().tooltip as object),
        formatter: (p: any) => {
          if (!p.data) return '';
          const f = describeFlag(p.data.flag);
          return `<b>${p.seriesName}</b> · ${cats[p.data.value[1]]}<br/>Price level: <b>${fmt(p.data.value[0], 0)}</b> (EU-27 = 100), ${p.data.y}${f.length ? `<br/><span style="color:#6b7385">${f.join(', ')}</span>` : ''}`;
        },
      },
      xAxis: { type: 'value', scale: true, ...axisCommon },
      yAxis: { type: 'category', data: cats, inverse: true, ...axisCommon, splitLine: { show: true, lineStyle: { color: '#efe9de' } }, axisLabel: { ...axisCommon.axisLabel, color: INK, fontSize: 12 } },
      series: [
        ...series,
        { type: 'line', data: [], markLine: { symbol: 'none', silent: true, lineStyle: { color: BENCHMARK_COLOR, width: 1.5, type: 'solid' }, label: { formatter: 'EU average', color: INK, fontSize: 10, position: 'insideEndTop' }, data: [{ xAxis: 100 }] } },
      ],
    };
  }, [ids, year, ind, countryName]);
  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">How expensive is it? Price levels by category, {year}</h3>
          <p className="chart-unit">Price level index, EU-27 = 100 · Eurostat–OECD purchasing power parities</p>
        </div>
      </div>
      <EChart option={option} height={360} ariaLabel={`Price levels by category for ${ids.map(countryName).join(', ')}`} />
      <p className="caption">
        A value of 50 means that category costs about half the EU average. Purchasing power parities are published with a lag, so the latest year is {ind('pli').coverage.last}.
        Kosovo lacks some categories and Ukraine, Moldova and Belarus are not covered.
      </p>
    </div>
  );
}

function CategoryInflation() {
  const { filters, ind, countryName, set } = useApp();
  const id = filters.focus ?? filters.countries[0];
  const xs = years(Math.max(filters.startYear, 2005), Math.min(filters.endYear, 2025));
  const series = CPI.map(([k, label], i) => ({
    name: label,
    type: 'line',
    showSymbol: false,
    connectNulls: false,
    lineStyle: { width: k === 'inflation' ? 2.5 : 1.75, color: k === 'inflation' ? BENCHMARK_COLOR : SERIES[i - 1] },
    itemStyle: { color: k === 'inflation' ? BENCHMARK_COLOR : SERIES[i - 1] },
    data: xs.map((y) => { const o = obsAt(ind(k).series[id], y); return o ? [String(y), o[1]] : null; }),
  }));
  const available = series.filter((s) => s.data.some(Boolean));
  const option: any = {
    ...baseOption(),
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 14, itemHeight: 4, textStyle: { color: INK, fontSize: 12 } },
    tooltip: { ...(baseOption().tooltip as object), trigger: 'axis', valueFormatter: (v: number) => fmtSigned(v, 1, '%') },
    xAxis: { type: 'category', data: xs.map(String), boundaryGap: false, ...axisCommon, splitLine: { show: false } },
    yAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${v}%` } },
    series: available,
  };
  const latest = CPI.map(([k, label]) => ({ label, o: ind(k).latest?.[id], b: ind(k).latestBenchmark })).filter((x) => x.o);

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title"><Flag id={id} /> {countryName(id)}: what is driving inflation?</h3>
          <p className="chart-unit">Annual average % change, harmonised index of consumer prices (HICP)</p>
        </div>
        <div className="pills">
          {filters.countries.map((c) => (
            <button key={c} className={`pill sm ${c === id ? 'on' : ''}`} onClick={() => set({ focus: c })}><Flag id={c} /> {c}</button>
          ))}
        </div>
      </div>
      {available.length > 1 ? (
        <EChart option={option} height={340} ariaLabel={`Inflation by category for ${countryName(id)}`} />
      ) : (
        <p className="empty">
          {countryName(id)} does not publish a harmonised consumer price index with category detail to Eurostat. Only overall inflation (national CPI via the World Bank) is
          available — see the trend explorer.
        </p>
      )}
      {latest.length > 0 && (
        <div className="latest-strip">
          <span className="eyebrow">2026 so far</span>
          {latest.map(({ label, o, b }) => (
            <span key={label} className="latest-item">
              {label} <b>{fmtSigned(o!.v, 1, '%')}</b>
              {b && filters.benchmark && <span className="muted"> (EU {fmtSigned(b.v, 1, '%')})</span>}
            </span>
          ))}
          <span className="muted small">Year-on-year, {periodLabel(latest[0].o!.p)}</span>
        </div>
      )}
    </div>
  );
}
