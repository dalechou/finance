const fetch = require('node-fetch');
const fs = require('fs');

// Function to fetch forex data (USD to TWD)
async function getForexRate() {
  const response = await fetch('https://api.exchangerate.host/convert?from=USD&to=TWD');
  const data = await response.json();
  return data.info.rate;
}

// Function to fetch stock price data
async function getStockPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.quoteResponse.result[0].regularMarketPrice;
}

// Function to save data to CSV
async function saveToCSV() {
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  // Prepare CSV content
  const csvData = [
    ['Date', 'USD to TWD', 'AAPL Price', 'MSFT Price', 'NVDA Price', 'TSM Price'],
    [new Date().toISOString(), forexRate, aaplPrice, msftPrice, nvdaPrice, tsmPrice],
  ]
    .map(row => row.join(','))
    .join('\n');

  // Write CSV to file
  fs.writeFileSync('financial_data.csv', csvData, 'utf8');
  console.log('CSV file saved successfully.');
}

saveToCSV();
