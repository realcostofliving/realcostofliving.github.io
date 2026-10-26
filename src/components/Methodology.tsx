import { useEffect } from 'react';
import { useApp } from '../lib/state';
import { FLAG_LABELS, PRICE_BASIS } from '../lib/data';
import type { Indicator } from '../lib/types';
import Flag from './Flag';
import { dateLocale, t } from '../lib/i18n';

const REGION_NAMES: Record<string, string> = { N: 'Northern Europe', W: 'Western Europe', S: 'Southern Europe', E: 'Eastern Europe' };
const CAT: Record<string, string> = { housing: 'Housing', prices: 'Prices & cost of living', income: 'Income & living standards' };

export default function Methodology() {
  const { data, dashHref, lang } = useApp();
  useEffect(() => {
    const s = new URLSearchParams(location.hash.split('?')[1] ?? '').get('s');
    if (s) setTimeout(() => document.getElementById(s)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);
  const retrieved = new Date(data.generatedAt).toLocaleString(dateLocale(), { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' });

  return (
    <article className="method">
      <p className="back"><a href={dashHref}>← {t('Back to the explorer')}</a></p>
      {lang === 'sq' && <p className="notice">{t('This page with sources and methods is in English only. Country and indicator names are shown in Albanian.')}</p>}
      <header className="section-head">
        <p className="eyebrow">Sources &amp; methodology</p>
        <h1>Where every number comes from</h1>
        <p className="lede">
          Every figure in this explorer comes from an official statistical source. Nothing is estimated by us, missing years are never filled in, and the few
          calculations we make are listed below. This page lets you trace each indicator back to its origin.
        </p>
        <p className="muted">Data snapshot retrieved {retrieved} UTC. Every week a scheduled job downloads all sources again, runs the integrity checks again and only republishes the site if they pass. The data are not live.</p>
      </header>

      <nav className="toc" aria-label="On this page">
        <a href="#/methodology?s=indicators" onClick={jump('indicators')}>Indicators</a>
        <a href="#/methodology?s=coverage" onClick={jump('coverage')}>Coverage at a glance</a>
        <a href="#/methodology?s=countries" onClick={jump('countries')}>Countries &amp; groups</a>
        <a href="#/methodology?s=processing" onClick={jump('processing')}>How data are processed</a>
        <a href="#/methodology?s=limitations" onClick={jump('limitations')}>Known limitations</a>
        <a href="#/methodology?s=licences" onClick={jump('licences')}>Licences</a>
      </nav>

      <section id="indicators" className="method-section">
        <h2>Indicators</h2>
        {(['housing', 'prices', 'income'] as const).map((cat) => (
          <div key={cat}>
            <h3 className="method-cat">{CAT[cat]}</h3>
            {data.indicators.filter((i) => i.category === cat).map((i) => <IndicatorMeta key={i.id} ind={i} />)}
          </div>
        ))}
      </section>

      <section id="coverage" className="method-section">
        <h2>Coverage at a glance</h2>
        <p>First and last year available for each country. Empty cells mean the source publishes nothing comparable for that country.</p>
        <CoverageMatrix />
      </section>

      <section id="countries" className="method-section">
        <h2>Countries and groups</h2>
        <p>
          We use the two letter ISO 3166 country codes (XK for Kosovo, as used by the EU). Eurostat's own codes EL (Greece) and UK (United Kingdom) are mapped to GR and GB. Regions
          follow the UN M49 geoscheme for Europe with two exceptions: Türkiye (UN: Western Asia) and Cyprus (UN: Western Asia) are placed in Southern Europe. The
          Western Balkans group is the EU's definition: Albania, Bosnia and Herzegovina, Kosovo, Montenegro, North Macedonia and Serbia. Under UN M49 these six are
          also part of Southern Europe, so they appear in both groups. The Baltic states are Northern Europe and Slovenia and Croatia Southern Europe, following UN M49
          rather than common usage.
        </p>
        <div className="table-scroll">
          <table className="meta-table">
            <thead><tr><th>Country</th><th>Code</th><th>Region</th><th>Groups</th></tr></thead>
            <tbody>
              {data.countries.map((c) => (
                <tr key={c.id}>
                  <td><Flag id={c.id} /> {c.name}</td>
                  <td><code>{c.id}</code></td>
                  <td>{REGION_NAMES[c.region]}</td>
                  <td>{[c.eu && 'EU member', c.euro && 'Euro area', c.wb && 'Western Balkans'].filter(Boolean).join(' · ') || 'none'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>Not included</h3>
        <ul>
          {data.excluded.map((e) => <li key={e.name}><strong>{e.name}.</strong> {e.reason}</li>)}
        </ul>
        <h3>Boundaries</h3>
        <p>
          Country shapes come from Natural Earth (1:10m, public domain), using its edition drawn from the German point of view so that borders follow EU practice: Kosovo is shown
          separately and Crimea as part of Ukraine. Northern Cyprus is drawn as part of Cyprus; Eurostat figures for Cyprus cover only the areas under the effective
          control of the Government of the Republic of Cyprus. Shapes are simplified for the web. Kosovo: this designation is without prejudice to positions on status,
          and is in line with UNSCR 1244/1999 and the ICJ Opinion on the Kosovo declaration of independence.
        </p>
      </section>

      <section id="processing" className="method-section">
        <h2>How data are processed</h2>
        <ol className="rules">
          <li><strong>One source per country and indicator.</strong> Each line on a chart comes from a single source. Where we use a second source (BIS for some house prices, the World Bank for some inflation), it is used for the whole series of that country and shown in tooltips.</li>
          <li><strong>No invented values.</strong> Missing observations stay missing. We never interpolate, carry values forward or replace gaps with zero. Charts show gaps; the map hatches countries without data.</li>
          <li><strong>Status flags are kept.</strong> Provisional (p), estimated (e), break in series (b), low reliability (u) and definition differs (d) flags from the source are shown in tooltips, tables and as hollow chart points.</li>
          <li><strong>Aggregates are official.</strong> The EU benchmark is the EU27 aggregate published by Eurostat (or the World Bank's EU aggregate for GDP in international $). OECD indicators have no EU aggregate, so the OECD euro area aggregate is used and labelled. Where no country is selected, KPI cards show a <em>median</em> of countries and say so.</li>
          <li><strong>Derived values</strong> (all marked "derived"):
            <ul>
              <li>BIS house price indices (United Kingdom, Greece, Switzerland, Serbia, North Macedonia): annual average of the four quarters (a year is used only if all four quarters exist), rebased to 2015 = 100; yearly growth is computed from those annual averages.</li>
              <li>Latest BIS reading: change between the latest quarter and the same quarter a year earlier.</li>
              <li>Albania's house price index: the Bank of Albania publishes a Fischer index (2013 = 1) twice a year from its real estate survey. We average the two halves of each year (both required), rebase to 2015 = 100 and compute yearly growth from those averages. 2014 is missing because the survey was quarterly that year and only three quarters exist.</li>
              <li>Montenegro's price per m²: mean of Monstat's four 2025 quarterly averages for new dwellings sold by enterprises at market prices.</li>
              <li>"What a home costs": price per m² × 70 m², and that amount divided by median equivalised disposable income (EU SILC, same or latest earlier year). This is the only calculation that combines two different datasets; it is labelled wherever it appears.</li>
              <li>Chart views: "Yearly change" uses only consecutive years; "Change since" and "Indexed" need an observation in the base year, otherwise the country is left out and a note says so.</li>
              <li>"Did incomes keep up?" compares each index with its own value in the base year. No ratio that combines two different datasets (such as rent to income) is calculated.</li>
            </ul>
          </li>
          <li><strong>Partial years.</strong> Annual data run to 2025 at the latest. For 2026 we show only the latest monthly (HICP) or quarterly (house prices) change on a year earlier, labelled with its period, and never mix it into the annual series.</li>
          <li><strong>Series breaks and revisions.</strong> Each refresh replaces the whole series with the source's current vintage, so revisions are picked up. Breaks flagged by the source are shown as such. The 2026 move of Eurostat's HICP to the ECOICOP version 2 classification is handled by using the new series calculated back in time (prc_hicp_ainr), which sets all HICP indices to 2025 = 100.</li>
          <li><strong>Integrity checks</strong> run before every publish: one record per country and year, years in range, numeric values, plausible ranges for rates, minimum country coverage per core indicator, a recent last observation, a recorded source for every series, and map geometry for every country.</li>
        </ol>
      </section>

      <section id="limitations" className="method-section">
        <h2>Known limitations</h2>
        <ul className="limits">
          <li><strong>House prices in the Western Balkans.</strong> Serbia and North Macedonia are covered through the BIS. Albania uses the Bank of Albania's own index, based on a survey, which is not harmonised with Eurostat's and is flagged "definition differs"; it measures prices of homes sold by construction firms and agents, and can move very differently from asking prices (in 2025 it rose about 34%, while Deloitte reports asking prices up about 6%). No official index exists for Bosnia and Herzegovina, Kosovo or Montenegro.</li>
          <li><strong>Prices per m²</strong> are not official statistics: Europe has no harmonised source of house prices in euros. We use the Deloitte Property Index (figures collected by Deloitte national offices from national sources and market data) and Monstat for Montenegro. Most are asking prices for new homes; some are transaction prices or include older homes, and national averages hide large differences between cities, coasts and rural areas. Only 2024 and 2025 are available, and Kosovo, North Macedonia and 12 other countries are not covered.</li>
          <li><strong>Price to income ratios</strong> are published by the OECD only, for OECD members and a few partners. No Western Balkan country, Cyprus, Malta or Türkiye is covered. They are indices (2015 = 100), not absolute ratios of house prices to annual income.</li>
          <li><strong>EU SILC measures</strong> (overburden rate, housing cost share, median income) start later in candidate countries, have breaks in series, and are not available for Bosnia and Herzegovina, Ukraine, Moldova or Belarus. The UK series end in 2018. Income refers to the year before the survey.</li>
          <li><strong>Rents</strong> come from consumer price indices, which follow rents paid by sitting tenants rather than advertised rents for new lets, and cover small rental markets in countries where most people own their homes.</li>
          <li><strong>Inflation</strong> for Bosnia and Herzegovina, the United Kingdom, Ukraine, Moldova and Belarus uses national CPIs (World Bank), which are not fully harmonised with the HICP. Category detail is not available for these countries.</li>
          <li><strong>Purchasing power parities</strong> are published with a delay (latest year {data.indicators.find((i) => i.id === 'pli')?.coverage.last}) and are not available for Ukraine, Moldova or Belarus; Kosovo is missing for several categories.</li>
          <li><strong>Ukraine</strong> data since 2022 are affected by the war and may exclude occupied territories.</li>
          <li><strong>Crowdsourced data</strong> such as Numbeo are deliberately not used: they are not official statistics and their samples are small in many countries.</li>
        </ul>
      </section>

      <section id="licences" className="method-section">
        <h2>Licences and reuse</h2>
        <ul>
          <li>Eurostat data: © European Union, reused under the <a href="https://ec.europa.eu/eurostat/web/main/help/copyright-notice" target="_blank" rel="noreferrer">Eurostat copyright notice</a> (CC BY 4.0).</li>
          <li>OECD data: <a href="https://www.oecd.org/en/about/terms-conditions.html" target="_blank" rel="noreferrer">OECD terms and conditions</a> (CC BY 4.0).</li>
          <li>BIS data: <a href="https://www.bis.org/terms_statistics.htm" target="_blank" rel="noreferrer">BIS terms of use for statistics</a>.</li>
          <li>World Bank data: <a href="https://datacatalog.worldbank.org/public-licenses" target="_blank" rel="noreferrer">CC BY 4.0</a>.</li>
          <li>Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a>, public domain. Flags: the flag icons library (MIT).</li>
        </ul>
      </section>
    </article>
  );
}

function jump(id: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };
}

function IndicatorMeta({ ind }: { ind: Indicator }) {
  const { data, countryName } = useApp();
  const missing = data.countries.filter((c) => !ind.series[c.id]).map((c) => c.name);
  const flags = new Set<string>();
  for (const s of Object.values(ind.series)) for (const o of s) if (o[2]) for (const ch of o[2]) flags.add(ch);
  const bySource = new Map<string, string[]>();
  for (const [id, cs] of Object.entries(ind.countrySource)) {
    const k = `${cs.s}${cs.d ? ' (derived)' : ''}`;
    bySource.set(k, [...(bySource.get(k) ?? []), countryName(id)]);
  }
  const latestPeriods = ind.latest ? [...new Set(Object.values(ind.latest).map((o) => o.p))].sort() : [];
  return (
    <details className="meta" id={`ind-${ind.id}`}>
      <summary>
        <span className="meta-name">{ind.label}</span>
        <span className="meta-sub">{ind.unit} · {ind.coverage.countries} of {data.countries.length} countries · {ind.coverage.first} to {ind.coverage.last}</span>
      </summary>
      <dl className="meta-dl">
        <dt>In plain English</dt><dd>{ind.explainer}</dd>
        <dt>Definition</dt><dd>{ind.definition}</dd>
        <dt>Unit</dt><dd>{ind.unit}</dd>
        <dt>Retrieved</dt>
        <dd>
          {ind.retrievedAt ? new Date(ind.retrievedAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown'}
          {ind.stale && <span className="caveat-inline">. The source could not be reached at the latest refresh, so these values come from the earlier retrieval.</span>}
        </dd>
        <dt>Frequency</dt><dd>Annual{ind.latest ? `; latest ${latestPeriods.some((p) => p.includes('Q')) ? 'quarterly' : 'monthly'} reading shown for 2026 (${latestPeriods.join(', ')})` : ''}</dd>
        <dt>Sources</dt>
        <dd>
          <ul>
            {ind.sourceKeys.map((k) => {
              const s = data.sources[k];
              return (
                <li key={k}>
                  {s.org}: {s.name} (<code>{s.dataset}</code>) · <a href={s.url} target="_blank" rel="noreferrer">dataset page</a> · <a href={s.api} target="_blank" rel="noreferrer">API endpoint</a>
                  {s.updated && <span className="muted"> · source updated {new Date(s.updated).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                </li>
              );
            })}
          </ul>
        </dd>
        {bySource.size > 1 && (
          <>
            <dt>Source by country</dt>
            <dd>{[...bySource].map(([k, list]) => <p key={k}><code>{k}</code>: {list.join(', ')}</p>)}</dd>
          </>
        )}
        {ind.extra && (
          <>
            <dt>Basis by country</dt>
            <dd>
              {Object.entries(
                Object.entries(ind.extra).reduce<Record<string, string[]>>((acc, [id, e]) => {
                  const k = PRICE_BASIS[e.basis ?? ''] ?? e.basis ?? 'not stated';
                  (acc[k] ??= []).push(countryName(id));
                  return acc;
                }, {}),
              ).map(([k, list]) => <p key={k}><strong>{k}:</strong> {list.join(', ')}</p>)}
            </dd>
          </>
        )}
        <dt>Benchmark</dt><dd>{ind.benchmarkId === 'EU27' ? 'EU27, official aggregate' : ind.benchmarkId === 'EA' ? 'Euro area, OECD aggregate (no EU aggregate published)' : 'None'}</dd>
        <dt>Status of observations</dt>
        <dd>{flags.size ? `Actual values, plus observations flagged as ${[...flags].map((f) => FLAG_LABELS[f] ?? f).join(', ')}` : 'All observations are reported without flags (actual)'}; missing observations are left blank.</dd>
        <dt>Not covered</dt><dd>{missing.length ? missing.join(', ') : 'All countries covered'}</dd>
        {ind.dropped && ind.dropped.length > 0 && (<><dt>Values left out</dt><dd>{ind.dropped.map((d) => `${countryName(d.id)} ${d.year}`).join(', ')}: the source publishes 0, which is impossible for this measure, so the value is treated as missing.</dd></>)}
        {ind.caveat && (<><dt>Caveats</dt><dd>{ind.caveat}</dd></>)}
      </dl>
    </details>
  );
}

function CoverageMatrix() {
  const { data } = useApp();
  const inds = data.indicators.filter((i) => i.crossCountry !== false);
  return (
    <div className="table-scroll coverage-scroll">
      <table className="coverage">
        <thead>
          <tr>
            <th scope="col">Country</th>
            {inds.map((i) => <th key={i.id} scope="col" title={i.label}><span>{i.short}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {data.countries.map((c) => (
            <tr key={c.id}>
              <th scope="row"><Flag id={c.id} /> {c.name}</th>
              {inds.map((i) => {
                const s = i.series[c.id];
                if (!s) return <td key={i.id} className="cov-none" aria-label="no data" />;
                const n = s.length, span = s[n - 1][0] - s[0][0] + 1;
                const cls = s[0][0] <= 2006 && s[n - 1][0] >= i.coverage.last - 1 ? 'cov-full' : 'cov-part';
                return <td key={i.id} className={cls} title={`${s[0][0]} to ${s[n - 1][0]}, ${n} years${n < span ? ' (with gaps)' : ''}`}>{s[0][0]} to {s[n - 1][0]}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
