# Europe: The Real Cost of Living

**See what homes, rents and everyday life really cost across Europe, and whether pay is keeping up.**

👉 **Open the site:** https://kevin19e.github.io/europe-cost-of-living/

I built this because I wanted one honest place to answer a simple question: is life in Europe getting more expensive, and can ordinary people still afford a home? It covers 41 countries. That means all 27 EU members, the six Western Balkan countries (Albania, Bosnia and Herzegovina, Kosovo, Montenegro, North Macedonia and Serbia), plus the United Kingdom, Norway, Switzerland, Iceland, Türkiye, Ukraine, Moldova and Belarus. The data runs from 2004 to 2025, with the newest 2026 figures wherever they have been published.

The whole site works in **English and Albanian (Shqip)**.

## Where the numbers come from

Almost everything comes from official statistics: Eurostat, the OECD, the Bank for International Settlements, the World Bank, the Bank of Albania and Monstat (the statistics office of Montenegro).

There is one exception, and the site says so every time it appears. Nobody official publishes home prices in euros per square metre for Europe, so those come from the Deloitte Property Index.

I never guess, fill in or smooth over missing years. If a country has no data, the site shows that clearly instead of pretending it is zero. The figures are a snapshot that gets refreshed and checked once a week, so they are recent but not live.

## What you can do on the site

* **Search for any country** with the button at the top (or press `/`). It understands other spellings too, like UK, Turkey or Kosova.
* **Start with a question.** The opening section has plain questions such as "How much does a home cost?" that take you straight to the answer, plus a few headline facts and a tiny glossary.
* **Explore the map.** Pick a measure, press play to watch the years go by, zoom into the Balkans, and hover over a country to see its numbers. Home prices per square metre are written right on the map.
* **Use the country table.** All 41 countries in one place: home price per m², what a 70 m² home costs, how many years of income that is, house prices, rents, inflation, housing costs, minimum wage, median income, young adults living with their parents and the price level. Search it, sort it, filter by region, tick up to five countries to compare, or download it as a CSV file.
* **Try the calculator.** Type in your monthly take home pay and see what a home would cost you: the price, how many years of pay that is, how long a deposit would take to save, what a mortgage would cost each month with your own interest rate, and how big a home you could realistically afford. It also shows how long the same pay would take in every other country. Everything is worked out on your own device and nothing is sent anywhere.
* **Follow the trends.** Line charts from 2004 onwards with the EU average for comparison. You can switch between actual values, yearly change, change since a chosen year, or a growth index, plus a colourful grid showing every country and every year at once.
* **Compare countries side by side.** For example Albania next to Belgium, or Serbia next to Germany, including a chart that asks "did incomes keep up with house prices?"
* **Check affordability and the cost of living.** Rankings, plain English explanations, price levels for food, energy and transport, and what is driving inflation in each country.
* **Share what you see.** Every view lives in the link, so the Share button sends someone exactly what you are looking at. Shared links show a preview card with a map of home prices.
* **Read the sources.** A separate page explains every measure: where it comes from, what it means, which countries it covers, when it was last updated and what to watch out for.

## What the data covers

Here is what the site has, roughly in order of how often people look for it.

* **Home price per m² in euros:** 27 countries, 2025 (2024 for Bosnia, Slovenia, Denmark and France). Includes Albania, Bosnia, Montenegro and Serbia. Source: Deloitte Property Index and Monstat. Not official statistics.
* **House price index and yearly growth:** 35 countries, 2004 to 2025, plus the second quarter of 2026. Includes Albania (from the Bank of Albania), North Macedonia and Serbia. Source: Eurostat, BIS and the Bank of Albania.
* **Rents and rent inflation:** 36 countries, 2004 to 2025, plus September 2026. Includes Albania, Kosovo, Montenegro, North Macedonia and Serbia.
* **Inflation:** all 41 countries, 2004 to 2025, plus September 2026. Food, energy, transport and housing inflation for 36 countries.
* **Housing costs as a share of income** and **people overburdened by housing costs:** 37 countries, from the EU income survey.
* **Minimum wage:** 30 countries, every January from 2004 to 2026, plus July 2026. Countries without a legal minimum wage show no data.
* **Young adults aged 18 to 34 living with their parents:** 37 countries. **Average age of leaving home:** 34 countries.
* **Median household income:** 37 countries, in euros, in purchasing power and in local currency.
* **Price levels compared with the EU average:** around 38 countries, up to 2024, for everyday spending, food, housing, energy, transport and eating out.
* **Price to income and price to rent ratios, real house prices:** around 30 countries, from the OECD.
* **GDP per person:** all 41 countries.

### Gaps worth knowing about

* There is no official house price index for Bosnia and Herzegovina, Kosovo or Montenegro. Albania's index comes from the Bank of Albania's own survey, which works differently from Eurostat's.
* Bosnia and Herzegovina is missing from the EU income survey and from Eurostat's inflation data. Ukraine, Moldova and Belarus mostly only have inflation and GDP.
* Many Balkan series start later than 2004. For example, Albania's income data starts in 2017 and Serbia's in 2013. The sources page shows the exact years for every country.
* The OECD does not cover any Western Balkan country, so price to income ratios are missing there.
* Yearly figures end in 2025. For 2026 the site only shows the latest month or quarter, clearly marked as part of the year.

## Running it yourself

You need Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:5173. To build the finished site, run `npm run build`.

### Updating the data

```bash
npm run data:fetch
npm run data:validate
```

The first command downloads everything again from the official sources. The second runs a set of checks: no duplicate years, no impossible values, enough countries covered, and every number linked to its source. If anything looks wrong it stops.

A few other helpful commands:

* `npm run og` redraws the preview image used when the link is shared.
* `npm run i18n:check` lists any text that still needs an Albanian translation.
* `npm run data:geo` rebuilds the map shapes (you will rarely need this).

All the settings live in the `scripts` folder. The list of countries and the list of measures are in `scripts/config`, and the two small tables I keep by hand (Deloitte's prices per m² and the Bank of Albania's index) are in `scripts/sources`. Adding a new measure usually means adding one entry to the measures list and running the two commands above.

### Translations

Every piece of text on the site is written in English and looked up in `src/lib/sq.ts` for the Albanian version. If something has no translation yet it simply shows in English.

## How it goes online

The site is hosted for free on GitHub Pages and rebuilds itself automatically:

* Every time I push a change, it checks the data, builds the site and publishes it.
* Every Monday morning it downloads fresh data, checks it, and only publishes it if everything passes. If one source happens to be down that day, the site keeps that source's previous numbers and shows when they were collected.
* The fresh data is published but never committed, so the history of this repository only contains my own work.

One thing to know: the OECD currently refuses requests coming from GitHub's servers, so its three measures only update when I run the download on my own computer.

To publish your own copy, fork the repository and set Pages to use GitHub Actions in the repository settings.

## Built with

React, TypeScript and Vite, with Apache ECharts for the charts and d3 for the map. There is no server, no database and no API keys.

## A few principles I stuck to

* Each country's line comes from one source only, so different methods are never quietly mixed together.
* Numbers that are provisional, estimated or affected by a change in method are marked as such.
* The EU average is always the official figure published by the source, never something I calculated myself.
* Crowdsourced websites like Numbeo are deliberately left out.

## Licence

The code is free to use under the MIT licence. The data belongs to its publishers and is shared under their terms (Eurostat, OECD and World Bank data under CC BY 4.0). Map shapes come from Natural Earth and are in the public domain.

Kosovo: this designation is without prejudice to positions on status, and is in line with UNSCR 1244/1999 and the ICJ Opinion on the Kosovo declaration of independence.

Made by Kevin Elezi.
