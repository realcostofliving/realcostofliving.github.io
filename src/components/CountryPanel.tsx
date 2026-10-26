import { useApp, MAX_COUNTRIES } from '../lib/state';
import { describeFlag, displayObs, fmt, fmtEuroRound, fmtSigned, fmtValue, homeCost, inRegion, obsAt, periodLabel, TYPICAL_HOME_M2 } from '../lib/data';
import { colorScale } from '../lib/scales';
import type { Indicator } from '../lib/types';
import Flag from './Flag';
import Sparkline from './Sparkline';

const PROFILE = ['price_m2', 'hpi_growth', 'rent_growth', 'inflation', 'overburden', 'housing_cost_share', 'pti', 'pli', 'aic_pps', 'median_income_pps'];
const LATEST = ['hpi_growth', 'rent_growth', 'inflation', 'food_inflation', 'energy_inflation'];
const REGION_NAMES = { N: 'Northern Europe', W: 'Western Europe', S: 'Southern Europe', E: 'Eastern Europe' };

export default function CountryPanel() {
  const { filters } = useApp();
  return <aside className="panel card" aria-live="polite">{filters.focus ? <Profile id={filters.focus} /> : <Leaderboard />}</aside>;
}

function Leaderboard() {
  const { data, filters, indicator, selectCountry, countryName } = useApp();
  const rows = data.countries
    .filter((c) => inRegion(c, filters.region))
    .map((c) => ({ id: c.id, v: displayObs(indicator, c.id, filters.year)?.[1] }))
    .filter((r): r is { id: string; v: number } => r.v !== undefined)
    .sort((a, b) => b.v - a.v);
  const scale = colorScale(indicator);
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1);
  const show = rows.length > 12 ? [...rows.slice(0, 6), null, ...rows.slice(-6)] : rows;
  return (
    <div className="leader">
      <p className="eyebrow">Ranking · {filters.year}</p>
      <h3 className="panel-title">{indicator.short}</h3>
      <p className="muted small">Highest to lowest across {rows.length} countries with data. Select one to see its full profile.</p>
      <ol className="leader-list">
        {show.map((r) =>
          r === null ? (
            <li key="gap" className="leader-gap" aria-hidden="true">⋯</li>
          ) : (
            <li key={r.id}>
              <button className="leader-row" onClick={() => selectCountry(r.id)}>
                <span className="leader-rank">{rows.indexOf(r) + 1}</span>
                <Flag id={r.id} />
                <span className="leader-name">{countryName(r.id)}</span>
                <span className="leader-bar" aria-hidden="true">
                  <span style={{ width: `${(Math.abs(r.v) / max) * 100}%`, background: scale.color(r.v) }} />
                </span>
                <span className="leader-val">{indicator.kind === 'rate' ? fmtSigned(r.v, indicator.decimals, indicator.unitShort) : fmtValue(indicator, r.v)}</span>
              </button>
            </li>
          ),
        )}
      </ol>
      {!rows.length && <p className="empty">No country in this region has data for {filters.year}.</p>}
    </div>
  );
}

function Profile({ id }: { id: string }) {
  const { data, filters, set, ind } = useApp();
  const c = data.countries.find((x) => x.id === id)!;
  const inList = filters.countries.includes(id);
  const latest = LATEST.map((k) => ({ ind: ind(k), o: ind(k).latest?.[id] })).filter((x) => x.o);

  return (
    <div className="profile">
      <div className="profile-head">
        <Flag id={id} size="lg" />
        <div>
          <h3 className="panel-title">{c.name}</h3>
          <p className="badges">
            <span className="badge">{REGION_NAMES[c.region]}</span>
            {c.eu && <span className="badge">EU member</span>}
            {c.euro && <span className="badge">Euro area</span>}
            {c.wb && <span className="badge badge-accent">Western Balkans</span>}
          </p>
        </div>
        <button className="close" onClick={() => set({ focus: null })} aria-label="Close country profile">×</button>
      </div>
      <HomeCost id={id} />
      <ul className="profile-list">
        {PROFILE.map((k) => <ProfileRow key={k} ind={ind(k)} id={id} />)}
      </ul>
      {latest.length > 0 && (
        <div className="latest">
          <p className="eyebrow">Latest 2026 readings · partial year</p>
          <ul>
            {latest.map(({ ind: i, o }) => (
              <li key={i.id}>
                <span>{i.short}</span>
                <span className="latest-v">{fmtSigned(o!.v, 1, '%')}</span>
                <span className="muted small">{periodLabel(o!.p)}{o!.f?.includes('p') ? ' · provisional' : ''}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Year-on-year change in the latest published month or quarter. Not an annual figure.</p>
        </div>
      )}
      <div className="profile-actions">
        <button
          className="btn"
          onClick={() => {
            set({ countries: inList ? filters.countries : [id, ...filters.countries].slice(0, MAX_COUNTRIES), benchmark: true });
            document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          Compare {c.name}
        </button>
        <button className="btn btn-ghost" onClick={() => { set({ countries: [id] , benchmark: true }); document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth' }); }}>
          {c.name} vs EU-27
        </button>
      </div>
    </div>
  );
}

function HomeCost({ id }: { id: string }) {
  const { data, filters } = useApp();
  const h = homeCost(data, id, filters.year);
  if (!h) return <p className="home-card muted small">No comparable price per m² is available for this country.</p>;
  return (
    <div className="home-card">
      <p className="eyebrow">What a home costs · {h.year}</p>
      <p className="home-price">{fmtEuroRound(h.price)}</p>
      <p className="small">
        for a {TYPICAL_HOME_M2} m² home at about €{Math.round(h.perM2).toLocaleString('en-GB')} per m²
        {h.years !== undefined && <> — roughly <strong>{fmt(h.years, 1)} years</strong> of a typical person’s disposable income</>}.
      </p>
    </div>
  );
}

function ProfileRow({ ind, id }: { ind: Indicator; id: string }) {
  const { filters, set } = useApp();
  const s = ind.series[id];
  const o = obsAt(s, filters.year);
  const last = !o && s ? [...s].reverse().find((x) => x[0] <= filters.year) ?? s[s.length - 1] : undefined;
  const shown = o ?? last;
  const flags = describeFlag(shown?.[2]);
  return (
    <li className={`profile-row ${filters.indicator === ind.id ? 'on' : ''}`}>
      <button className="linklike profile-label" onClick={() => set({ indicator: ind.id })}>{ind.short}</button>
      <span className="profile-val">
        {shown ? (ind.kind === 'rate' ? fmtSigned(shown[1], ind.decimals, ind.unitShort) : fmtValue(ind, shown[1])) : <span className="na">No data</span>}
        {shown && shown[0] !== filters.year && <span className="yr">{shown[0]}</span>}
        {flags.length > 0 && <span className="flagmark" title={flags.join(', ')}>{flags[0][0]}</span>}
      </span>
      {s && s.length > 1 ? <Sparkline series={s} from={2004} to={2025} highlight={shown?.[0]} width={86} height={22} zeroLine={ind.kind === 'rate'} label={`${ind.short} trend`} /> : <span className="spark-empty" />}
    </li>
  );
}
