const fs = require('fs/promises');
const path = require('path');
const tf = require('@tensorflow/tfjs');

const FEATURE_COLUMNS = [
  'open',
  'high',
  'low',
  'close',
  'volume',
  'dailyReturn',
  'highLowSpread',
  'closeOpenSpread',
  'sma5',
  'sma10',
  'sma20',
  'ema12',
  'ema26',
  'macd',
  'macdSignal',
  'rsi',
  'bbMiddle',
  'bbUpper',
  'bbLower',
  'volumeChange',
  'volumeMa',
];

const MODEL_VERSION = 3;
const round = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

class MinMaxScaler {
  constructor() {
    this.mins = [];
    this.maxs = [];
  }

  fit(matrix) {
    if (!Array.isArray(matrix) || !matrix.length) {
      throw new Error('Scaler fit requires non-empty data');
    }

    const width = matrix[0].length;
    this.mins = new Array(width).fill(Infinity);
    this.maxs = new Array(width).fill(-Infinity);

    for (const row of matrix) {
      for (let i = 0; i < width; i += 1) {
        const value = Number(row[i]);
        if (!Number.isFinite(value)) {
          throw new Error(`Scaler received invalid numeric value at column ${i}`);
        }
        if (value < this.mins[i]) this.mins[i] = value;
        if (value > this.maxs[i]) this.maxs[i] = value;
      }
    }
  }

  transform(matrix) {
    return matrix.map((row) => this.transformRow(row));
  }

  transformRow(row) {
    return row.map((value, index) => {
      const min = this.mins[index];
      const max = this.maxs[index];
      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new Error('Scaler is not fitted');
      }
      if (max === min) return 0;
      return (Number(value) - min) / (max - min);
    });
  }

  inverseValue(value, index = 0) {
    const min = this.mins[index];
    const max = this.maxs[index];
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error('Scaler is not fitted');
    }
    if (max === min) return min;
    return min + Number(value) * (max - min);
  }

  toJSON() {
    return {
      mins: this.mins,
      maxs: this.maxs,
    };
  }

  static fromJSON(payload) {
    const scaler = new MinMaxScaler();
    scaler.mins = Array.isArray(payload?.mins) ? payload.mins : [];
    scaler.maxs = Array.isArray(payload?.maxs) ? payload.maxs : [];
    return scaler;
  }
}

class StockLstmService {
  constructor() {
    this.lookbackDays = Number(process.env.LSTM_LOOKBACK_DAYS || 60);
    this.epochs = Number(process.env.LSTM_EPOCHS || 3);
    this.batchSize = Number(process.env.LSTM_BATCH_SIZE || 16);
    this.modelMaxAgeHours = Number(process.env.LSTM_MODEL_MAX_AGE_HOURS || 24);
    this.maxFeatureRows = Number(process.env.LSTM_MAX_FEATURE_ROWS || 260);
    this.modelDirectory = path.join(__dirname, '..', '.stock-models');
    this.memoryCache = new Map();
    this.trainingJobs = new Map();
  }

  async analyse({ ticker, historicalRows, currentPrice }) {
    if (!Array.isArray(historicalRows) || historicalRows.length < 140) {
      return {
        available: false,
        signal: 'HOLD',
        score: 0,
        error: 'Insufficient data for LSTM analysis',
      };
    }

    try {
      const engineeredRows = this.engineerFeatures(historicalRows);
      if (engineeredRows.length <= this.lookbackDays + 30) {
        return {
          available: false,
          signal: 'HOLD',
          score: 0,
          error: 'Not enough engineered feature rows for LSTM',
        };
      }

      const trainingRows = engineeredRows.slice(-Math.max(this.maxFeatureRows, this.lookbackDays + 60));
      const cacheKey = String(ticker || '').toUpperCase();
      let modelState = await this.getModelState(cacheKey, trainingRows);

      if (!modelState?.model) {
        modelState = await this.ensureModelReady({
          ticker: cacheKey,
          rows: trainingRows,
          fallbackState: modelState,
        });
      }

      if (!modelState?.model) {
        return {
          available: false,
          signal: 'HOLD',
          score: 0,
          confidence: 0,
          currentPrice: round(currentPrice, 2),
          predictedPrice: null,
          changeAmount: null,
          changePercent: null,
          lookbackDays: this.lookbackDays,
          featureCount: FEATURE_COLUMNS.length,
          modelSource: modelState?.status?.modelSource || null,
          trainedAt: modelState?.status?.trainedAt || null,
          metrics: null,
          modelFreshness: modelState?.status?.modelFreshness || 'none',
          trainingState: modelState?.status?.trainingState || 'queued',
          statusMessage: modelState?.status?.statusMessage || 'LSTM model is training in background',
          error: modelState?.status?.statusMessage || 'LSTM model is training in background',
        };
      }

      const predictedPrice = await this.predictNextDay({
        model: modelState.model,
        featureScaler: modelState.featureScaler,
        targetScaler: modelState.targetScaler,
        rows: engineeredRows,
      });
      const forecastDate = this.toDateLabel(this.getNextBusinessDate(this.getForecastBaseDate(historicalRows[historicalRows.length - 1]?.date)));
      const adjustedPrediction = this.refineNextDayPrediction({
        currentPrice,
        predictedPrice,
        rows: historicalRows,
      });

      const signal = this.generateSignal(currentPrice, adjustedPrediction);

      return {
        available: true,
        signal: signal.signal,
        score: signal.points,
        confidence: round(signal.confidence, 0),
        currentPrice: round(currentPrice, 2),
        predictedPrice: round(adjustedPrediction, 2),
        changeAmount: round(signal.changeAmount, 2),
        changePercent: round(signal.changePercent, 2),
        forecastDate,
        lookbackDays: this.lookbackDays,
        featureCount: FEATURE_COLUMNS.length,
        modelSource: modelState.status?.modelSource || null,
        trainedAt: modelState.status?.trainedAt || null,
        metrics: modelState.metadata?.metrics || null,
        modelFreshness: modelState.status?.modelFreshness || 'unknown',
        trainingState: modelState.status?.trainingState || 'idle',
        statusMessage: modelState.status?.statusMessage || null,
        rawPredictedPrice: round(predictedPrice, 2),
      };
    } catch (error) {
      console.error(`LSTM analysis failed for ${ticker}:`, error.message);
      return {
        available: false,
        signal: 'HOLD',
        score: 0,
        error: error.message,
      };
    }
  }

  engineerFeatures(rows) {
    const sorted = rows
      .filter((row) => row && row.date && Number.isFinite(Number(row.close)))
      .map((row, index, array) => {
        const close = Number(row.close);
        const previousClose = index > 0 ? Number(array[index - 1]?.close) : close;
        const open = Number.isFinite(Number(row.open)) ? Number(row.open) : previousClose;
        const high = Number.isFinite(Number(row.high)) ? Number(row.high) : Math.max(open, close);
        const low = Number.isFinite(Number(row.low)) ? Number(row.low) : Math.min(open, close);
        const volume = Number.isFinite(Number(row.volume)) ? Number(row.volume) : 0;

        return {
          date: row.date,
          open,
          high,
          low,
          close,
          volume,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const closes = sorted.map((row) => row.close);
    const volumes = sorted.map((row) => row.volume);
    const sma5 = this.computeRollingMean(closes, 5);
    const sma10 = this.computeRollingMean(closes, 10);
    const sma20 = this.computeRollingMean(closes, 20);
    const ema12 = this.computeEmaSeries(closes, 12);
    const ema26 = this.computeEmaSeries(closes, 26);
    const macd = closes.map((_, index) => {
      if (!Number.isFinite(ema12[index]) || !Number.isFinite(ema26[index])) return null;
      return ema12[index] - ema26[index];
    });
    const macdSignal = this.computeEmaSeries(macd, 9);
    const rsi = this.computeRsiSeries(closes, 14);
    const bbMiddle = this.computeRollingMean(closes, 20);
    const bbStd = this.computeRollingStd(closes, 20);
    const bbUpper = bbMiddle.map((value, index) => (Number.isFinite(value) && Number.isFinite(bbStd[index]) ? value + bbStd[index] * 2 : null));
    const bbLower = bbMiddle.map((value, index) => (Number.isFinite(value) && Number.isFinite(bbStd[index]) ? value - bbStd[index] * 2 : null));
    const volumeChange = volumes.map((value, index) => {
      if (index === 0 || !Number.isFinite(volumes[index - 1]) || volumes[index - 1] === 0) return null;
      return (value - volumes[index - 1]) / volumes[index - 1];
    });
    const volumeMa = this.computeRollingMean(volumes, 20);

    const output = [];

    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index];
      const dailyReturn = row.open === 0 ? null : (row.close - row.open) / row.open;
      const highLowSpread = row.close === 0 ? null : (row.high - row.low) / row.close;
      const closeOpenSpread = row.open === 0 ? null : (row.close - row.open) / row.open;

      const featureRow = {
        date: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
        dailyReturn,
        highLowSpread,
        closeOpenSpread,
        sma5: sma5[index],
        sma10: sma10[index],
        sma20: sma20[index],
        ema12: ema12[index],
        ema26: ema26[index],
        macd: macd[index],
        macdSignal: macdSignal[index],
        rsi: rsi[index],
        bbMiddle: bbMiddle[index],
        bbUpper: bbUpper[index],
        bbLower: bbLower[index],
        volumeChange: volumeChange[index],
        volumeMa: volumeMa[index],
      };

      const valid = FEATURE_COLUMNS.every((column) => Number.isFinite(featureRow[column]));
      if (valid) output.push(featureRow);
    }

    return output;
  }

  prepareTrainingData(rows) {
    const featureMatrix = rows.map((row) => FEATURE_COLUMNS.map((column) => row[column]));
    const targets = rows.map((row) => [row.close]);

    const featureScaler = new MinMaxScaler();
    featureScaler.fit(featureMatrix);
    const targetScaler = new MinMaxScaler();
    targetScaler.fit(targets);

    const normalizedFeatures = featureScaler.transform(featureMatrix);
    const normalizedTargets = targetScaler.transform(targets).map((row) => row[0]);

    const X = [];
    const y = [];

    for (let index = this.lookbackDays; index < normalizedFeatures.length; index += 1) {
      X.push(normalizedFeatures.slice(index - this.lookbackDays, index));
      y.push(normalizedTargets[index]);
    }

    if (X.length < 45) {
      throw new Error('Not enough sequence samples to train LSTM');
    }

    const trainEnd = Math.max(1, Math.floor(X.length * 0.7));
    const validationEnd = Math.max(trainEnd + 1, Math.floor(X.length * 0.85));

    return {
      featureScaler,
      targetScaler,
      XTrain: X.slice(0, trainEnd),
      yTrain: y.slice(0, trainEnd),
      XValidation: X.slice(trainEnd, validationEnd),
      yValidation: y.slice(trainEnd, validationEnd),
      XTest: X.slice(validationEnd),
      yTest: y.slice(validationEnd),
      sampleCount: X.length,
    };
  }

  buildModel(inputShape) {
    const model = tf.sequential();
    model.add(tf.layers.lstm({ units: 32, returnSequences: true, inputShape }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.lstm({ units: 16 }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae'],
    });
    return model;
  }

  async getModelState(ticker, rows) {
    const cacheKey = String(ticker || '').toUpperCase();
    const cached = this.memoryCache.get(cacheKey);
    const activeJob = this.trainingJobs.get(cacheKey);

    if (cached) {
      const freshness = this.getFreshness(cached.metadata?.trainedAt);
      if (freshness === 'fresh') {
        return {
          ...cached,
          status: this.buildStatus({
            trainingState: activeJob?.state || 'idle',
            modelFreshness: 'fresh',
            modelSource: 'memory',
            trainedAt: cached.metadata?.trainedAt || null,
          }),
        };
      }

      this.enqueueTraining(cacheKey, rows);
      return {
        ...cached,
        status: this.buildStatus({
          trainingState: this.trainingJobs.get(cacheKey)?.state || 'queued',
          modelFreshness: 'stale',
          modelSource: 'memory',
          trainedAt: cached.metadata?.trainedAt || null,
        }),
      };
    }

    const persisted = await this.loadModel(cacheKey, { allowStale: true });
    if (persisted) {
      this.memoryCache.set(cacheKey, persisted);
      if (persisted.freshness === 'stale') {
        this.enqueueTraining(cacheKey, rows);
      }
      return {
        ...persisted,
        status: this.buildStatus({
          trainingState: this.trainingJobs.get(cacheKey)?.state || 'idle',
          modelFreshness: persisted.freshness,
          modelSource: 'disk',
          trainedAt: persisted.metadata?.trainedAt || null,
        }),
      };
    }

    this.enqueueTraining(cacheKey, rows);

    return {
      model: null,
      featureScaler: null,
      targetScaler: null,
      metadata: null,
      status: this.buildStatus({
        trainingState: this.trainingJobs.get(cacheKey)?.state || 'queued',
        modelFreshness: 'none',
        modelSource: null,
        trainedAt: null,
      }),
    };
  }

  async ensureModelReady({ ticker, rows, fallbackState }) {
    const activeJob = this.trainingJobs.get(ticker);

    if (activeJob?.promise) {
      const trained = await activeJob.promise;
      if (trained?.model) {
        return {
          ...trained,
          status: this.buildStatus({
            trainingState: 'idle',
            modelFreshness: 'fresh',
            modelSource: 'trained',
            trainedAt: trained.metadata?.trainedAt || null,
          }),
        };
      }
    }

    try {
      const trained = await this.trainModel(rows);
      await this.saveModel(ticker, trained);
      this.memoryCache.set(ticker, trained);
      return {
        ...trained,
        status: this.buildStatus({
          trainingState: 'idle',
          modelFreshness: 'fresh',
          modelSource: 'trained',
          trainedAt: trained.metadata?.trainedAt || null,
        }),
      };
    } catch (error) {
      console.error(`Unable to prepare LSTM model for ${ticker}:`, error.message);
      return fallbackState || null;
    }
  }

  buildStatus({ trainingState, modelFreshness, modelSource, trainedAt }) {
    let statusMessage = null;

    if (modelFreshness === 'none' && (trainingState === 'queued' || trainingState === 'running')) {
      statusMessage = 'LSTM model training is running in the background. Retry shortly for a forecast.';
    } else if (modelFreshness === 'stale' && (trainingState === 'queued' || trainingState === 'running')) {
      statusMessage = 'Using an older LSTM model while background retraining runs.';
    } else if (modelFreshness === 'fresh') {
      statusMessage = 'LSTM model is fresh.';
    }

    return {
      trainingState,
      modelFreshness,
      modelSource,
      trainedAt,
      statusMessage,
    };
  }

  enqueueTraining(ticker, rows) {
    if (this.trainingJobs.has(ticker)) {
      return this.trainingJobs.get(ticker);
    }

    const job = {
      state: 'queued',
      startedAt: null,
      promise: null,
    };

    job.promise = (async () => {
      job.state = 'running';
      job.startedAt = new Date().toISOString();

      try {
        const trained = await this.trainModel(rows);
        await this.saveModel(ticker, trained);
        this.memoryCache.set(ticker, trained);
        return trained;
      } catch (error) {
        console.error(`Background LSTM training failed for ${ticker}:`, error.message);
        return null;
      } finally {
        this.trainingJobs.delete(ticker);
      }
    })();

    this.trainingJobs.set(ticker, job);
    return job;
  }

  async trainModel(rows) {
    const prepared = this.prepareTrainingData(rows);
    const model = this.buildModel([this.lookbackDays, FEATURE_COLUMNS.length]);

    const XTrainTensor = tf.tensor3d(prepared.XTrain);
    const yTrainTensor = tf.tensor2d(prepared.yTrain, [prepared.yTrain.length, 1]);
    const XValidationTensor = tf.tensor3d(prepared.XValidation);
    const yValidationTensor = tf.tensor2d(prepared.yValidation, [prepared.yValidation.length, 1]);
    const XTestTensor = tf.tensor3d(prepared.XTest);
    const yTestTensor = tf.tensor2d(prepared.yTest, [prepared.yTest.length, 1]);

    try {
      await model.fit(XTrainTensor, yTrainTensor, {
        validationData: [XValidationTensor, yValidationTensor],
        epochs: this.epochs,
        batchSize: this.batchSize,
        callbacks: [
          tf.callbacks.earlyStopping({
            monitor: 'val_loss',
            patience: 2,
            minDelta: 0.0001,
          }),
        ],
        verbose: 0,
      });

      const evaluation = model.evaluate(XTestTensor, yTestTensor, { verbose: 0 });
      const outputs = Array.isArray(evaluation) ? evaluation : [evaluation];
      const metrics = {
        loss: round(outputs[0].dataSync()[0], 6),
        mae: round(outputs[1]?.dataSync?.()[0] ?? null, 6),
      };

      outputs.forEach((tensor) => tensor.dispose());

      return {
        model,
        featureScaler: prepared.featureScaler,
        targetScaler: prepared.targetScaler,
        metadata: {
          modelVersion: MODEL_VERSION,
          trainedAt: new Date().toISOString(),
          lookbackDays: this.lookbackDays,
          featureCount: FEATURE_COLUMNS.length,
          sampleCount: prepared.sampleCount,
          epochs: this.epochs,
          batchSize: this.batchSize,
          metrics,
        },
      };
    } finally {
      XTrainTensor.dispose();
      yTrainTensor.dispose();
      XValidationTensor.dispose();
      yValidationTensor.dispose();
      XTestTensor.dispose();
      yTestTensor.dispose();
    }
  }

  async predictNextDay({ model, featureScaler, targetScaler, rows }) {
    const recentRows = rows.slice(-this.lookbackDays);
    if (recentRows.length < this.lookbackDays) {
      throw new Error('Not enough recent rows to make LSTM prediction');
    }

    return this.predictFromSequence({
      model,
      featureScaler,
      targetScaler,
      sequenceRows: recentRows,
    });
  }

  async predictFromSequence({ model, featureScaler, targetScaler, sequenceRows }) {
    if (!Array.isArray(sequenceRows) || sequenceRows.length < this.lookbackDays) {
      throw new Error('Not enough rows to run LSTM prediction');
    }

    const featureMatrix = sequenceRows.map((row) => FEATURE_COLUMNS.map((column) => row[column]));
    const normalized = featureScaler.transform(featureMatrix);
    const predictionTensor = tf.tidy(() => {
      const input = tf.tensor3d([normalized]);
      return model.predict(input);
    });

    const predictionValue = predictionTensor.dataSync()[0];
    predictionTensor.dispose();

    return targetScaler.inverseValue(predictionValue, 0);
  }

  refineNextDayPrediction({ currentPrice, predictedPrice, rows }) {
    const current = Number(currentPrice);
    const raw = Number(predictedPrice);

    if (!Number.isFinite(current) || !Number.isFinite(raw) || current <= 0) {
      return raw;
    }

    const closes = Array.isArray(rows)
      ? rows.map((row) => Number(row?.close)).filter((value) => Number.isFinite(value))
      : [];

    if (closes.length < 21) {
      return raw;
    }

    const recentReturns = [];
    for (let index = Math.max(1, closes.length - 20); index < closes.length; index += 1) {
      const prev = closes[index - 1];
      const next = closes[index];
      if (!Number.isFinite(prev) || !Number.isFinite(next) || prev === 0) continue;
      recentReturns.push((next - prev) / prev);
    }

    if (!recentReturns.length) {
      return raw;
    }

    const mean = recentReturns.reduce((sum, value) => sum + value, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / recentReturns.length;
    const volatilityPercent = Math.sqrt(variance) * 100;
    const maxMovePercent = Math.max(1.5, Math.min(6, round(volatilityPercent * 2.5, 2) || 0));
    const rawChangePercent = ((raw - current) / current) * 100;
    const boundedChangePercent = Math.max(-maxMovePercent, Math.min(maxMovePercent, rawChangePercent));

    return current * (1 + boundedChangePercent / 100);
  }

  async buildHistoricalOverlay({ model, featureScaler, targetScaler, rows }) {
    const overlayWindow = Math.min(30, Math.max(0, rows.length - this.lookbackDays));
    if (overlayWindow <= 0) return [];

    const output = [];
    const startIndex = rows.length - overlayWindow;

    for (let index = startIndex; index < rows.length; index += 1) {
      const sequenceRows = rows.slice(index - this.lookbackDays, index);
      if (sequenceRows.length < this.lookbackDays) continue;

      const predictedClose = await this.predictFromSequence({
        model,
        featureScaler,
        targetScaler,
        sequenceRows,
      });

      output.push({
        date: this.toDateLabel(rows[index].date),
        actualClose: round(rows[index].close, 2),
        predictedClose: round(predictedClose, 2),
      });
    }

    return output;
  }

  async buildFutureTrend({ model, featureScaler, targetScaler, rawRows, daysAhead = 7 }) {
    if (!Array.isArray(rawRows) || !rawRows.length) return [];

    const syntheticRawRows = rawRows
      .filter((row) => row && row.date)
      .map((row) => ({
        date: row.date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      }));

    const forecasts = [];

    for (let day = 0; day < daysAhead; day += 1) {
      const engineeredRows = this.engineerFeatures(syntheticRawRows);
      if (engineeredRows.length < this.lookbackDays) break;

      const predictedClose = await this.predictNextDay({
        model,
        featureScaler,
        targetScaler,
        rows: engineeredRows,
      });

      const previousRow = syntheticRawRows[syntheticRawRows.length - 1];
      const nextDate = this.getNextDate(previousRow?.date);
      const syntheticRow = this.buildSyntheticRawRow({
        previousRow,
        predictedClose,
        nextDate,
      });

      syntheticRawRows.push(syntheticRow);
      forecasts.push({
        date: this.toDateLabel(nextDate),
        predictedClose: round(predictedClose, 2),
      });
    }

    return forecasts;
  }

  buildSyntheticRawRow({ previousRow, predictedClose, nextDate }) {
    const previousClose = Number(previousRow?.close);
    const baseClose = Number.isFinite(previousClose) ? previousClose : Number(predictedClose);
    const safePrediction = Number(predictedClose);
    const open = baseClose;
    const high = Math.max(open, safePrediction) * 1.01;
    const low = Math.min(open, safePrediction) * 0.99;
    const volume = Number.isFinite(Number(previousRow?.volume)) ? Number(previousRow.volume) : 0;

    return {
      date: nextDate,
      open,
      high,
      low,
      close: safePrediction,
      volume,
    };
  }

  getNextDate(dateValue) {
    const nextDate = new Date(dateValue || Date.now());
    if (Number.isNaN(nextDate.getTime())) return this.toLocalMidday(new Date());
    nextDate.setHours(12, 0, 0, 0);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }

  getForecastBaseDate(dateValue) {
    const latestHistoryDate = this.toLocalMidday(dateValue);
    const today = this.toLocalMidday(new Date());

    if (Number.isNaN(latestHistoryDate.getTime())) {
      return today;
    }

    return latestHistoryDate.getTime() > today.getTime() ? latestHistoryDate : today;
  }

  getNextBusinessDate(dateValue) {
    const nextDate = this.getNextDate(dateValue);

    while ([0, 6].includes(nextDate.getDay())) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  toDateLabel(dateValue) {
    const date = this.toLocalMidday(dateValue);
    if (Number.isNaN(date.getTime())) {
      return String(dateValue || '');
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  toLocalMidday(dateValue) {
    const date = new Date(dateValue || Date.now());
    if (Number.isNaN(date.getTime())) return new Date('invalid');
    date.setHours(12, 0, 0, 0);
    return date;
  }

  generateSignal(currentPrice, predictedPrice) {
    const changeAmount = predictedPrice - currentPrice;
    const changePercent = currentPrice === 0 ? 0 : (changeAmount / currentPrice) * 100;

    if (changePercent > 2) {
      return { signal: 'STRONG_BUY', points: 3, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    if (changePercent > 1) {
      return { signal: 'BUY', points: 2.5, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    if (changePercent > 0.5) {
      return { signal: 'WEAK_BUY', points: 1.5, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    if (changePercent > -0.5) {
      return { signal: 'HOLD', points: 0, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    if (changePercent > -1) {
      return { signal: 'WEAK_SELL', points: -1.5, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    if (changePercent > -2) {
      return { signal: 'SELL', points: -2.5, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
    }
    return { signal: 'STRONG_SELL', points: -3, changeAmount, changePercent, confidence: Math.min(Math.abs(changePercent) * 10, 100) };
  }

  async saveModel(ticker, trained) {
    await fs.mkdir(this.modelDirectory, { recursive: true });
    const filePath = this.getModelFilePath(ticker);
    const weights = await Promise.all(trained.model.getWeights().map(async (tensor) => tensor.array()));

    const payload = {
      metadata: trained.metadata,
      scalers: {
        featureScaler: trained.featureScaler.toJSON(),
        targetScaler: trained.targetScaler.toJSON(),
      },
      weights,
    };

    await fs.writeFile(filePath, JSON.stringify(payload), 'utf8');
  }

  async loadModel(ticker, options = {}) {
    const { allowStale = false } = options;
    const filePath = this.getModelFilePath(ticker);

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const payload = JSON.parse(raw);
      if (payload?.metadata?.modelVersion !== MODEL_VERSION) return null;
      const freshness = this.getFreshness(payload?.metadata?.trainedAt);
      if (freshness === 'stale' && !allowStale) return null;

      const model = this.buildModel([this.lookbackDays, FEATURE_COLUMNS.length]);
      const weightTensors = (payload?.weights || []).map((weight) => tf.tensor(weight));
      model.setWeights(weightTensors);
      weightTensors.forEach((tensor) => tensor.dispose());

      return {
        model,
        featureScaler: MinMaxScaler.fromJSON(payload?.scalers?.featureScaler),
        targetScaler: MinMaxScaler.fromJSON(payload?.scalers?.targetScaler),
        metadata: payload.metadata,
        freshness,
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Unable to load saved LSTM model for ${ticker}:`, error.message);
      }
      return null;
    }
  }

  getModelFilePath(ticker) {
    const safeTicker = String(ticker || '')
      .toUpperCase()
      .replace(/[^A-Z0-9._-]/g, '_');
    return path.join(this.modelDirectory, `${safeTicker}.json`);
  }

  isFresh(isoDate) {
    const timestamp = new Date(isoDate || '').getTime();
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp <= this.modelMaxAgeHours * 60 * 60 * 1000;
  }

  getFreshness(isoDate) {
    if (!isoDate) return 'none';
    return this.isFresh(isoDate) ? 'fresh' : 'stale';
  }

  computeRollingMean(values, period) {
    const output = new Array(values.length).fill(null);
    let sum = 0;
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value)) continue;
      sum += value;
      if (index >= period && Number.isFinite(values[index - period])) {
        sum -= values[index - period];
      }
      if (index >= period - 1) {
        output[index] = sum / period;
      }
    }
    return output;
  }

  computeRollingStd(values, period) {
    const output = new Array(values.length).fill(null);
    for (let index = period - 1; index < values.length; index += 1) {
      const slice = values.slice(index - period + 1, index + 1);
      if (slice.some((value) => !Number.isFinite(value))) continue;
      const mean = slice.reduce((acc, value) => acc + value, 0) / period;
      const variance = slice.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / period;
      output[index] = Math.sqrt(variance);
    }
    return output;
  }

  computeEmaSeries(values, period) {
    const output = new Array(values.length).fill(null);
    const multiplier = 2 / (period + 1);
    let ema = null;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value)) continue;

      if (ema === null) {
        const window = values.slice(Math.max(0, index - period + 1), index + 1);
        if (window.length < period || window.some((entry) => !Number.isFinite(entry))) continue;
        ema = window.reduce((acc, entry) => acc + entry, 0) / period;
      } else {
        ema = value * multiplier + ema * (1 - multiplier);
      }

      output[index] = ema;
    }

    return output;
  }

  computeRsiSeries(closes, period) {
    const output = new Array(closes.length).fill(null);
    for (let index = period; index < closes.length; index += 1) {
      let gains = 0;
      let losses = 0;
      for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
        const diff = closes[cursor] - closes[cursor - 1];
        if (diff > 0) gains += diff;
        if (diff < 0) losses += Math.abs(diff);
      }
      const averageGain = gains / period;
      const averageLoss = losses / period;
      if (averageLoss === 0 && averageGain === 0) {
        output[index] = 50;
      } else if (averageLoss === 0) {
        output[index] = 100;
      } else if (averageGain === 0) {
        output[index] = 0;
      } else {
        const rs = averageGain / averageLoss;
        output[index] = 100 - (100 / (1 + rs));
      }
    }
    return output;
  }
}

module.exports = new StockLstmService();
