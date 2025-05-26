import fetch from 'node-fetch';  // Use import for node-fetch (ESM)
import fs from 'fs';

async function getForexRate() {
  const response = await fetch('https://api.exchangerate.host/convert?from=USD&to=TWD');
  const data = await response.json();
  return data.info.rate;
}

async function getStockPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.quoteResponse.result[0].regularMarketPrice;
}

async function saveToCSV() {
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  const csvData = [
    ['Date', 'USD to TWD', 'AAPL Price', 'MSFT Price', 'NVDA Price', 'TSM Price'],
    [new Date().toISOString(), forexRate, aaplPrice, msftPrice, nvdaPrice, tsmPrice],
  ]
    .map(row => row.join(','))
    .join('\n');

  fs.writeFileSync('financial_data.csv', csvData, 'utf8');
  console.log('CSV file saved successfully.');
}

saveToCSV();
