import fetch from 'node-fetch';  // Use import for node-fetch (ESM)
import fs from 'fs';

async function getForexRate() {
  try {
    const response = await fetch('https://api.exchangerate.host/convert?from=USD&to=TWD');
    const data = await response.json();

    // Log the entire response for debugging
    console.log('Forex API Response:', data);

    // Check if 'data.info' and 'data.info.rate' are defined before using them
    if (data.info && data.info.rate) {
      return data.info.rate;
    } else {
      throw new Error('Rate data not found in API response');
    }
  } catch (error) {
    console.error('Error fetching forex rate:', error.message);
    return null;  // Return null if there is an error fetching the data
  }
}

async function getStockPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    // Log the entire response for debugging
    console.log(`Stock Price API Response for ${symbol}:`, data);

    // Check if the price is available
    if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0]) {
      return data.quoteResponse.result[0].regularMarketPrice;
    } else {
      throw new Error('Stock price data not found');
    }
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error.message);
    return null;  // Return null if there is an error fetching the data
  }
}

async function saveToCSV() {
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

  // If any of the data is null, return an error and stop the process
  if (forexRate === null || aaplPrice === null || msftPrice === null || nvdaPrice === null || tsmPrice === null) {
    console.error('Error: One or more data points are missing.');
    return;
  }

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
