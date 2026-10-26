import { useApp } from '../lib/state';

export default function Footer() {
  const { dashHref } = useApp();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <p className="footer-title">Europe: The Real Cost of Living</p>
          <p>
            Built on official statistics from Eurostat, the OECD, the Bank for International Settlements and the World Bank. Figures are a
            static snapshot that is refreshed and re-validated every week; they are not live.
          </p>
          <p className="fineprint">
            Kosovo: this designation is without prejudice to positions on status, and is in line with UNSCR 1244/1999 and the ICJ Opinion on the
            Kosovo declaration of independence. Boundaries: Natural Earth (public domain). Country boundaries do not imply any judgement on the
            legal status of any territory.
          </p>
        </div>
        <nav aria-label="Footer">
          <a href={dashHref}>Explorer</a>
          <a href="#/methodology">Sources &amp; methods</a>
          <a href="#/methodology?s=limitations">Known limitations</a>
        </nav>
      </div>
    </footer>
  );
}
