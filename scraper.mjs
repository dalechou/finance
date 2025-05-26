import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

// Get Alpha Vantage API key from environment variable
const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;

// Read forex pair from forex.txt (should be e.g. 'usd_twd')
function getForexPair() {
  const forexLabel = fs.readFileSync('forex.txt', 'utf8').trim();
  // Split to get from_currency and to_currency, e.g., 'usd_twd' -> ['usd','twd']
  const [from, to] = forexLabel.toUpperCase().split('_');
  return { from, to };
}

// Read ticker symbols from ticker.txt (one per line)
function getTickers() {
  return fs.readFileSync('ticker.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

// Alpha Vantage Forex endpoint
async function getForexRate(from, to) {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${ALPHAVANTAGE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage Forex API error: ${response.status}`);
  const data = await response.json();
  const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
  if (!rate) throw new Error(`Missing ${from}/${to} rate from Alpha Vantage`);
  return parseFloat(rate);
}

// Alpha Vantage Stock endpoint (GLOBAL_QUOTE)
async function getStockPrice(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHAVANTAGE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage Stock API error: ${response.status}`);
  const data = await response.json();
  const price = data['Global Quote']?.['05. price'];
  if (!price) throw new Error(`No price for ${symbol} from Alpha Vantage`);
  return parseFloat(price);
}

async function saveToCSV() {
  const date = DateTime.now().toISO();
  const { from, to } = getForexPair();
  const forexRate = await getForexRate(from, to);

  const tickers = getTickers();
  const prices = [];
  for (const ticker of tickers) {
    prices.push(await getStockPrice(ticker));
  }

  // Build CSV header and row
  const header = ['datetime', `${from.toLowerCase()}_${to.toLowerCase()}`, ...tickers.map(t => t.toLowerCase())].join(',') + '\n';
  const row = [date, forexRate, ...prices].join(',') + '\n';
  fs.writeFileSync('financial_data.csv', header + row, { encoding: 'utf8' });
  console.log('Data successfully written (overwritten) to CSV in UTF-8 encoding.');
}

saveToCSV().catch(console.error);