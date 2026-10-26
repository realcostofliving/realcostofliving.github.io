import { useState } from 'react';
import { useApp } from '../lib/state';
import { dateLocale, t } from '../lib/i18n';
import SearchPalette from './SearchPalette';

const SECTIONS = [
  ['overview', 'Overview'],
  ['map', 'Map'],
  ['table', 'Country table'],
  ['calculator', 'Calculator'],
  ['trends', 'Trends'],
  ['compare', 'Compare'],
  ['affordability', 'Affordability'],
  ['cost-of-living', 'Cost of living'],
];

export default function Header({ page }: { page: 'dashboard' | 'methodology' }) {
  const { data, dashHref, lang, setLang } = useApp();
  const retrieved = new Date(data.generatedAt);
  const dateStr = retrieved.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <div className="masthead-top">
          <a className="wordmark" href={dashHref} aria-label={t('Europe: The Real Cost of Living, home page')}>
            <span className="wordmark-kicker">{t('Europe')}</span>
            <span className="wordmark-title">{t('The Real Cost of Living')}</span>
          </a>
          {page === 'dashboard' && <SearchPalette />}
          <div className="masthead-tools">
            <ShareButton />
            <div className="lang" role="group" aria-label={t('Language')}>
              <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')} lang="en" title="English">EN</button>
              <button className={lang === 'sq' ? 'on' : ''} aria-pressed={lang === 'sq'} onClick={() => setLang('sq')} lang="sq" title="Shqip">SQ</button>
            </div>
          </div>
          <nav className="masthead-nav" aria-label={t('Pages')}>
            <a href={dashHref} aria-current={page === 'dashboard' ? 'page' : undefined}>{t('Explorer')}</a>
            <a href="#/methodology" aria-current={page === 'methodology' ? 'page' : undefined}>{t('Sources & methods')}</a>
          </nav>
        </div>
        <div className="masthead-sub">
          <p className="dek">{t('Explore housing costs, affordability, income, and living standards across Europe.')}</p>
          <p className="updated" title={retrieved.toISOString()}>
            <span className="dot" aria-hidden="true" /> {t('Data retrieved {date} · static snapshot of official statistics, refreshed weekly', { date: dateStr })}
          </p>
        </div>
        {page === 'dashboard' && (
          <nav className="section-nav" aria-label={t('Sections')}>
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                {t(label)}
              </a>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

/** Shares the current view (filters live in the URL): native share sheet on phones, copy elsewhere. */
function ShareButton() {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = location.href;
    const title = t('Europe: The Real Cost of Living');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title, text: t('Explore housing costs, affordability, income, and living standards across Europe.'), url }); return; }
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 2200);
  };
  return (
    <button className={`share-btn ${done ? 'done' : ''}`} onClick={share} title={t('Share a link to exactly what you are looking at')}>
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="12.5" cy="3.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="3.5" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12.5" cy="12.5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.3 7.1l5.4-2.7M5.3 8.9l5.4 2.7" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span aria-live="polite">{done ? t('Link copied') : t('Share')}</span>
    </button>
  );
}
