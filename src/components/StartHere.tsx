import { useApp } from '../lib/state';
import { displayObs, fmt, fmtSigned, TYPICAL_HOME_M2 } from '../lib/data';
import { numLocale, t } from '../lib/i18n';
import { scrollToId } from '../lib/ui';
import Flag from './Flag';
import { openFinder } from './SearchPalette';

/** Plain-language entry point: what the site answers, a few headline facts, and a tiny glossary. */
export default function StartHere() {
  const { data, filters, set, ind, countryName } = useApp();
  const year = filters.year;

  const extremes = (id: string) => {
    const i = ind(id);
    const target = Math.min(year, i.coverage.last);
    const vals = data.countries.map((c) => ({ id: c.id, o: displayObs(i, c.id, target) })).filter((r) => r.o && r.o[0] === target);
    vals.sort((a, b) => a.o![1] - b.o![1]);
    return { low: vals[0], high: vals[vals.length - 1], year: target };
  };
  const price = extremes('price_m2');
  const growth = extremes('hpi_growth');
  const parents = extremes('living_with_parents');
  const euro = (v: number) => `€${Math.round(v).toLocaleString(numLocale())}`;

  const QUESTIONS: { n: string; q: string; a: string; go: () => void }[] = [
    { n: '1', q: t('How much does a home cost?'), a: t('Real prices in € per m² and for a {size} m² home, on the map.', { size: TYPICAL_HOME_M2 }), go: () => { set({ indicator: 'price_m2' }); scrollToId('map'); } },
    { n: '2', q: t('How does my country compare?'), a: t('Search any country in one table and tick up to five to compare.'), go: () => scrollToId('table') },
    { n: '3', q: t('Could I afford one?'), a: t('Enter your pay and see how many years a home would take.'), go: () => scrollToId('calculator') },
    { n: '4', q: t('Are prices rising fast?'), a: t('House prices, rents and inflation from 2004 to today.'), go: () => { set({ indicator: 'hpi_growth' }); scrollToId('trends'); } },
    { n: '5', q: t('Can people afford a home?'), a: t('Years of income needed, housing stress and who is struggling.'), go: () => scrollToId('affordability') },
    { n: '6', q: t('What does everyday life cost?'), a: t('Food, energy and transport prices compared with the EU average.'), go: () => scrollToId('cost-of-living') },
  ];

  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start-intro">
        <h2 id="start-title" className="start-title">{t('Is life in Europe getting more expensive?')} <span>{t('Find out for {n} countries.', { n: data.countries.length })}</span></h2>
        <p className="start-lede">
          {t('This site puts official statistics on homes, rents, prices and incomes in one place, from Lisbon to Kyiv, with a close look at the Western Balkans.')}{' '}
          {t('Start with a question, or')} <button className="linklike strong" onClick={openFinder}>{t('search for your country')}</button>.
        </p>
      </div>

      <div className="facts" aria-label={t('Headline facts')}>
        {price.low && price.high && (
          <>
            <Fact label={t('Cheapest homes')} id={price.low.id} name={countryName(price.low.id)} value={t('{v} per m²', { v: euro(price.low.o![1]) })} onClick={() => { set({ indicator: 'price_m2' }); scrollToId('map'); }} />
            <Fact label={t('Most expensive homes')} id={price.high.id} name={countryName(price.high.id)} value={t('{v} per m²', { v: euro(price.high.o![1]) })} onClick={() => { set({ indicator: 'price_m2' }); scrollToId('map'); }} />
          </>
        )}
        {growth.high && <Fact label={t('Fastest rise in house prices, {year}', { year: growth.year })} id={growth.high.id} name={countryName(growth.high.id)} value={fmtSigned(growth.high.o![1], 1, '%')} tone="up" onClick={() => { set({ indicator: 'hpi_growth', year: growth.year }); scrollToId('map'); }} />}
        {parents.high && <Fact label={t('Most young adults living with parents, {year}', { year: parents.year })} id={parents.high.id} name={countryName(parents.high.id)} value={t('{v} of people aged 18 to 34', { v: `${fmt(parents.high.o![1], 0)}%` })} tone="up" onClick={() => { set({ indicator: 'living_with_parents', year: parents.year }); scrollToId('map'); }} />}
      </div>

      <ol className="questions">
        {QUESTIONS.map((x) => (
          <li key={x.n}>
            <button className="question" onClick={x.go}>
              <span className="q-n" aria-hidden="true">{x.n}</span>
              <span className="q-text">
                <strong>{x.q}</strong>
                <span>{x.a}</span>
              </span>
              <span className="q-go" aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ol>

      <dl className="glossary">
        <div><dt>{t('€ per m²')}</dt><dd>{t('A real price: what one square metre of home costs.')}</dd></div>
        <div><dt>{t('Index (2015 = 100)')}</dt><dd>{t('Shows change over time, not a price. 150 = 50% more than in 2015.')}</dd></div>
        <div><dt>{t('EU = 100')}</dt><dd>{t('Compared with the EU average. 60 = 40% cheaper (or poorer) than average.')}</dd></div>
        <div><dt>{t('“n/a” or stripes')}</dt><dd>{t('No comparable data. Never the same as zero.')}</dd></div>
      </dl>
    </section>
  );
}

function Fact({ label, id, name, value, tone, onClick }: { label: string; id: string; name: string; value: string; tone?: 'up'; onClick: () => void }) {
  return (
    <button className="fact" onClick={onClick}>
      <span className="fact-label">{label}</span>
      <span className="fact-who"><Flag id={id} /> {name}</span>
      <span className={`fact-value ${tone === 'up' ? 'up' : ''}`}>{value}</span>
    </button>
  );
}
