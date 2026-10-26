# Europe: The Real Cost of Living

**Explore housing costs, affordability, income, and living standards across Europe.**

An interactive, public-interest data explorer covering 41 European countries — all 27 EU member states, the six Western Balkan countries (Albania, Bosnia and Herzegovina, Kosovo, Montenegro, North Macedonia, Serbia), and the United Kingdom, Norway, Switzerland, Iceland, Türkiye, Ukraine, Moldova and Belarus — from 2004 to 2025, with the latest 2026 readings where they have been published.

**Live site:** https://kevin19e.github.io/europe-cost-of-living/

Every number comes from an official source (Eurostat, the OECD, the Bank for International Settlements and the World Bank). Nothing is estimated, interpolated or filled with zeros. The site is a static snapshot that a scheduled job refreshes and re-validates every week — it is not live data.

## What's inside

| Section | What it shows |
|---|---|
| **Overview** | Four KPI cards — house price growth, rent inflation, housing costs as a share of income, price-to-income ratio — for the selected country, the EU-27 aggregate, or the median of a region (clearly labelled), with sparklines, change on the previous year, the benchmark and the latest 2026 reading. |
| **Map** | Choropleth of Europe for 27 indicators, a year slider with a play button, zoom to the Balkans, keyboard-accessible countries, rich tooltips (value, unit, change since the previous available year, benchmark, data status, source) and a distinct pattern for missing data. |
| **Country panel** | Click a country for a profile with nine key measures, sparklines and 2026 partial-year readings; or see a live ranking when nothing is selected. |
| **Trends** | Multi-country line charts with an EU-27 benchmark toggle and four views: original values, yearly change, change since a base year, and indexed (base year = 100). Plus a heatmap of every country and year. |
| **Compare** | Two to five countries side by side: "did incomes keep up?" grouped bars, a key-figures table with status flags, and small multiples. |
| **Affordability** | Plain-English explainers, an affordability ranking with explicit criteria and coverage, prices-vs-pay indexed chart, and a price level vs living standards scatter. |
| **Cost of living** | Price levels by category (PPP-based, EU = 100) and inflation by category (HICP), with the difference between the two explained. |
| **Sources & methods** | Full metadata for every indicator (definition, unit, dataset id, links to dataset and API, coverage, update date, flags, caveats), a coverage matrix, country groupings and known limitations. |

All filters (region, indicator, year, period, values mode, base year, benchmark, countries) are kept in the URL, so any view can be shared.

## Data coverage

Coverage is computed from the committed snapshot (`public/data/data.json`). "WB" lists the Western Balkan countries covered.

| Indicator | Countries | Years | Western Balkans | Source |
|---|---|---|---|---|
| House price growth / index | 34 / 41 | 2004–2025 (+ Q2 2026) | MK, RS | Eurostat `prc_hpi_a`, `prc_hpi_q`; BIS `WS_SPP` |
| Real house prices | 30 / 41 | 2004–2025 | — | OECD analytical house prices |
| House price-to-income ratio | 29 / 41 | 2004–2025 | — | OECD analytical house prices |
| House price-to-rent ratio | 30 / 41 | 2004–2025 | — | OECD analytical house prices |
| Rent inflation / rent index | 36 / 41 | 2004–2025 (+ Sep 2026) | AL, XK, ME, MK, RS | Eurostat HICP `prc_hicp_ainr`, `prc_hicp_minr` |
| Housing cost overburden rate | 37 / 41 | 2004–2025 | AL, XK, ME, MK, RS | Eurostat EU-SILC `ilc_lvho07a` |
| Housing costs as a share of income | 37 / 41 | 2004–2025 | AL, XK, ME, MK, RS | Eurostat EU-SILC `ilc_mded01` |
| Consumer price inflation | 41 / 41 | 2004–2025 (+ Sep 2026) | all six | Eurostat HICP; World Bank CPI for BA, GB, UA, MD, BY |
| Food, energy, transport, housing inflation | 36 / 41 | 2004–2025 (+ Sep 2026) | AL, XK, ME, MK, RS | Eurostat HICP |
| Price levels (overall, food, housing, energy, transport, restaurants) | 37–38 / 41 | 2004–2024 | AL, BA, ME, MK, RS (+ XK for some) | Eurostat `prc_ppp_ind` |
| Consumption and GDP per person in PPS | 37 / 41 | 2004–2024 | AL, BA, ME, MK, RS | Eurostat `prc_ppp_ind` |
| Median household income (PPS, €, national currency) | 37 / 41 | 2004–2025 | AL, XK, ME, MK, RS | Eurostat EU-SILC `ilc_di03` |
| GDP per person (international $) | 41 / 41 | 2004–2025 | all six | World Bank `NY.GDP.PCAP.PP.CD` |

Many series start after 2004 for individual countries (for example EU-SILC from 2013 in Serbia and 2017 in Albania; Kosovo has a single EU-SILC year). The coverage matrix on the methodology page shows the exact range for every country.

### Important gaps

- **House prices:** no comparable official index exists in these databases for Albania, Bosnia and Herzegovina, Kosovo or Montenegro. Serbia and North Macedonia are covered via the BIS.
- **Price-to-income ratios** are OECD-only: no Western Balkan country, Cyprus, Malta, Türkiye, Ukraine, Moldova or Belarus.
- **Bosnia and Herzegovina** is missing from EU-SILC and HICP; **Ukraine, Moldova and Belarus** have only World Bank inflation and GDP.
- **Purchasing power parities** end in 2024 (published with a lag).
- Annual data end in **2025**; for **2026** only the latest monthly (HICP, September 2026) or quarterly (house prices, Q2 2026) year-on-year readings are shown, labelled as partial-year.

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check and build to dist/
npm run preview    # serve the production build
```

## Update the data

```bash
npm run data:fetch     # download all indicators from the official APIs → public/data/data.json
npm run data:validate  # integrity checks (exit code 1 on failure)
npm run data:geo       # rebuild map boundaries → public/data/europe.topo.json (rarely needed)
```

- `scripts/config/countries.mjs` — country list, codes per source, regions and groupings.
- `scripts/config/indicators.mjs` — indicator definitions, plain-English explanations, sources in priority order and caveats.
- `scripts/fetch-data.mjs` — downloads and harmonises the data (Eurostat JSON-stat, OECD SDMX, BIS SDMX, World Bank API). No API keys are needed.
- `scripts/validate-data.mjs` — checks unique country-years, year ranges, numeric values, plausible ranges, minimum coverage, recency, source attribution and map geometry.
- `scripts/build-geo.mjs` — builds simplified TopoJSON from Natural Earth (EU point-of-view edition) with mapshaper.

To add an indicator, add an entry to `indicators.mjs`, run `npm run data:fetch && npm run data:validate`, and it appears in the selectors, map, charts and methodology page automatically.

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages:

- **On every push to `main`:** validates the committed data, builds with `BASE_PATH=/<repo>/` and deploys.
- **Every Monday at 05:17 UTC and on manual runs:** re-downloads all sources, runs the integrity checks, and only publishes the fresh data if they pass. If a source is down or a check fails, the committed snapshot is published instead. Refreshed data are deployed, not committed, so the repository history contains only the author's commits.
- **On pull requests:** validates and builds without deploying.

To deploy your own copy: fork the repository, then in *Settings → Pages* set *Source* to *GitHub Actions*. GitHub pauses scheduled workflows in repositories with no activity for 60 days; re-enable it from the Actions tab if that happens.

The app uses hash-based routing (`#/`, `#/methodology`) and relative asset paths, so it works under any repository path without a 404 fallback.

## Technology

React 18, TypeScript, Vite, Apache ECharts (charts), d3-geo and d3-zoom (map), TopoJSON, flag-icons, Source Serif 4 and IBM Plex Sans. No backend, database or API keys.

## Methodology in brief

- One source per country and indicator; a country's line never silently mixes sources.
- Status flags (provisional, estimated, break in series, low reliability, definition differs) are preserved and shown.
- The EU-27 benchmark is always the official published aggregate; where no country is selected, KPI cards show a clearly labelled median.
- Derived values are limited to BIS quarterly → annual averages (all four quarters required), rebasing to 2015 = 100, growth rates, and on-screen rebasing. All are documented on the methodology page.
- Numbeo and other crowdsourced data are deliberately not used.

## Licences

Code: MIT (see `LICENSE`). Data remain under their providers' terms: Eurostat (© European Union, CC BY 4.0), OECD (CC BY 4.0), BIS (terms of use for statistics), World Bank (CC BY 4.0). Boundaries: Natural Earth (public domain).

Kosovo: this designation is without prejudice to positions on status, and is in line with UNSCR 1244/1999 and the ICJ Opinion on the Kosovo declaration of independence.

---

Created by Kevin Elezi.
