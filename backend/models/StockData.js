const mongoose = require('mongoose');

const stockCandleSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    open: Number,
    high: Number,
    low: Number,
    close: {
      type: Number,
      required: true,
    },
    volume: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const stockDataSchema = new mongoose.Schema(
  {
    ticker: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    historical: {
      type: [stockCandleSchema],
      default: [],
    },
    lastUpdated: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'stock_data',
  }
);

module.exports = mongoose.model('StockData', stockDataSchema);
