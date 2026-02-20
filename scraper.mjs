import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

/**
 * This script uses Marketstack API for forex rates and intraday stock quotes.
 *
 * Input files:
 *  - forex.txt: lines like "usd_twd", "eur_usd" (from_to)
 *  - ticker.txt: one symbol per line (as you already have)
 *
 * Output:
 *  - financial_data.csv (overwritten) with header: datetime, <forex pairs...>, <tickers...>
 *
 * Requires:
 *  - MARKETSTACK_API_KEY environment variable (set as GitHub secret)
 */

const API_KEY = process.env.MARKETSTACK_API_KEY;
if (!API_KEY) {
  throw new Error('MARKETSTACK_API_KEY environment variable is not set');
}

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

/* Convert forex pair "usd_twd" -> Marketstack symbol "USDTWD" */
function forexPairToMarketstackSymbol(pair) {
  const [from, to] = pair.toUpperCase().split('_');
  return `${from}${to}`;
}

/*
 * Fetch forex rates from Marketstack API
 * Returns a map: symbol -> exchange rate
 */
async function fetchMarketstackForex(symbols) {
  const result = {};
  if (!symbols || symbols.length === 0) return result;

  try {
    for (const symbol of symbols) {
      const url = `http://api.marketstack.com/v1/eod?symbols=${symbol}&access_key=${API_KEY}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Marketstack API error for ${symbol}: ${res.status} ${res.statusText} - ${text}`);
      }

      const data = await res.json();
      
      if (data.error) {
        console.error(`Marketstack API returned error for ${symbol}:`, data.error);
        throw new Error(`Marketstack API error: ${data.error.code} - ${data.error.message}`);
      }

      if (data.data && data.data.length > 0) {
        // Use the close price from the latest data point
        const quote = data.data[0];
        result[symbol] = Number(quote.close) || null;
      } else {
        console.error(`No data returned from Marketstack for ${symbol}`);
      }
    }
  } catch (err) {
    console.error('Error fetching from Marketstack:', err);
    throw err;
  }

  return result;
}

/*
 * Fetch intraday stock quotes from Marketstack API
 * Returns a map: symbol -> price
 */
async function fetchMarketstackQuotes(symbols) {
  const result = {};
  if (!symbols || symbols.length === 0) return result;

  try {
    // Marketstack allows multiple symbols separated by comma
    const symbolList = symbols.join(',');
    const url = `http://api.marketstack.com/v1/intraday?symbols=${symbolList}&access_key=${API_KEY}`;
    
    const res = await fetch(url);
    
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Marketstack API error: ${res.status} ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    
    if (data.error) {
      console.error('Marketstack API returned error:', data.error);
      throw new Error(`Marketstack API error: ${data.error.code} - ${data.error.message}`);
    }

    if (data.data && data.data.length > 0) {
      // Map symbols to their latest price
      for (const quote of data.data) {
        if (quote && quote.symbol) {
          // Use last price, fallback to close price
          const price = quote.last ?? quote.close ?? null;
          if (price != null) {
            result[quote.symbol.toUpperCase()] = Number(price);
          }
        }
      }
    }

    // Log any requested symbols that weren't returned
    const returnedSymbols = new Set((data.data || []).map(d => (d.symbol || '').toUpperCase()));
    for (const s of symbols) {
      if (!returnedSymbols.has(s.toUpperCase())) {
        console.warn(`Marketstack did not return data for requested symbol: ${s}`);
      }
    }
  } catch (err) {
    console.error('Error fetching quotes from Marketstack:', err);
    throw err;
  }

  return result;
}

/* Main: collect forex and ticker prices and write CSV */
async function saveToCSV() {
  const date = DateTime.now().toISO();

  const forexPairs = getForexPairs(); // ['usd_twd', ...]
  const tickers = getTickers(); // ['AAPL', 'TSM', ...]

  console.log('Fetching forex pairs:', forexPairs);
  console.log('Fetching tickers:', tickers);

  // Fetch forex rates
  const forexSymbols = forexPairs.map(forexPairToMarketstackSymbol);
  let forexRates;
  try {
    const forexMap = await fetchMarketstackForex(forexSymbols);
    forexRates = forexPairs.map(pair => {
      const sym = forexPairToMarketstackSymbol(pair);
      const val = forexMap[sym];
      if (val === undefined || val === null) {
        throw new Error(`Missing forex rate for ${pair} (symbol ${sym})`);
      }
      return val;
    });
  } catch (err) {
    console.error('Failed to fetch forex rates from Marketstack:', err);
    throw err;
  }

  // Fetch ticker prices
  let tickerPrices;
  try {
    const quotesMap = await fetchMarketstackQuotes(tickers);
    tickerPrices = tickers.map(t => {
      const lookup = t.toUpperCase();
      const price = quotesMap[lookup];
      if (price === undefined || price === null) {
        throw new Error(`Missing price for ticker ${t}`);
      }
      return price;
    });
  } catch (err) {
    console.error('Failed to fetch ticker prices from Marketstack:', err);
    throw err;
  }

  // Build CSV: datetime, <forex pairs>, <tickers>
  const header = ['datetime', ...forexPairs, ...tickers].join(',') + '\n';
  const row = [date, ...forexRates, ...tickerPrices].join(',') + '\n';

  fs.writeFileSync('financial_data.csv', header + row, { encoding: 'utf8' });
  console.log('Data successfully written to financial_data.csv');
  console.log(`Timestamp: ${date}`);
}

saveToCSV().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
