const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function main() {
  const [email, startDateArg, endDateArg] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/testAnalyticsForUser.js <email> [startDate yyyy-mm-dd] [endDate yyyy-mm-dd]');
    process.exit(1);
  }

  const startDate = startDateArg || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const endDate = endDateArg || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10);

  const BASE_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3001';
  const API_URL = `${BASE_URL}/api/transactions/analytics/summary`;

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log(`Testing analytics for ${email}`);
    console.log(`Period: ${startDate} to ${endDate}`);

    const res = await axios.get(API_URL, {
      params: { period: 'custom', startDate, endDate },
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = res?.data?.data || {};
    const summary = {
      totalIncome: Number(data.totalIncome || 0),
      totalExpense: Number(data.totalExpense || 0),
      netIncome: Number(data.netIncome || 0),
      transactionCount: Number(data.transactionCount || 0)
    };

    const formatINR = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

    console.log('API Summary:');
    console.log(`  Income:   ${formatINR(summary.totalIncome)}`);
    console.log(`  Expenses: ${formatINR(summary.totalExpense)}`);
    console.log(`  Net:      ${formatINR(summary.netIncome)}`);

    // Show raw response keys for quick inspection
    console.log('\nRaw keys:', Object.keys(data));
  } catch (err) {
    console.error('Error calling analytics summary:', err.response?.data || err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();