import { useMemo } from 'react';
import { useApp } from '../lib/state';
import { describeFlag, fmtSigned, fmtValue, inRegion, median, obsAt, periodLabel, previousObs, sourceName } from '../lib/data';
import { deltaTone } from '../lib/scales';
import type { Indicator, Obs } from '../lib/types';
import Flag from './Flag';
import Sparkline from './Sparkline';
import { t } from '../lib/i18n';

const KPIS = ['hpi_growth', 'rent_growth', 'housing_cost_share', 'pti'];

interface Subject {
  kind: 'country' | 'aggregate' | 'median';
  id: string;
  label: string;
}

export default function KpiCards() {
  const { data, filters, ind, countryName } = useApp();
  const regionLabel = data.regions.find((r) => r.id === filters.region)!.label;

  const subject: Subject = filters.focus
    ? { kind: 'country', id: filters.focus, label: countryName(filters.focus) }
    : filters.region === 'EU'
      ? { kind: 'aggregate', id: 'EU27', label: t('EU average (official figure)') }
      : { kind: 'median', id: 'median', label: filters.region === 'ALL' ? t('The typical country in Europe') : t('The typical country in {region}', { region: regionLabel }) };

  return (
    <section id="overview" className="section kpi-section" aria-labelledby="overview-title">
      <div className="kpi-head">
        <div>
          <p className="eyebrow">{t('Overview')} · {filters.year}</p>
          <h2 id="overview-title" className="kpi-subject">
            {subject.kind === 'country' && <Flag id={subject.id} size="md" />} {subject.label}
          </h2>
        </div>
        <p className="kpi-note">
          {subject.kind === 'median'
            ? t('No country chosen yet, so these are middle values across all countries with data, not an official EU figure. Click a country on the map or search for one to see its own numbers.')
            : subject.kind === 'aggregate'
              ? t('The official EU figure as published by the source. House prices relative to income have no EU figure, so the euro area is shown instead.')
              : t('Click another country on the map, or clear the selection to return to the regional view.')}
        </p>
      </div>
      <div className="kpis">
        {KPIS.map((id) => <Kpi key={id} indicator={ind(id)} subject={subject} />)}
      </div>
    </section>
  );
}

function Kpi({ indicator, subject }: { indicator: Indicator; subject: Subject }) {
  const { data, filters, set } = useApp();
  const year = filters.year;
  const regionIds = useMemo(() => data.countries.filter((c) => inRegion(c, filters.region)).map((c) => c.id), [data, filters.region]);

  // Build the subject series (for medians: a median per year across the region's countries).
  const series: Obs[] = useMemo(() => {
    if (subject.kind === 'country') return indicator.series[subject.id] ?? [];
    if (subject.kind === 'aggregate') return indicator.benchmarkSeries ?? [];
    const out: Obs[] = [];
    for (let y = indicator.coverage.first; y <= indicator.coverage.last; y++) {
      const vals = regionIds.map((id) => obsAt(indicator.series[id], y)?.[1]).filter((v): v is number => v !== undefined);
      if (vals.length >= 3) out.push([y, median(vals)!, String(vals.length)]);
    }
    return out;
  }, [indicator, subject, regionIds]);

  const cur = obsAt(series, year);
  const prev = previousObs(series, year);
  const prevIsAdjacent = prev && cur && prev[0] === year - 1;
  const delta = cur && prevIsAdjacent ? cur[1] - prev![1] : undefined;
  const tone = deltaTone(indicator, delta);
  const lastAvail = !cur ? series.filter((o) => o[0] <= year).pop() ?? series[series.length - 1] : undefined;
  const bench = filters.benchmark && indicator.benchmarkSeries && subject.kind !== 'aggregate' ? obsAt(indicator.benchmarkSeries, year) : undefined;
  const benchName = indicator.benchmarkId === 'EA' ? t('Euro area') : t('EU');
  const latest = subject.kind === 'country' ? indicator.latest?.[subject.id] : subject.kind === 'aggregate' ? indicator.latestBenchmark : undefined;
  const flags = subject.kind !== 'median' && cur ? describeFlag(cur[2]) : [];
  const deltaUnit = indicator.kind === 'rate' || indicator.unitShort === '%' ? ' pp' : ' pts';
  const src = subject.kind === 'country' ? indicator.countrySource[subject.id]?.s : subject.kind === 'aggregate' ? indicator.benchmarkSource : undefined;
  const srcText = src ? sourceName(data, src) : [...new Set(indicator.sourceKeys.map((k) => data.sources[k].org))].join(', ');

  return (
    <article className="kpi">
      <header>
        <h3 className="kpi-title">
          <button className="linklike" onClick={() => set({ indicator: indicator.id })} title={t('Show this indicator on the map and charts')}>
            {indicator.label}
          </button>
        </h3>
        <p className="kpi-unit">{indicator.unit}</p>
      </header>
      {cur ? (
        <div className="kpi-value-row">
          <p className="kpi-value">{indicator.kind === 'rate' ? fmtSigned(cur[1], indicator.decimals, indicator.unitShort) : fmtValue(indicator, cur[1])}</p>
          <Sparkline series={series} from={Math.max(indicator.coverage.first, year - 12)} to={year} highlight={year} zeroLine={indicator.kind === 'rate'} label={t('{name} trend', { name: indicator.label })} />
        </div>
      ) : (
        <div className="kpi-value-row">
          <p className="kpi-value kpi-na">{t('Data unavailable')}</p>
          {lastAvail && <p className="kpi-hint">{t('Most recent: {v} in {year}', { v: fmtValue(indicator, lastAvail[1]), year: lastAvail[0] })}</p>}
        </div>
      )}
      <dl className="kpi-meta">
        {cur && (
          <div>
            <dt>{t('vs {year}', { year: year - 1 })}</dt>
            <dd className={`delta ${tone}`}>
              {delta === undefined ? t('no data for previous year') : <>{tone.startsWith('up') ? '▲' : tone.startsWith('down') ? '▼' : '■'} {fmtSigned(delta, indicator.decimals, deltaUnit)}</>}
            </dd>
          </div>
        )}
        {bench && (
          <div>
            <dt>{benchName}</dt>
            <dd>{indicator.kind === 'rate' ? fmtSigned(bench[1], indicator.decimals, indicator.unitShort) : fmtValue(indicator, bench[1])}</dd>
          </div>
        )}
        {latest && (
          <div className="kpi-latest">
            <dt>{t('Latest')}</dt>
            <dd>
              {fmtSigned(latest.v, 1, '%')} <span className="muted">({periodLabel(latest.p)}, {t('year on year')}{latest.f?.includes('p') ? `, ${t('provisional')}` : ''})</span>
            </dd>
          </div>
        )}
      </dl>
      <footer className="kpi-foot">
        {subject.kind === 'median' && cur ? `${t('Median of {n} countries', { n: cur[2]! })} · ` : ''}
        {flags.length ? `${flags.join(', ')} · ` : ''}
        {t('Source')}: {srcText}
      </footer>
    </article>
  );
}
