const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

async function main() {
  const [email, startDateArg, endDateArg] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/testTransactionsList.js <email> [startDate yyyy-mm-dd] [endDate yyyy-mm-dd]');
    process.exit(1);
  }

  const startDate = startDateArg || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const endDate = endDateArg || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10);

  const BASE_URL = process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3001';
  const API_URL = `${BASE_URL}/api/transactions`;

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email }).lean();
    if (!user) {
      console.error(`User not found: ${email}`);
      process.exit(1);
    }

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log(`Listing transactions via API for ${email}`);
    console.log(`Period: ${startDate} to ${endDate}`);

    const res = await axios.get(API_URL, {
      params: { page: 1, limit: 100, startDate, endDate },
      headers: { Authorization: `Bearer ${token}` }
    });

    const { transactions = [], pagination = {}, summary = {} } = res?.data?.data || {};
    console.log('Pagination:', pagination);
    console.log('Summary:', summary);
    console.log('First 10 transactions:');
    transactions.slice(0, 10).forEach((t, i) => {
      console.log(`${i+1}. ${new Date(t.date).toISOString().slice(0,10)} | ${t.type} | ${t.amount} | ${t.title}`);
    });
  } catch (err) {
    console.error('Error calling /api/transactions:', err.response?.data || err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();