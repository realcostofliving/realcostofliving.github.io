import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../lib/state';
import { fmt, fmtEuroRound, homeCost, obsAtOrBefore, periodLabel, PRICE_BASIS } from '../lib/data';
import { numLocale, t } from '../lib/i18n';
import { SERIES } from '../lib/scales';
import EChart, { axisCommon, baseOption, INK, INK_3 } from './EChart';
import Flag from './Flag';

/** Monthly payment on a repayment (annuity) mortgage. */
function monthlyPayment(loan: number, ratePct: number, years: number): number {
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? loan / n : (loan * r) / (1 - (1 + r) ** -n);
}
/** Largest loan whose monthly payment is `pay`. */
function loanFor(pay: number, ratePct: number, years: number): number {
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? pay * n : (pay * (1 - (1 + r) ** -n)) / r;
}
const round50 = (v: number) => Math.max(50, Math.round(v / 50) * 50);
const euro = (v: number) => `€${Math.round(v).toLocaleString(numLocale())}`;

export default function Calculator() {
  const { data, filters, ind, countryName, selectCountry } = useApp();
  const pm = ind('price_m2');
  const income = ind('median_income_eur');
  const minWage = ind('min_wage');
  const priced = data.countries.filter((c) => pm.series[c.id]);
  const [country, setCountry] = useState(() => (filters.focus && pm.series[filters.focus] ? filters.focus : 'AL'));
  const typicalPay = (id: string) => {
    const o = obsAtOrBefore(income.series[id], filters.year);
    return o ? round50(o[1] / 12) : undefined;
  };
  // The pay box keeps exactly what the person types; the sums use it once it is a real amount.
  const [payText, setPayText] = useState<string>(() => String(typicalPay(country) ?? 800));
  const setPay = (v: number) => setPayText(String(v));
  const typed = Number(payText);
  const payValid = Number.isFinite(typed) && typed >= 50;
  const pay = payValid ? typed : 50;
  const results = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(false);
  // The button opens a result card right where you are, so there is always something to see.
  const [open, setOpen] = useState(false);
  const showResult = () => { if (payValid) setOpen(true); };
  const showDetails = () => {
    setOpen(false);
    results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
  };
  const [size, setSize] = useState(70);
  const [save, setSave] = useState(30);
  const [rate, setRate] = useState(5);
  const [term, setTerm] = useState(25);
  const [deposit, setDeposit] = useState(20);

  // Follow the country picked on the map, if it has prices.
  useEffect(() => { if (filters.focus && pm.series[filters.focus]) setCountry(filters.focus); }, [filters.focus, pm]);

  const home = homeCost(data, country, filters.year)!;
  const mw = obsAtOrBefore(minWage.series[country], filters.year);
  const mwLatest = minWage.latest?.[country];
  const typical = typicalPay(country);
  const price = home ? home.perM2 * size : 0;
  const yearly = pay * 12;
  const yearsFull = price / yearly;
  const yearsSaving = price / (yearly * (save / 100));
  const depositAmt = price * (deposit / 100);
  const yearsDeposit = depositAmt / (yearly * (save / 100));
  const monthly = monthlyPayment(price - depositAmt, rate, term);
  const share = (monthly / pay) * 100;
  const verdict = share <= 33 ? ['good', t('Manageable')] : share <= 50 ? ['warn', t('A stretch')] : ['bad', t('Out of reach')];
  const affordableM2 = home ? loanFor(pay / 3, rate, term) / (1 - deposit / 100) / home.perM2 : 0;

  const others = useMemo(
    () =>
      priced
        .map((c) => ({ id: c.id, h: homeCost(data, c.id, filters.year) }))
        .filter((r) => r.h)
        .map((r) => ({ id: r.id, years: (r.h!.perM2 * size) / yearly, year: r.h!.year }))
        .sort((a, b) => a.years - b.years),
    [priced, data, filters.year, size, yearly],
  );

  const option: any = {
    ...baseOption(),
    grid: { left: 4, right: 56, top: 4, bottom: 4, containLabel: true },
    tooltip: { ...(baseOption().tooltip as object), formatter: (p: any) => t('{country}: about {years} years of your pay for {size} m²', { country: countryName(others[p.dataIndex].id), years: fmt(p.value, 1), size }) },
    xAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => `${v}` } },
    yAxis: { type: 'category', inverse: true, data: others.map((o) => countryName(o.id)), ...axisCommon, splitLine: { show: false }, axisLabel: { ...axisCommon.axisLabel, color: INK, fontSize: 11 } },
    series: [{
      type: 'bar',
      barMaxWidth: 12,
      data: others.map((o) => ({ value: +o.years.toFixed(1), itemStyle: { color: o.id === country ? SERIES[1] : '#a9bcd2', borderRadius: [0, 3, 3, 0] } })),
      label: { show: true, position: 'right', color: INK_3, fontSize: 10, formatter: (p: any) => t('{n} yrs', { n: fmt(p.value, 1) }) },
    }],
  };

  return (
    <section id="calculator" className="section" aria-labelledby="calc-title">
      <div className="section-head">
        <p className="eyebrow">{t('Your own numbers')}</p>
        <h2 id="calc-title">{t('Could you afford a home?')}</h2>
        <p className="lede">{t('Enter what you earn and see how long a home would take, whether you save up for it or pay it off with a mortgage. Everything is calculated in your browser; nothing is sent anywhere.')}</p>
      </div>
      <div className="calc">
        <div className="card calc-inputs">
          <label className="field">
            <span className="field-label">{t('Country')}</span>
            <select value={country} onChange={(e) => { setCountry(e.target.value); const tp = typicalPay(e.target.value); if (tp) setPay(tp); }}>
              {[...priced].sort((a, b) => a.name.localeCompare(b.name, numLocale())).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('Your monthly pay after tax, in €')}</span>
            <input
              className="calc-num"
              type="number"
              inputMode="numeric"
              min={50}
              max={50000}
              step={50}
              value={payText}
              onChange={(e) => setPayText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') showResult(); }}
              aria-invalid={!payValid}
            />
          </label>
          <div className="calc-chips">
            {typical && <button className="pill sm" onClick={() => setPay(typical)}>{t('Median income per person: {v}', { v: euro(typical) })}</button>}
            {(mwLatest || mw) && <button className="pill sm" onClick={() => setPay(round50((mwLatest?.v ?? mw![1]) * 0.8))}>{t('Minimum wage, after tax ≈ {v}', { v: euro(round50((mwLatest?.v ?? mw![1]) * 0.8)) })}</button>}
          </div>
          <p className="calc-note">
            {typical && t('Median income per person = median disposable income per person in {country}, divided by 12. It includes people who do not work, so it is usually below the average wage.', { country: countryName(country) })}{' '}
            {(mwLatest || mw) && t('The minimum wage there is {v} a month before tax ({p}); we assume about 20% goes on tax and contributions.', { v: euro(mwLatest?.v ?? mw![1]), p: mwLatest ? periodLabel(mwLatest.p) : String(mw![0]) })}
          </p>
          <Slider label={t('Home size')} value={size} min={30} max={150} step={5} unit=" m²" onChange={setSize} />
          <Slider label={t('Share of pay you could save')} value={save} min={5} max={60} step={5} unit="%" onChange={setSave} />
          <details className="calc-more">
            <summary>{t('Mortgage settings')}</summary>
            <Slider label={t('Interest rate')} value={rate} min={0} max={12} step={0.25} unit="%" onChange={setRate} />
            <Slider label={t('Loan length')} value={term} min={5} max={35} step={1} unit={` ${t('years')}`} onChange={setTerm} />
            <Slider label={t('Deposit')} value={deposit} min={0} max={50} step={5} unit="%" onChange={setDeposit} />
            <p className="calc-note">{t('These are your assumptions, not official rates. Banks set their own rates and lending rules.')}</p>
          </details>
          {home && payValid && (
            <p className="calc-preview">
              {t('A {size} m² home costs about {price}, or {n} years of your pay.', { size, price: fmtEuroRound(price), n: fmt(yearsFull, 1) })}
            </p>
          )}
          {!payValid && <p className="calc-warn">{t('Enter your monthly pay (at least €50) to see a result.')}</p>}
          <button className="btn calc-go" onClick={showResult} disabled={!payValid || !home}>
            {t('See my result')}
          </button>
          <p className="calc-note">{t('The result also updates by itself as you change anything.')}</p>
        </div>

        {home && (
          <div className={`calc-results ${flash ? 'flash' : ''} ${payValid ? '' : 'faded'}`} ref={results}>
            <div className="card calc-hero">
              <p className="eyebrow"><Flag id={country} /> {countryName(country)} · {home.year}</p>
              <p className="calc-big">{fmtEuroRound(price)}</p>
              <p className="calc-sub">{t('for a {size} m² home at about {m2} per m² ({basis})', { size, m2: euro(home.perM2), basis: t(PRICE_BASIS[home.basis ?? ''] ?? '').toLowerCase() })}</p>
              <div className="calc-stats">
                <Stat big={fmt(yearsFull, 1)} unit={t('years')} text={t('of your full pay, if you spent nothing else')} />
                <Stat big={fmt(yearsSaving, 1)} unit={t('years')} text={t('of saving {pct}% of your pay to buy it outright', { pct: save })} />
                <Stat big={fmt(yearsDeposit, 1)} unit={t('years')} text={t('to save a {pct}% deposit of {v}', { pct: deposit, v: fmtEuroRound(depositAmt) })} />
              </div>
            </div>
            <div className="card calc-mortgage">
              <div>
                <p className="eyebrow">{t('With a mortgage')}</p>
                <p className="calc-pay">{euro(monthly)} <span>{t('a month for {n} years', { n: term })}</span></p>
                <p className="calc-sub">{t('That is {pct}% of your pay after tax.', { pct: fmt(share, 0) })} <span className={`verdict ${verdict[0]}`}>{verdict[1]}</span></p>
                <div className="meter" aria-hidden="true"><span style={{ width: `${Math.min(100, share)}%` }} className={verdict[0]} /><i style={{ left: '33%' }} /></div>
                <p className="calc-note">{t('A common rule of thumb is to keep housing payments below a third of your income (the line on the bar).')}</p>
              </div>
              <div className="calc-afford">
                <p className="eyebrow">{t('What you could afford')}</p>
                <p className="calc-pay">{t('≈ {n} m²', { n: fmt(affordableM2, 0) })}</p>
                <p className="calc-sub">{t('if a third of your pay goes on the mortgage, with these settings.')}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {open && home && (
        <ResultCard
          onClose={() => setOpen(false)}
          onDetails={showDetails}
          country={country}
          countryLabel={countryName(country)}
          year={home.year}
          lines={[
            [fmtEuroRound(price), t('for a {size} m² home at about {m2} per m²', { size, m2: euro(home.perM2) })],
            [`${fmt(yearsFull, 1)} ${t('years')}`, t('of your full pay, if you spent nothing else')],
            [`${fmt(yearsSaving, 1)} ${t('years')}`, t('of saving {pct}% of your pay to buy it outright', { pct: save })],
            [`${euro(monthly)}`, t('a month with a mortgage over {n} years, which is {pct}% of your pay.', { n: term, pct: fmt(share, 0) })],
            [t('≈ {n} m²', { n: fmt(affordableM2, 0) }), t('is what you could afford if a third of your pay goes on the mortgage.')],
          ]}
          verdict={verdict as [string, string]}
          payLabel={t('With a pay of {pay} a month in {country}', { pay: euro(pay), country: countryName(country) })}
        />
      )}

      <div className="card chart-card">
        <div className="chart-head">
          <div>
            <h3 className="chart-title">{t('Your pay, other countries: years for a {size} m² home', { size })}</h3>
            <p className="chart-unit">{t('Years of {pay} a month · price per m² from the Deloitte Property Index (Montenegro: Monstat)', { pay: euro(pay) })}</p>
          </div>
        </div>
        <EChart option={option} height={Math.max(260, others.length * 18 + 30)} ariaLabel={t('Years of your pay needed for a home in each country')} onClick={(p) => others[p.dataIndex] && (setCountry(others[p.dataIndex].id), selectCountry(others[p.dataIndex].id))} />
        <p className="caption">{t('This assumes you earn the same pay everywhere. In reality pay differs a lot between countries, so use it to compare prices, not lives. Prices are national averages, mostly asking prices for new homes, and are not official statistics.')}</p>
      </div>
    </section>
  );
}

function ResultCard({ onClose, onDetails, country, countryLabel, year, lines, verdict, payLabel }: {
  onClose: () => void;
  onDetails: () => void;
  country: string;
  countryLabel: string;
  year: number;
  lines: [string, string][];
  verdict: [string, string];
  payLabel: string;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);
  const [first, ...rest] = lines;
  return (
    <div className="finder-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <div className="result-head">
          <p className="eyebrow"><Flag id={country} /> {countryLabel} · {year}</p>
          <button ref={closeBtn} className="finder-close" onClick={onClose} aria-label={t('Close')}>✕</button>
        </div>
        <h3 id="result-title" className="result-title">{t('Your result')}</h3>
        <p className="result-pay">{payLabel}</p>
        <p className="calc-big">{first[0]}</p>
        <p className="calc-sub">{first[1]}</p>
        <ul className="result-list">
          {rest.map(([big, text], i) => (
            <li key={i}><strong>{big}</strong> <span>{text}</span></li>
          ))}
        </ul>
        <p className="result-verdict"><span className={`verdict ${verdict[0]}`}>{verdict[1]}</span></p>
        <div className="result-actions">
          <button className="btn calc-go" onClick={onDetails}>{t('See all the details')}</button>
          <button className="btn btn-ghost" onClick={onClose}>{t('Close')}</button>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="field calc-slider">
      <span className="field-label">{label} <b>{value.toLocaleString(numLocale())}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

function Stat({ big, unit, text }: { big: string; unit: string; text: string }) {
  return (
    <div className="calc-stat">
      <p><strong>{big}</strong> {unit}</p>
      <span>{text}</span>
    </div>
  );
}
