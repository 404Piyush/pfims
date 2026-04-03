const YahooFinance = require('yahoo-finance2').default;
const StockData = require('../models/StockData');

const yahooFinance = new YahooFinance();
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STORED_RECORD_LIMIT = 500;

class StockDataService {
  async getHistoricalStockData(ticker) {
    const normalizedTicker = String(ticker || '').trim().toUpperCase();
    const existing = await StockData.findOne({ ticker: normalizedTicker }).lean();

    if (this.isFresh(existing?.lastUpdated) && Array.isArray(existing?.historical) && existing.historical.length) {
      return existing.historical;
    }

    const fresh = await this.fetchFromYahoo(normalizedTicker);
    await this.upsertHistoricalData(normalizedTicker, fresh);
    return fresh;
  }

  isFresh(lastUpdated) {
    const ts = new Date(lastUpdated || '').getTime();
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < CACHE_MAX_AGE_MS;
  }

  async fetchFromYahoo(ticker) {
    const period2 = new Date();
    const period1 = new Date(Date.now() - 1095 * 24 * 60 * 60 * 1000);
    const chart = await yahooFinance.chart(ticker, { period1, period2, interval: '1d' });
    const quotes = Array.isArray(chart?.quotes) ? chart.quotes : [];

    const cleaned = quotes
      .filter((q) => q && q.date && Number.isFinite(q.close) && Number.isFinite(q.volume))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((q) => ({
        date: new Date(q.date),
        open: Number.isFinite(q.open) ? q.open : null,
        high: Number.isFinite(q.high) ? q.high : null,
        low: Number.isFinite(q.low) ? q.low : null,
        close: q.close,
        volume: q.volume,
      }));

    return cleaned.slice(-STORED_RECORD_LIMIT);
  }

  async upsertHistoricalData(ticker, historicalRows) {
    const limitedRows = Array.isArray(historicalRows)
      ? historicalRows.slice(-STORED_RECORD_LIMIT)
      : [];

    await StockData.findOneAndUpdate(
      { ticker },
      {
        $set: {
          ticker,
          historical: limitedRows,
          lastUpdated: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  }
}

module.exports = new StockDataService();
