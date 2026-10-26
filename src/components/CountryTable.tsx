import { useMemo, useState } from 'react';
import { useApp, MAX_COUNTRIES } from '../lib/state';
import { describeFlag, fmt, fmtEuroRound, fmtSigned, homeCost, inRegion, obsAtOrBefore } from '../lib/data';
import { colorScale, SERIES } from '../lib/scales';
import { matchScore, scrollToId } from '../lib/ui';
import type { Indicator, RegionId } from '../lib/types';
import Flag from './Flag';

interface Col {
  key: string;
  label: string;
  hint: string;
  ind?: string;
  /** Value derived from the price per m² rather than read from an indicator. */
  derived?: 'home' | 'years';
}

const COLS: Col[] = [
  { key: 'price_m2', ind: 'price_m2', label: 'Home price', hint: '€ per m²' },
  { key: 'home', derived: 'home', label: '70 m² home', hint: 'about, in €' },
  { key: 'years', derived: 'years', label: 'Years of income', hint: 'to pay for a 70 m² home' },
  { key: 'hpi_growth', ind: 'hpi_growth', label: 'House prices', hint: 'change in a year' },
  { key: 'rent_growth', ind: 'rent_growth', label: 'Rents', hint: 'change in a year' },
  { key: 'inflation', ind: 'inflation', label: 'Everyday prices', hint: 'inflation in a year' },
  { key: 'housing_cost_share', ind: 'housing_cost_share', label: 'Housing costs', hint: '% of income' },
  { key: 'overburden', ind: 'overburden', label: 'Struggling', hint: '% spending 40%+ of income on housing' },
  { key: 'pli', ind: 'pli', label: 'Price level', hint: 'EU average = 100' },
  { key: 'median_income_pps', ind: 'median_income_pps', label: 'Median income', hint: 'per person, a year (PPS)' },
];

const REGION_CHIPS: [RegionId, string][] = [
  ['ALL', 'All'],
  ['EU', 'EU'],
  ['WB', 'Western Balkans'],
  ['N', 'North'],
  ['W', 'West'],
  ['S', 'South'],
  ['E', 'East'],
];

interface Cell { v?: number; y?: number; f?: string }

export default function CountryTable() {
  const { data, filters, set, ind, selectCountry } = useApp();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'price_m2', dir: -1 });
  const year = filters.year;

  const rows = useMemo(() => {
    return data.countries.map((c) => {
      const cells: Record<string, Cell> = {};
      const home = homeCost(data, c.id, year);
      for (const col of COLS) {
        if (col.derived === 'home') cells[col.key] = home ? { v: home.price, y: home.year } : {};
        else if (col.derived === 'years') cells[col.key] = home?.years !== undefined ? { v: home.years, y: home.year } : {};
        else {
          const o = obsAtOrBefore(ind(col.ind!).series[c.id], year);
          cells[col.key] = o ? { v: o[1], y: o[0], f: o[2] } : {};
        }
      }
      return { c, cells };
    });
  }, [data, year, ind]);

  const shown = rows
    .filter((r) => inRegion(r.c, filters.region) && matchScore(r.c, q) > 0)
    .sort((a, b) => {
      if (sort.key === 'name') return sort.dir * a.c.name.localeCompare(b.c.name);
      const x = a.cells[sort.key].v, y = b.cells[sort.key].v;
      if (x === undefined && y === undefined) return a.c.name.localeCompare(b.c.name);
      if (x === undefined) return 1; // missing values always last
      if (y === undefined) return -1;
      return sort.dir * (x - y);
    });

  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const toggleCompare = (id: string) => {
    const has = filters.countries.includes(id);
    if (has) { if (filters.countries.length > 1) set({ countries: filters.countries.filter((x) => x !== id) }); }
    else if (filters.countries.length < MAX_COUNTRIES) set({ countries: [...filters.countries, id] });
  };

  const downloadCsv = () => {
    const head = ['Country', ...COLS.map((c) => `${c.label} (${c.hint})`), ...COLS.map((c) => `${c.label} – year`)];
    const lines = shown.map((r) => [r.c.name, ...COLS.map((c) => (r.cells[c.key].v === undefined ? '' : String(Math.round(r.cells[c.key].v! * 10) / 10))), ...COLS.map((c) => String(r.cells[c.key].y ?? ''))]);
    const csv = [head, ...lines].map((l) => l.map((x) => (/[",]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = `europe-cost-of-living-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section id="table" className="section" aria-labelledby="table-title">
      <div className="section-head">
        <p className="eyebrow">Every country, one table</p>
        <h2 id="table-title">Find your country and compare</h2>
        <p className="lede">Search, sort by any column, and tick up to five countries to compare them in the charts below. The latest figure up to {year} is shown; a small year means the number is older.</p>
      </div>
      <div className="card table-card ct-card">
        <div className="ct-tools">
          <label className="ct-search">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries…" aria-label="Search countries in the table" />
          </label>
          <div className="pills ct-regions" role="radiogroup" aria-label="Region">
            {REGION_CHIPS.map(([id, label]) => (
              <button key={id} role="radio" aria-checked={filters.region === id} className={`pill sm ${filters.region === id ? 'on' : ''}`} onClick={() => set({ region: id })}>{label}</button>
            ))}
          </div>
          <div className="ct-actions">
            <button className="btn" onClick={() => scrollToId('compare')} disabled={filters.countries.length < 2}>
              Compare {filters.countries.length} selected →
            </button>
            <button className="btn btn-ghost" onClick={downloadCsv}>Download CSV</button>
          </div>
        </div>
        <div className="ct-scroll">
          <table className="ct">
            <thead>
              <tr>
                <th scope="col" className="ct-pick"><span className="sr-only">Compare</span></th>
                <th scope="col" className="ct-country">
                  <button className={`ct-sort ${sort.key === 'name' ? 'on' : ''}`} onClick={() => toggleSort('name')} aria-sort={sort.key === 'name' ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    Country {sort.key === 'name' ? (sort.dir === 1 ? '↑' : '↓') : ''}
                  </button>
                </th>
                {COLS.map((col) => (
                  <th key={col.key} scope="col" aria-sort={sort.key === col.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    <button className={`ct-sort ${sort.key === col.key ? 'on' : ''}`} onClick={() => toggleSort(col.key)} title={col.ind ? ind(col.ind).explainer : undefined}>
                      <span className="ct-label">{col.label} {sort.key === col.key ? (sort.dir === 1 ? '↑' : '↓') : ''}</span>
                      <span className="ct-hint">{col.hint}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(({ c, cells }) => {
                const pickIdx = filters.countries.indexOf(c.id);
                const picked = pickIdx >= 0;
                return (
                  <tr key={c.id} className={`${picked ? 'picked' : ''} ${filters.focus === c.id ? 'focus' : ''}`}>
                    <td className="ct-pick">
                      <label className="ct-check" title={picked ? 'Remove from comparison' : filters.countries.length >= MAX_COUNTRIES ? 'You can compare up to 5 countries' : 'Add to comparison'}>
                        <input type="checkbox" checked={picked} disabled={!picked && filters.countries.length >= MAX_COUNTRIES} onChange={() => toggleCompare(c.id)} aria-label={`Compare ${c.name}`} />
                        <span className="ct-box" style={picked ? { background: SERIES[pickIdx], borderColor: SERIES[pickIdx] } : undefined} aria-hidden="true" />
                      </label>
                    </td>
                    <th scope="row" className="ct-country">
                      <button className="ct-name" onClick={() => { selectCountry(c.id); scrollToId('map'); }} title={`Open the ${c.name} profile`}>
                        <Flag id={c.id} /> {c.name}
                      </button>
                    </th>
                    {COLS.map((col) => <Td key={col.key} col={col} cell={cells[col.key]} indicator={col.ind ? ind(col.ind) : undefined} year={year} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!shown.length && <p className="empty">No country matches “{q}” in this region.</p>}
        </div>
        <p className="caption">
          Showing {shown.length} of {data.countries.length} countries. Cell colours follow the map: darker orange means more expensive or faster rising, blue means falling. “—” means no comparable data.
          Home prices are not official statistics (Deloitte Property Index; Montenegro: Monstat). Years of income = price of a 70 m² home ÷ median yearly disposable income per person.{' '}
          <a href="#/methodology">Where the numbers come from →</a>
        </p>
      </div>
    </section>
  );
}

function Td({ col, cell, indicator, year }: { col: Col; cell: Cell; indicator?: Indicator; year: number }) {
  if (cell.v === undefined) return <td className="na">—</td>;
  let text: string;
  if (col.derived === 'home') text = fmtEuroRound(cell.v);
  else if (col.derived === 'years') text = `${fmt(cell.v, 1)} yrs`;
  else if (indicator!.id === 'price_m2') text = `€${Math.round(cell.v).toLocaleString('en-GB')}`;
  else if (indicator!.kind === 'rate') text = fmtSigned(cell.v, indicator!.decimals, '%');
  else text = fmt(cell.v, indicator!.decimals, indicator!.unitShort.trim() === '%' ? '%' : '');
  const tint = indicator ? colorScale(indicator).color(cell.v) : undefined;
  const flags = describeFlag(cell.f);
  return (
    <td style={tint ? { ['--tint' as string]: tint } : undefined} className={tint ? 'tinted' : ''}>
      {text}
      {cell.y !== undefined && cell.y !== year && <span className="yr">{cell.y}</span>}
      {flags.length > 0 && <span className="flagmark" title={flags.join(', ')}>{flags[0][0]}</span>}
    </td>
  );
}
