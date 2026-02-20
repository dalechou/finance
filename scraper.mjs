import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

/**
 * This script uses Alpha Vantage API for both:
 *  - forex rates (CURRENCY_EXCHANGE_RATE endpoint)
 *  - stock quotes (GLOBAL_QUOTE endpoint)
 *
 * Input files:
 *  - forex.txt: lines like "usd_twd", "eur_usd" (from_to)
 *  - ticker.txt: one symbol per line (as you already have)
 *
 * Output:
 *  - financial_data.csv (overwritten) with header: datetime, <forex pairs...>, <tickers...>
 *
 * Requires:
 *  - ALPHA_VANTAGE_API_KEY environment variable (set as GitHub secret)
 */

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
if (!API_KEY) {
  throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
}

const BASE_URL = 'https://www.alphavantage.co/query';

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
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0);
}

/* Convert forex pair "usd_twd" -> from/to currencies "USD"/"TWD" */
function parseForexPair(pair) {
  const parts = pair.toUpperCase().split('_');
  return { from: parts[0], to: parts[1] };
}

/*
 * Fetch forex rate using Alpha Vantage CURRENCY_EXCHANGE_RATE
 * Returns the exchange rate (from -> to)
 */
async function fetchForexRate(fromCurrency, toCurrency) {
  const url = `${BASE_URL}?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    
    if (!data['Realtime Currency Exchange Rate']) {
      throw new Error(`No exchange rate data returned for ${fromCurrency}/${toCurrency}`);
    }
    
    const rate = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
    if (isNaN(rate)) {
      throw new Error(`Invalid exchange rate value for ${fromCurrency}/${toCurrency}`);
    }
    
    console.log(`  ${fromCurrency}/${toCurrency}: ${rate}`);
    return rate;
  } catch (err) {
    console.error(`Failed to fetch forex rate ${fromCurrency}/${toCurrency}:`, err.message);
    throw err;
  }
}

/*
 * Fetch stock quote using Alpha Vantage GLOBAL_QUOTE
 * Returns the price
 */
async function fetchStockQuote(symbol) {
  const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    
    // Log full response for debugging
    console.log(`  Raw response for ${symbol}:`, JSON.stringify(data));
    
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
    }
    
    if (data['Note']) {
      throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
    }
    
    if (!data['Global Quote']) {
      throw new Error(`No Global Quote object in response for ${symbol}`);
    }
    
    const price = data['Global Quote']['05. price'];
    if (!price || price === '') {
      throw new Error(`No price data in Global Quote for ${symbol}`);
    }
    
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum === 0) {
      throw new Error(`Invalid price value for ${symbol}: ${price}`);
    }
    
    console.log(`  ${symbol}: ${priceNum}`);
    return priceNum;
  } catch (err) {
    console.error(`Failed to fetch stock quote for ${symbol}:`, err.message);
    throw err;
  }
}

/* Main: collect forex and ticker prices and write CSV */
async function saveToCSV() {
  const date = DateTime.now().toISO();

  const forexPairs = getForexPairs(); // ['usd_twd', ...]
  const tickers = getTickers(); // ['AAPL', 'TSM', ...]

  console.log('Fetching forex pairs:', forexPairs);
  console.log('Fetching tickers:', tickers);

  // Fetch forex rates
  const forexRates = [];
  try {
    for (const pair of forexPairs) {
      const { from, to } = parseForexPair(pair);
      console.log(`Fetching forex rate: ${from} -> ${to}`);
      const rate = await fetchForexRate(from, to);
      forexRates.push(rate);
      // Alpha Vantage has rate limits, add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error('Failed to fetch forex rates:', err);
    throw err;
  }

  // Fetch ticker prices
  const tickerPrices = [];
  try {
    for (const ticker of tickers) {
      console.log(`Fetching stock quote: ${ticker}`);
      const price = await fetchStockQuote(ticker);
      tickerPrices.push(price);
      // Alpha Vantage has rate limits, add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (err) {
    console.error('Failed to fetch ticker prices:', err);
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
