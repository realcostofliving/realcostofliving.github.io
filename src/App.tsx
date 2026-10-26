import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dataset } from './lib/types';
import { defaultYear, loadDataset, modeSupported } from './lib/data';
import { Ctx, defaultFilters, filtersFromHash, filtersToQuery, MAX_COUNTRIES, type AppCtx, type Filters } from './lib/state';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import KpiCards from './components/KpiCards';
import MapSection from './components/MapSection';
import StartHere from './components/StartHere';
import CountryTable from './components/CountryTable';
import Calculator from './components/Calculator';
import { initialLang, localize, rememberLang, setLang as applyLang, t, type Lang } from './lib/i18n';
import TrendExplorer from './components/TrendExplorer';
import Comparison from './components/Comparison';
import Affordability from './components/Affordability';
import CostOfLiving from './components/CostOfLiving';
import Methodology from './components/Methodology';
import Footer from './components/Footer';

type Page = 'dashboard' | 'methodology';
const pageFromHash = (h: string): Page => (h.startsWith('#/methodology') ? 'methodology' : 'dashboard');

export default function App() {
  const [loaded, setLoaded] = useState<{ data: Dataset; topo: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDataset().then(setLoaded).catch((e) => setError(String(e.message ?? e)));
  }, []);

  if (error) {
    return (
      <div className="boot">
        <p className="boot-title">{t('The data could not be loaded.')}</p>
        <p>{error}</p>
        <button className="btn" onClick={() => location.reload()}>{t('Try again')}</button>
      </div>
    );
  }
  if (!loaded) {
    return (
      <div className="boot" aria-busy="true">
        <p className="boot-title">{t('Europe: The Real Cost of Living')}</p>
        <p>{t('Loading official statistics…')}</p>
      </div>
    );
  }
  return <Loaded raw={loaded.data} topo={loaded.topo} />;
}

function Loaded({ raw, topo }: { raw: Dataset; topo: any }) {
  const [lang, setLangState] = useState<Lang>(() => { const l = initialLang(); applyLang(l); return l; });
  const setLang = useCallback((l: Lang) => { applyLang(l); rememberLang(l); setLangState(l); }, []);
  // Country, region and indicator texts in the chosen language.
  const data = useMemo(() => localize(raw, lang), [raw, lang]);
  const langQuery = (q: string) => (lang === 'sq' ? (q ? `${q}&lang=sq` : '?lang=sq') : q);
  const defaults = useMemo(() => defaultFilters(data), [data]);
  const [filters, setFilters] = useState<Filters>(() => filtersFromHash(data, location.hash));
  const [page, setPage] = useState<Page>(() => pageFromHash(location.hash));
  const skipHash = useRef(false);

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash(location.hash));
      if (skipHash.current) { skipHash.current = false; return; }
      if (!location.hash.startsWith('#/methodology')) setFilters(filtersFromHash(data, location.hash));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [data]);

  // Keep the URL in sync so any view can be shared.
  useEffect(() => {
    if (page !== 'dashboard') return;
    const next = `#/${langQuery(filtersToQuery(filters, defaults))}`;
    if (location.hash !== next && !(location.hash === '' && next === '#/')) {
      skipHash.current = true;
      history.replaceState(null, '', next);
      skipHash.current = false;
    }
  }, [filters, defaults, page, lang]);

  useEffect(() => {
    if (page === 'methodology') window.scrollTo({ top: 0 });
  }, [page]);

  const byId = useMemo(() => new Map(data.indicators.map((i) => [i.id, i])), [data]);
  const names = useMemo(() => new Map(data.countries.map((c) => [c.id, c.name])), [data]);

  // Keep filters consistent: a new indicator keeps the year if it has data, otherwise
  // jumps to its latest comparable year; modes that make no sense for rates fall back.
  const set = useCallback(
    (patch: Partial<Filters>) =>
      setFilters((f) => {
        const next = { ...f, ...patch };
        if (patch.indicator && patch.indicator !== f.indicator) {
          const ind = byId.get(next.indicator)!;
          if (next.year < ind.coverage.first || next.year > ind.coverage.last) next.year = defaultYear(ind);
          if (!modeSupported(ind, next.mode)) next.mode = 'original';
        }
        return next;
      }),
    [byId],
  );
  const reset = useCallback(() => setFilters(defaults), [defaults]);
  const selectCountry = useCallback((id: string) => {
    setFilters((f) => {
      if (f.focus === id) return f;
      const countries = f.countries.includes(id) ? f.countries : [id, ...f.countries].slice(0, MAX_COUNTRIES);
      return { ...f, focus: id, countries };
    });
  }, []);

  const ctx: AppCtx = useMemo(
    () => ({
      data,
      topo,
      filters,
      set,
      reset,
      indicator: byId.get(filters.indicator)!,
      ind: (id: string) => byId.get(id)!,
      countryName: (id: string) => (id === 'EU27' ? t('EU-27') : id === 'EA' ? t('Euro area') : names.get(id) ?? id),
      selectCountry,
      dashHref: `#/${langQuery(filtersToQuery(filters, defaults))}`,
      lang,
      setLang,
    }),
    [data, topo, filters, set, reset, byId, names, selectCountry, defaults, lang, setLang],
  );

  return (
    <Ctx.Provider value={ctx} key={lang}>
      <a className="skip" href="#main">{t('Skip to content')}</a>
      <Header page={page} />
      {page === 'dashboard' ? (
        <>
          <FilterBar />
          <main id="main" className="page">
            <StartHere />
            <KpiCards />
            <MapSection />
            <CountryTable />
            <Calculator />
            <TrendExplorer />
            <Comparison />
            <Affordability />
            <CostOfLiving />
          </main>
        </>
      ) : (
        <main id="main" className="page">
          <Methodology />
        </main>
      )}
      <Footer />
    </Ctx.Provider>
  );
}
