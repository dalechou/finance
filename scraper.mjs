import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

async function getForexRate() {
  const url = 'https://api.exchangerate-api.com/v4/latest/USD';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Forex API error: ${response.status}`);
  const data = await response.json();
  if (!data.rates || !data.rates.TWD) throw new Error('Missing TWD rate');
  return data.rates.TWD;
}

async function getStockPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yahoo Finance API error: ${response.status}`);
  const data = await response.json();
  const result = data?.quoteResponse?.result?.[0];
  if (!result || typeof result.regularMarketPrice !== 'number') throw new Error(`No price for ${symbol}`);
  return result.regularMarketPrice;
}

async function saveToCSV() {
  const date = DateTime.now().toISO();
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  // Write header if file does not exist
  if (!fs.existsSync('financial_data.csv')) {
    fs.writeFileSync('financial_data.csv', 'datetime,usd_twd,aapl,msft,nvda,tsm\n');
  }

  const row = `${date},${forexRate},${aaplPrice},${msftPrice},${nvdaPrice},${tsmPrice}`;
  
  // Optionally, check last row and only append if changed
  const lines = fs.readFileSync('financial_data.csv', 'utf8').trim().split('\n');
  if (lines[lines.length - 1] !== row) {
    fs.appendFileSync('financial_data.csv', row + '\n');
    console.log('Data successfully written to CSV.');
  } else {
    console.log('No data change detected, not appending.');
  }
}

saveToCSV().catch(console.error);