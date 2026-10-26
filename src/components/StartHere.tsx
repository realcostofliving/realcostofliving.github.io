import { useApp } from '../lib/state';
import { displayObs, fmtSigned, TYPICAL_HOME_M2 } from '../lib/data';
import { scrollToId } from '../lib/ui';
import Flag from './Flag';
import { openFinder } from './SearchPalette';

/** Plain-language entry point: what the site answers, a few headline facts, and a tiny glossary. */
export default function StartHere() {
  const { data, filters, set, ind, countryName } = useApp();
  const year = filters.year;

  const extremes = (id: string) => {
    const i = ind(id);
    const vals = data.countries.map((c) => ({ id: c.id, o: displayObs(i, c.id, year) })).filter((r) => r.o && (!i.snapshot || r.o[0] === Math.min(year, i.coverage.last)));
    vals.sort((a, b) => a.o![1] - b.o![1]);
    return { low: vals[0], high: vals[vals.length - 1], year: vals[0]?.o?.[0] };
  };
  const price = extremes('price_m2');
  const growth = extremes('hpi_growth');
  const rent = extremes('rent_growth');

  const QUESTIONS: { n: string; q: string; a: string; go: () => void }[] = [
    { n: '1', q: 'How much does a home cost?', a: `Real prices in € per m² and for a ${TYPICAL_HOME_M2} m² home, on the map.`, go: () => { set({ indicator: 'price_m2' }); scrollToId('map'); } },
    { n: '2', q: 'How does my country compare?', a: 'Search any country in one table and tick up to five to compare.', go: () => scrollToId('table') },
    { n: '3', q: 'Are prices rising fast?', a: 'House prices, rents and inflation from 2004 to today.', go: () => { set({ indicator: 'hpi_growth' }); scrollToId('trends'); } },
    { n: '4', q: 'Can people afford a home?', a: 'Years of income needed, housing stress and who is struggling.', go: () => scrollToId('affordability') },
    { n: '5', q: 'What does everyday life cost?', a: 'Food, energy and transport prices compared with the EU average.', go: () => scrollToId('cost-of-living') },
  ];

  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start-intro">
        <h2 id="start-title" className="start-title">Is life in Europe getting more expensive? <span>Find out for 41 countries.</span></h2>
        <p className="start-lede">
          This site puts official statistics on homes, rents, prices and incomes in one place — from Lisbon to Kyiv, with a close look at the Western Balkans.
          Start with a question, or <button className="linklike strong" onClick={openFinder}>search for your country</button>.
        </p>
      </div>

      <div className="facts" aria-label="Headline facts">
        {price.low && price.high && (
          <>
            <Fact label="Cheapest homes" id={price.low.id} name={countryName(price.low.id)} value={`€${Math.round(price.low.o![1]).toLocaleString('en-GB')} per m²`} onClick={() => { set({ indicator: 'price_m2' }); scrollToId('map'); }} />
            <Fact label="Most expensive homes" id={price.high.id} name={countryName(price.high.id)} value={`€${Math.round(price.high.o![1]).toLocaleString('en-GB')} per m²`} onClick={() => { set({ indicator: 'price_m2' }); scrollToId('map'); }} />
          </>
        )}
        {growth.high && <Fact label={`Fastest rise in house prices, ${growth.year}`} id={growth.high.id} name={countryName(growth.high.id)} value={fmtSigned(growth.high.o![1], 1, '%')} tone="up" onClick={() => { set({ indicator: 'hpi_growth', year: growth.year! }); scrollToId('map'); }} />}
        {rent.high && <Fact label={`Fastest rise in rents, ${rent.year}`} id={rent.high.id} name={countryName(rent.high.id)} value={fmtSigned(rent.high.o![1], 1, '%')} tone="up" onClick={() => { set({ indicator: 'rent_growth', year: rent.year! }); scrollToId('map'); }} />}
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
        <div><dt>€ per m²</dt><dd>A real price: what one square metre of home costs.</dd></div>
        <div><dt>Index (2015 = 100)</dt><dd>Shows change over time, not a price. 150 = 50% more than in 2015.</dd></div>
        <div><dt>EU = 100</dt><dd>Compared with the EU average. 60 = 40% cheaper (or poorer) than average.</dd></div>
        <div><dt>“—” or stripes</dt><dd>No comparable data. Never the same as zero.</dd></div>
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
