import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

// Get Alpha Vantage API key from environment variable
const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;

// Alpha Vantage Forex endpoint (USD/TWD)
async function getForexRate() {
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=USD&to_currency=TWD&apikey=${ALPHAVANTAGE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage Forex API error: ${response.status}`);
  const data = await response.json();
  const rate = data['Realtime Currency Exchange Rate']?.['5. Exchange Rate'];
  if (!rate) throw new Error('Missing USD/TWD rate from Alpha Vantage');
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
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  // Always overwrite with new data (header + latest row)
  const header = 'datetime,usd_twd,aapl,msft,nvda,tsm\n';
  const row = `${date},${forexRate},${aaplPrice},${msftPrice},${nvdaPrice},${tsmPrice}\n`;
  fs.writeFileSync('financial_data.csv', header + row);
  console.log('Data successfully written (overwritten) to CSV.');
}

saveToCSV().catch(console.error);