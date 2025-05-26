import fetch from 'node-fetch';
import fs from 'fs';
import { DateTime } from 'luxon';

// Example function to fetch Forex rate
async function getForexRate() {
  const url = 'https://api.exchangerate-api.com/v4/latest/USD';
  const response = await fetch(url);
  const data = await response.json();
  console.log('Forex Rate:', data.rates.TWD);  // Debug log
  return data.rates.TWD;
}

// Example function to fetch stock price for AAPL
async function getStockPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  const response = await fetch(url);
  const data = await response.json();
  console.log(`${symbol} Price:`, data.quoteResponse.result[0].regularMarketPrice);  // Debug log
  return data.quoteResponse.result[0].regularMarketPrice;
}

// Function to write data to CSV
async function saveToCSV() {
  const date = DateTime.now().toISO();
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  const data = [
    `${date},${forexRate},${aaplPrice},${msftPrice},${nvdaPrice},${tsmPrice}`
  ];

  // Append data to CSV
  console.log('Writing to CSV:', data);  // Debug log
  fs.appendFileSync('financial_data.csv', data.join('\n') + '\n');
}

saveToCSV().catch(console.error);
