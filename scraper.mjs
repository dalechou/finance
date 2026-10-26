import fs from 'node:fs';

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

if (!API_KEY) {
  throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
}

const BASE_URL = 'https://www.alphavantage.co/query';

function getForexPairs() {
  return fs
    .readFileSync('forex.txt', 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim().toLowerCase())
    .filter(line => /^[a-z]{3}_[a-z]{3}$/.test(line));
}

function getTickers() {
  return fs
    .readFileSync('ticker.txt', 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim().toUpperCase())
    .filter(line => /^[A-Z0-9.^-]+$/.test(line));
}

function buildApiUrl(params) {
  const url = new URL(BASE_URL);
  url.search = new URLSearchParams({
    ...params,
    apikey: API_KEY,
  }).toString();
  return url;
}

async function fetchAlphaVantage(params) {
  const response = await fetch(buildApiUrl(params), {
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Alpha Vantage HTTP error: ${response.status}`);
  }

  const data = await response.json();

  if (data['Error Message']) {
    throw new Error(`Alpha Vantage error: ${data['Error Message']}`);
  }

  if (data['Note'] || data['Information']) {
    throw new Error(
      `Alpha Vantage notice: ${data['Note'] || data['Information']}`
    );
  }

  return data;
}

async function fetchForexRate(fromCurrency, toCurrency) {
  const data = await fetchAlphaVantage({
    function: 'CURRENCY_EXCHANGE_RATE',
    from_currency: fromCurrency,
    to_currency: toCurrency,
  });

  const rateText =
    data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
  const rate = Number.parseFloat(rateText);

  if (!Number.isFinite(rate)) {
    throw new Error(`No valid exchange rate returned for ${fromCurrency}/${toCurrency}`);
  }

  console.log(`  ${fromCurrency}/${toCurrency}: ${rate}`);
  return rate;
}

async function fetchStockQuote(symbol) {
  const data = await fetchAlphaVantage({
    function: 'GLOBAL_QUOTE',
    symbol,
  });

  const priceText = data['Global Quote']?.['05. price'];
  const price = Number.parseFloat(priceText);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`No valid price returned for ${symbol}`);
  }

  console.log(`  ${symbol}: ${price}`);
  return price;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function saveToCSV() {
  const forexPairs = getForexPairs();
  const tickers = getTickers();

  if (forexPairs.length === 0 && tickers.length === 0) {
    throw new Error('No valid forex pairs or tickers found in input files');
  }

  console.log('Fetching forex pairs:', forexPairs);
  console.log('Fetching tickers:', tickers);

  const values = [];

  for (const pair of forexPairs) {
    const [from, to] = pair.toUpperCase().split('_');
    console.log(`Fetching forex rate: ${from} -> ${to}`);
    values.push(await fetchForexRate(from, to));
    await delay(1000);
  }

  for (const ticker of tickers) {
    console.log(`Fetching stock quote: ${ticker}`);
    values.push(await fetchStockQuote(ticker));
    await delay(1000);
  }

  const timestamp = new Date().toISOString();
  const header = ['datetime', ...forexPairs, ...tickers].join(',');
  const row = [timestamp, ...values].join(',');

  fs.writeFileSync('financial_data.csv', `${header}\n${row}\n`, 'utf8');
  console.log('Data successfully written to financial_data.csv');
  console.log(`Timestamp: ${timestamp}`);
}

saveToCSV().catch(error => {
  console.error('Scraper failed:', error.message);
  process.exitCode = 1;
});
