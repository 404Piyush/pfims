const express = require('express');
const { body, query } = require('express-validator');
const YahooFinance = require('yahoo-finance2').default;
const { auth } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const round = (n, decimals = 2) => {
  if (n === null || n === undefined || n === '') return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

const computeSMA = (values, period) => {
  if (!Array.isArray(values) || values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((acc, v) => acc + v, 0);
  return sum / period;
};

const computeRollingSMA = (values, period) => {
  if (!Array.isArray(values) || values.length === 0 || !Number.isFinite(period) || period <= 0) return [];
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
};

const computeEMASeries = (values, period) => {
  if (!Array.isArray(values) || values.length < period) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);

  const firstSma = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = firstSma;

  for (let i = period; i < values.length; i += 1) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }

  return out;
};

const computeRsi14 = (closes) => {
  if (!Array.isArray(closes) || closes.length < 15) return null;
  const recent = closes.slice(closes.length - 15);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < recent.length; i += 1) {
    const diff = recent[i] - recent[i - 1];
    if (diff > 0) gains += diff;
    if (diff < 0) losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0 && avgGain === 0) return 50;
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

const rsiSignal = (rsi) => {
  if (!Number.isFinite(rsi)) return { signal: 'HOLD', score: 0, label: 'Neutral' };
  if (rsi < 30) return { signal: 'BUY', score: 2.5, label: 'Oversold' };
  if (rsi > 70) return { signal: 'SELL', score: -2.5, label: 'Overbought' };
  if (rsi >= 40 && rsi <= 60) return { signal: 'HOLD', score: 0, label: 'Neutral' };
  return { signal: 'HOLD', score: 0, label: 'Neutral' };
};

const maSignal = ({ currentPrice, sma20, sma50, sma200 }) => {
  const numbersOk = [currentPrice, sma20, sma50, sma200].every((n) => Number.isFinite(n));
  if (!numbersOk) return { signal: 'HOLD', score: 0 };

  const bullish = [
    currentPrice > sma20,
    sma20 > sma50,
    sma50 > sma200,
  ];
  const bearish = [
    currentPrice < sma20,
    sma20 < sma50,
    sma50 < sma200,
  ];

  const bullishCount = bullish.filter(Boolean).length;
  const bearishCount = bearish.filter(Boolean).length;
  const step = 3.5 / 3;

  if (bullishCount === 3) return { signal: 'BUY', score: 3.5 };
  if (bearishCount === 3) return { signal: 'SELL', score: -3.5 };
  if (bullishCount > 0 && bearishCount > 0) return { signal: 'HOLD', score: 0 };

  const score = round((bullishCount - bearishCount) * step, 2) || 0;
  if (bullishCount >= 2) return { signal: 'BUY', score };
  if (bearishCount >= 2) return { signal: 'SELL', score };
  return { signal: 'HOLD', score: 0 };
};

const macdSignal = (closes) => {
  if (!Array.isArray(closes) || closes.length < 35) return null;
  const ema12 = computeEMASeries(closes, 12);
  const ema26 = computeEMASeries(closes, 26);
  const macdLineSeries = closes.map((_, i) => {
    if (ema12[i] == null || ema26[i] == null) return null;
    return ema12[i] - ema26[i];
  });

  const compact = macdLineSeries.map((v) => (v == null ? null : v));
  const nonNull = compact.map((v, i) => (v == null ? null : { v, i })).filter(Boolean);
  if (nonNull.length < 10) return null;

  const macdValues = nonNull.map((p) => p.v);
  const signalSeries = computeEMASeries(macdValues, 9);
  const lastMacd = macdValues[macdValues.length - 1];
  const lastSignal = signalSeries[signalSeries.length - 1];
  const histogram = lastMacd - lastSignal;

  if (!Number.isFinite(lastMacd) || !Number.isFinite(lastSignal)) return null;
  if (lastMacd > lastSignal) {
    return { macdLine: lastMacd, signalLine: lastSignal, histogram, signal: 'BUY', score: 2.5 };
  }
  if (lastMacd < lastSignal) {
    return { macdLine: lastMacd, signalLine: lastSignal, histogram, signal: 'SELL', score: -2.5 };
  }
  return { macdLine: lastMacd, signalLine: lastSignal, histogram, signal: 'HOLD', score: 0 };
};

const volumeSignal = ({ closes, volumes }) => {
  if (!Array.isArray(closes) || !Array.isArray(volumes) || closes.length < 21 || volumes.length < 21) return null;
  const todayClose = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  const todayVol = volumes[volumes.length - 1];
  const avg20 = volumes.slice(volumes.length - 20).reduce((a, b) => a + b, 0) / 20;
  const changePercent = avg20 > 0 ? ((todayVol - avg20) / avg20) * 100 : 0;

  const volumeAbove = todayVol > avg20;
  const priceUp = todayClose > prevClose;
  const priceDown = todayClose < prevClose;

  if (volumeAbove && priceUp) {
    return { todayVolume: todayVol, avgVolume: avg20, changePercent, signal: 'BUY', score: 1.5 };
  }
  if (volumeAbove && priceDown) {
    return { todayVolume: todayVol, avgVolume: avg20, changePercent, signal: 'SELL', score: -1.5 };
  }
  return { todayVolume: todayVol, avgVolume: avg20, changePercent, signal: 'HOLD', score: 0 };
};

const buildReasonSummary = ({ rsi, ma, macd, volume }) => {
  const parts = [];

  if (ma?.signal === 'BUY') parts.push('Strong uptrend across moving averages');
  if (ma?.signal === 'SELL') parts.push('Downtrend across moving averages');

  if (macd?.signal === 'BUY') parts.push('Bullish MACD momentum');
  if (macd?.signal === 'SELL') parts.push('Bearish MACD momentum');

  if (volume?.signal === 'BUY') parts.push(`High volume (${round(volume.changePercent, 0)}% above average)`);
  if (volume?.signal === 'SELL') parts.push(`High volume on red day (${round(volume.changePercent, 0)}% above average)`);

  if (rsi?.label && Number.isFinite(rsi.value)) {
    if (rsi.value > 70) parts.push(`RSI elevated at ${round(rsi.value, 0)} — monitor for reversal`);
    else if (rsi.value < 30) parts.push(`RSI low at ${round(rsi.value, 0)} — potential rebound`);
    else parts.push(`RSI neutral at ${round(rsi.value, 0)}`);
  }

  return parts.filter(Boolean).join(' · ') || 'No strong technical signal';
};

router.get(
  '/search',
  [
    query('q')
      .isString()
      .trim()
      .isLength({ min: 1, max: 60 })
      .withMessage('Query is required'),
  ],
  auth,
  handleValidationErrors,
  async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const raw = await yahooFinance.search(q);
      const quotes = Array.isArray(raw?.quotes) ? raw.quotes : [];
      const items = quotes
        .filter((r) => r?.symbol && (r?.quoteType === 'EQUITY' || r?.quoteType === 'ETF' || r?.quoteType === 'INDEX'))
        .slice(0, 10)
        .map((r) => ({
          ticker: String(r.symbol).toUpperCase(),
          name: r.longname || r.shortname || r.displayName || r.name || String(r.symbol).toUpperCase(),
          exchange: r.exchDisp || r.exchange || undefined,
        }));

      return res.json({ success: true, data: { results: items } });
    } catch (error) {
      const message = error?.message || 'Server error';
      return res.status(500).json({
        success: false,
        message: 'Failed to search tickers',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      });
    }
  }
);

router.post(
  '/',
  [
    body('ticker')
      .isString()
      .trim()
      .isLength({ min: 1, max: 24 })
      .withMessage('Ticker is required'),
  ],
  auth,
  handleValidationErrors,
  async (req, res) => {
    try {
      const ticker = String(req.body.ticker || '').trim().toUpperCase();
      if (!/^[A-Z0-9.\-^=]{1,24}$/.test(ticker)) {
        return res.status(400).json({ success: false, message: 'Invalid ticker format' });
      }

      const period2 = new Date();
      const period1 = new Date(Date.now() - 370 * 24 * 60 * 60 * 1000);
      const [quote, chart] = await Promise.all([
        yahooFinance.quote(ticker),
        yahooFinance.chart(ticker, { period1, period2, interval: '1d' }),
      ]);

      const quotes = Array.isArray(chart?.quotes) ? chart.quotes : [];
      const cleaned = quotes
        .filter((q) => q && q.date && Number.isFinite(q.close) && Number.isFinite(q.volume))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (cleaned.length < 200) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient data (need at least 200 trading days)',
        });
      }

      const last200 = cleaned.slice(cleaned.length - 200);
      const closes = last200.map((q) => q.close);
      const volumes = last200.map((q) => q.volume);

      const currentPrice = Number.isFinite(quote?.regularMarketPrice)
        ? quote.regularMarketPrice
        : closes[closes.length - 1];

      const name = quote?.longName || quote?.shortName || quote?.displayName || ticker;

      const rsiValue = computeRsi14(closes);
      const rsiInfo = rsiSignal(rsiValue);
      const rsi = {
        value: round(rsiValue, 0),
        signal: rsiInfo.signal,
        score: rsiInfo.score,
        label: rsiInfo.label,
      };

      const sma20 = computeSMA(closes, 20);
      const sma50 = computeSMA(closes, 50);
      const sma200 = computeSMA(closes, 200);
      const maInfo = maSignal({ currentPrice, sma20, sma50, sma200 });
      const movingAverages = {
        sma20: round(sma20, 2),
        sma50: round(sma50, 2),
        sma200: round(sma200, 2),
        signal: maInfo.signal,
        score: maInfo.score,
      };

      const macdRaw = macdSignal(closes);
      if (!macdRaw) {
        return res.status(400).json({ success: false, message: 'Insufficient data for MACD calculation' });
      }
      const macd = {
        macdLine: round(macdRaw.macdLine, 2),
        signalLine: round(macdRaw.signalLine, 2),
        histogram: round(macdRaw.histogram, 2),
        signal: macdRaw.signal,
        score: macdRaw.score,
      };

      const volumeRaw = volumeSignal({ closes, volumes });
      if (!volumeRaw) {
        return res.status(400).json({ success: false, message: 'Insufficient data for volume analysis' });
      }
      const volume = {
        todayVolume: Math.round(volumeRaw.todayVolume),
        avgVolume: Math.round(volumeRaw.avgVolume),
        changePercent: round(volumeRaw.changePercent, 0),
        signal: volumeRaw.signal,
        score: volumeRaw.score,
      };

      const totalScore = round(
        (rsi.score || 0) + (movingAverages.score || 0) + (macd.score || 0) + (volume.score || 0),
        2
      );

      const recommendation =
        totalScore > 3 ? 'BUY' : totalScore < -3 ? 'SELL' : 'HOLD';
      const confidence = clamp(Math.round((Math.abs(totalScore) / 10) * 100), 0, 100);

      const reasonSummary = buildReasonSummary({
        rsi,
        ma: movingAverages,
        macd,
        volume,
      });

      const rolling20 = computeRollingSMA(closes, 20);
      const rolling50 = computeRollingSMA(closes, 50);
      const rolling200 = computeRollingSMA(closes, 200);
      const history = last200.map((row, idx) => ({
        date: row?.date ? new Date(row.date).toISOString().slice(0, 10) : null,
        close: round(row?.close, 2),
        volume: Number.isFinite(row?.volume) ? Math.round(row.volume) : null,
        sma20: round(rolling20[idx], 2),
        sma50: round(rolling50[idx], 2),
        sma200: round(rolling200[idx], 2),
      }));

      return res.json({
        ticker,
        name,
        currentPrice: round(currentPrice, 2),
        recommendation,
        confidence,
        history,
        indicators: {
          rsi: { value: rsi.value, signal: rsi.signal, score: rsi.score },
          movingAverages,
          macd,
          volume,
        },
        totalScore,
        reasonSummary,
      });
    } catch (error) {
      const message = error?.message || 'Server error';
      const status = message.toLowerCase().includes('not found') ? 404 : 500;
      return res.status(status).json({
        success: false,
        message: 'Failed to analyse ticker',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      });
    }
  }
);

module.exports = router;
