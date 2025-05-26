import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;

// Read forex pairs from forex.txt (multiple lines like 'usd_twd', 'usd_eur', etc.)
function getForexPairs() {
  return fs
    .readFileSync('forex.txt', 'utf8')
    .split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => /^[a-z]{3}_[a-z]{3}$/.test(line));
}

// Read ticker symbols from ticker.txt (one per line, as many as needed)
function getTickers() {
  return fs
    .readFileSync('ticker.txt', 'utf8')
    .split('\n')
    .map(line => line.trim().toUpperCase())
    .filter(line => /^[A-Z0-9.]+$/.test(line));
}

// Fetch forex rate for a given pair
async function getForexRate(from, to) {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${ALPHAVANTAGE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage Forex API error: ${response.status}`);
  const data = await response.json();
  const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
  if (!rate) {
    console.error("Alpha Vantage API response for forex:", JSON.stringify(data, null, 2));
    throw new Error(`Missing ${from}/${to} rate from Alpha Vantage`);
  }
  return parseFloat(rate);
}

// Fetch stock price for a given symbol
async function getStockPrice(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHAVANTAGE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage Stock API error: ${response.status}`);
  const data = await response.json();
  const price = data['Global Quote']?.['05. price'];
  if (!price) {
    console.error(`Alpha Vantage API response for symbol ${symbol}:`, JSON.stringify(data, null, 2));
    throw new Error(`No price for ${symbol} from Alpha Vantage`);
  }
  return parseFloat(price);
}

async function saveToCSV() {
  const date = DateTime.now().toISO();

  // Get forex pairs and their rates
  const forexPairs = getForexPairs();
  const forexHeaders = [];
  const forexRates = [];
  for (const pair of forexPairs) {
    const [from, to] = pair.toUpperCase().split('_');
    forexHeaders.push(pair);
    const rate = await getForexRate(from, to);
    forexRates.push(rate);
  }

  // Get tickers and their prices
  const tickers = getTickers();
  const tickerPrices = [];
  for (const ticker of tickers) {
    const price = await getStockPrice(ticker);
    tickerPrices.push(price);
  }

  // Build CSV header and row
  const header = ['datetime', ...forexHeaders, ...tickers].join(',') + '\n';
  const row = [date, ...forexRates, ...tickerPrices].join(',') + '\n';
  fs.writeFileSync('financial_data.csv', header + row, { encoding: 'utf8' });
  console.log('Data successfully written (overwritten) to CSV in UTF-8 encoding.');
}

saveToCSV().catch(err => {
  console.error(err);
  process.exit(1);
});