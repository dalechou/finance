import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

/**
 * This script uses Yahoo Finance's public JSON endpoint for both:
 *  - forex rates (symbols like USDTWD=X)
 *  - stock/ETF/other quotes (symbols like AAPL, BRK-B, etc.)
 *
 * Input files:
 *  - forex.txt: lines like "usd_twd", "eur_usd" (from_to)
 *  - ticker.txt: one symbol per line (as you already have)
 *
 * Output:
 *  - financial_data.csv (overwritten) with header: datetime, <forex pairs...>, <tickers...>
 *
 * No API key required.
 */

/* Read forex pairs from forex.txt (format: "usd_twd" per line) */
function getForexPairs() {
  return fs
    .readFileSync('forex.txt', 'utf8')
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => /^[a-z]{3}_[a-z]{3}$/.test(line));
}

/* Read tickers from ticker.txt (one per line) */
function getTickers() {
  return fs
    .readFileSync('ticker.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/* Convert forex pair "usd_twd" -> Yahoo symbol "USDTWD=X" */
function forexPairToYahooSymbol(pair) {
  const [from, to] = pair.toUpperCase().split('_');
  return `${from}${to}=X`;
}

/*
 * Fetch quotes for a list of Yahoo symbols using the public endpoint.
 * Returns a map: symbol (as returned by Yahoo) -> numeric price
 */
async function fetchYahooQuotes(symbols) {
  const result = {};
  if (!symbols || symbols.length === 0) return result;

  const batchSize = 50; // Yahoo handles many, but batch to be safe
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const qs = encodeURIComponent(batch.join(','));
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${qs}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'node.js' }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Yahoo Finance API error: ${res.status} ${res.statusText} - ${text}`);
    }
    const data = await res.json();
    const results = (data.quoteResponse && data.quoteResponse.result) || [];

    // Map returned quotes by symbol (Yahoo's symbol field is the canonical key)
    for (const q of results) {
      if (!q || !q.symbol) continue;
      // prefer regularMarketPrice but fall back to other fields
      const price = q.regularMarketPrice ?? q.ask ?? q.bid ?? q.previousClose ?? null;
      if (price == null) {
        console.error(`Yahoo returned quote for ${q.symbol} but missing usable price:`, JSON.stringify(q, null, 2));
        continue;
      }
      result[q.symbol.toUpperCase()] = Number(price);
    }

    // For any requested symbol not returned, log and leave it missing (caller will handle)
    const returnedSymbols = new Set(results.map(r => (r.symbol || '').toUpperCase()));
    for (const s of batch) {
      if (!returnedSymbols.has(s.toUpperCase())) {
        console.error(`Yahoo did not return data for requested symbol: ${s}`);
      }
    }
  }

  return result;
}

/* Main: collect forex and ticker prices and write CSV */
async function saveToCSV() {
  const date = DateTime.now().toISO();

  const forexPairs = getForexPairs(); // ['usd_twd', ...]
  const tickers = getTickers(); // ['AAPL', 'TSLA', ...]

  // Build Yahoo symbols for forex
  const forexYahooSymbols = forexPairs.map(forexPairToYahooSymbol);

  // Combine both lists and fetch in batches to reduce network calls
  // Ensure we keep original ordering for CSV output
  const allSymbols = [...new Set([...forexYahooSymbols.map(s => s.toUpperCase()), ...tickers.map(t => t.toUpperCase())])];

  let quotesMap;
  try {
    quotesMap = await fetchYahooQuotes(allSymbols);
  } catch (err) {
    console.error('Failed to fetch quotes from Yahoo Finance:', err);
    throw err;
  }

  // Map forex rates back to forexPairs order
  const forexRates = forexPairs.map(pair => {
    const sym = forexPairToYahooSymbol(pair).toUpperCase();
    const val = quotesMap[sym];
    if (val === undefined) {
      throw new Error(`Missing forex rate for ${pair} (requested symbol ${sym})`);
    }
    return val;
  });

  // Map tickers to prices preserving order
  const tickerPrices = tickers.map(t => {
    // Yahoo returns the symbol field often as given, but uppercase is safe
    const lookup = t.toUpperCase();
    const price = quotesMap[lookup];
    if (price === undefined) {
      // Some tickers (e.g. BRK.B) might be returned in a different ticker format by Yahoo (BRK-B).
      // Attempt to find a matching returned symbol (loose match)
      const alt = Object.keys(quotesMap).find(k => k.toUpperCase() === lookup || k.replace('-', '.').toUpperCase() === lookup || k.replace('.', '-').toUpperCase() === lookup);
      if (alt) return quotesMap[alt];
      throw new Error(`Missing price for ticker ${t} (looked up ${lookup})`);
    }
    return price;
  });

  // Build CSV: datetime, <forex pairs>, <tickers>
  const header = ['datetime', ...forexPairs, ...tickers].join(',') + '\n';
  const row = [date, ...forexRates, ...tickerPrices].join(',') + '\n';

  fs.writeFileSync('financial_data.csv', header + row, { encoding: 'utf8' });
  console.log('Data successfully written (overwritten) to financial_data.csv in UTF-8 encoding.');
}

saveToCSV().catch(err => {
  console.error(err);
  process.exit(1);
});
