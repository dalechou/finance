import fetch from 'node-fetch';  // Use import for node-fetch (ESM)
import fs from 'fs';

async function getForexRate() {
  try {
    const response = await fetch('https://api.exchangerate.host/convert?from=USD&to=TWD');
    const data = await response.json();
    console.log('Forex API Response:', data);

    if (data.info && data.info.rate) {
      return data.info.rate;
    } else {
      throw new Error('Rate data not found in API response');
    }
  } catch (error) {
    console.error('Error fetching forex rate:', error.message);
    return null;
  }
}

async function getStockPrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Stock Price API Response for ${symbol}:`, data);

    if (data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0]) {
      return data.quoteResponse.result[0].regularMarketPrice;
    } else {
      throw new Error('Stock price data not found');
    }
  } catch (error) {
    console.error(`Error fetching stock price for ${symbol}:`, error.message);
    return null;
  }
}

async function saveToCSV() {
  const forexRate = await getForexRate();
  const aaplPrice = await getStockPrice('AAPL');
  const msftPrice = await getStockPrice('MSFT');
  const nvdaPrice = await getStockPrice('NVDA');
  const tsmPrice = await getStockPrice('TSM');

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

  // Check if the file is actu
