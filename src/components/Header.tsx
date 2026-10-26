import { useApp } from '../lib/state';

const SECTIONS = [
  ['overview', 'Overview'],
  ['map', 'Map'],
  ['trends', 'Trends'],
  ['compare', 'Compare'],
  ['affordability', 'Affordability'],
  ['cost-of-living', 'Cost of living'],
];

export default function Header({ page }: { page: 'dashboard' | 'methodology' }) {
  const { data, dashHref } = useApp();
  const retrieved = new Date(data.generatedAt);
  const dateStr = retrieved.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="masthead-top">
          <a className="wordmark" href={dashHref} aria-label="Europe: The Real Cost of Living — home">
            <span className="wordmark-kicker">Europe</span>
            <span className="wordmark-title">The Real Cost of Living</span>
          </a>
          <nav className="masthead-nav" aria-label="Pages">
            <a href={dashHref} aria-current={page === 'dashboard' ? 'page' : undefined}>Explorer</a>
            <a href="#/methodology" aria-current={page === 'methodology' ? 'page' : undefined}>Sources &amp; methods</a>
          </nav>
        </div>
        <div className="masthead-sub">
          <p className="dek">Explore housing costs, affordability, income, and living standards across Europe.</p>
          <p className="updated" title={retrieved.toISOString()}>
            <span className="dot" aria-hidden="true" /> Data retrieved {dateStr} · static snapshot of official statistics, refreshed weekly
          </p>
        </div>
        {page === 'dashboard' && (
          <nav className="section-nav" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                {label}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
