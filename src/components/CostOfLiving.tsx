import { useMemo } from 'react';
import { useApp } from '../lib/state';
import { describeFlag, fmt, fmtSigned, obsAt, periodLabel } from '../lib/data';
import { BENCHMARK_COLOR, SERIES } from '../lib/scales';
import EChart, { axisCommon, baseOption, INK } from './EChart';
import Flag from './Flag';
import { t } from '../lib/i18n';
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
        <p className="eyebrow">{t('Cost of living')}</p>
        <h2 id="col-title">{t('What everyday life costs')}</h2>
        <p className="lede">{t('Two different questions, two different tools.')}</p>
      </div>
      <div className="two-up">
        <div className="callout">
          <strong>{t('How expensive is a country right now?')}</strong>{' '}
          {t('Use price level indices, built from purchasing power parities. They compare the cost of the same basket across countries in one year, with the EU average set to 100.')}
        </div>
        <div className="callout">
          <strong>{t('How fast are prices rising?')}</strong>{' '}
          {t('Use inflation from consumer price indices. They compare a country with its own past and say nothing about whether it is cheap or expensive.')}
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
    const cats = PLI.map(([, l]) => t(l));
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
          return `<b>${p.seriesName}</b> · ${cats[p.data.value[1]]}<br/>${t('Price level')}: <b>${fmt(p.data.value[0], 0)}</b> (${t('EU = 100')}), ${p.data.y}${f.length ? `<br/><span style="color:#6b7385">${f.join(', ')}</span>` : ''}`;
        },
      },
      xAxis: { type: 'value', scale: true, ...axisCommon },
      yAxis: { type: 'category', data: cats, inverse: true, ...axisCommon, splitLine: { show: true, lineStyle: { color: '#efe9de' } }, axisLabel: { ...axisCommon.axisLabel, color: INK, fontSize: 12 } },
      series: [
        ...series,
        { type: 'line', data: [], markLine: { symbol: 'none', silent: true, lineStyle: { color: BENCHMARK_COLOR, width: 1.5, type: 'solid' }, label: { formatter: t('EU average'), color: INK, fontSize: 10, position: 'insideEndTop' }, data: [{ xAxis: 100 }] } },
      ],
    };
  }, [ids, year, ind, countryName]);
  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title">{t('How expensive is it? Price levels by category, {year}', { year })}</h3>
          <p className="chart-unit">{t('Price level index, EU average = 100 · purchasing power parities from Eurostat and the OECD')}</p>
        </div>
      </div>
      <EChart option={option} height={360} ariaLabel={t('Price levels by category for {countries}', { countries: ids.map(countryName).join(', ') })} />
      <p className="caption">
        {t('A value of 50 means that category costs about half the EU average. Purchasing power parities are published with a lag, so the latest year is {year}. Kosovo lacks some categories and Ukraine, Moldova and Belarus are not covered.', { year: ind('pli').coverage.last })}
      </p>
    </div>
  );
}

function CategoryInflation() {
  const { filters, ind, countryName, set } = useApp();
  const id = filters.focus ?? filters.countries[0];
  const xs = years(Math.max(filters.startYear, 2005), Math.min(filters.endYear, 2025));
  const series = CPI.map(([k, label], i) => ({
    name: t(label),
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
    yAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${String(v).replace("-", "−")}%` } },
    series: available,
  };
  const latest = CPI.map(([k, label]) => ({ label, o: ind(k).latest?.[id], b: ind(k).latestBenchmark })).filter((x) => x.o);

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <div>
          <h3 className="chart-title"><Flag id={id} /> {t('{country}: what is driving inflation?', { country: countryName(id) })}</h3>
          <p className="chart-unit">{t('Annual average % change, harmonised index of consumer prices (HICP)')}</p>
        </div>
        <div className="pills">
          {filters.countries.map((c) => (
            <button key={c} className={`pill sm ${c === id ? 'on' : ''}`} onClick={() => set({ focus: c })}><Flag id={c} /> {c}</button>
          ))}
        </div>
      </div>
      {available.length > 1 ? (
        <EChart option={option} height={340} ariaLabel={t('Inflation by category for {country}', { country: countryName(id) })} />
      ) : (
        <p className="empty">
          {t('{country} does not publish a harmonised consumer price index with category detail to Eurostat. Only overall inflation (national CPI via the World Bank) is available, which you can see in the trend explorer.', { country: countryName(id) })}
        </p>
      )}
      {latest.length > 0 && (
        <div className="latest-strip">
          <span className="eyebrow">{t('2026 so far')}</span>
          {latest.map(({ label, o, b }) => (
            <span key={label} className="latest-item">
              {t(label)} <b>{fmtSigned(o!.v, 1, '%')}</b>
              {b && filters.benchmark && <span className="muted"> ({t('EU')} {fmtSigned(b.v, 1, '%')})</span>}
            </span>
          ))}
          <span className="muted small">{t('Change on a year earlier, {period}', { period: periodLabel(latest[0].o!.p) })}</span>
        </div>
      )}
    </div>
  );
}
