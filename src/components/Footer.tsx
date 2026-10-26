import { useApp } from '../lib/state';
import { t } from '../lib/i18n';

export default function Footer() {
  const { dashHref } = useApp();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <p className="footer-title">{t('Europe: The Real Cost of Living')}</p>
          <p>{t('Built on official statistics from Eurostat, the OECD, the Bank for International Settlements, the World Bank, the Bank of Albania and Monstat; home prices per m² come from the Deloitte Property Index. Figures are a static snapshot that is refreshed and checked again every week; they are not live.')}</p>
          <p className="fineprint">{t('Kosovo: this designation is without prejudice to positions on status, and is in line with UNSCR 1244/1999 and the ICJ Opinion on the Kosovo declaration of independence. Boundaries: Natural Earth (public domain). Country boundaries do not imply any judgement on the legal status of any territory.')}</p>
        </div>
        <nav aria-label="Footer">
          <a href={dashHref}>{t('Explorer')}</a>
          <a href="#/methodology">{t('Sources & methods')}</a>
          <a href="#/methodology?s=limitations">{t('Known limitations')}</a>
        </nav>
      </div>
    </footer>
  );
}
