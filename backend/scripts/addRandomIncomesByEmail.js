const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

function getArg(name, defaultVal) {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.split('=')[1];
    }
  }
  return defaultVal;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function randomDateWithin(daysBack = 90) {
  const date = new Date();
  date.setDate(date.getDate() - randInt(1, daysBack));
  return date;
}

async function run() {
  const email = getArg('email', process.env.SEED_EMAIL);
  const count = parseInt(getArg('count', '6'), 10);
  const currency = getArg('currency', 'INR');
  const minAmt = parseInt(getArg('min', '500'), 10);
  const maxAmt = parseInt(getArg('max', '8000'), 10);
  const daysBack = parseInt(getArg('daysBack', '90'), 10);

  if (!email) {
    console.error('❌ Missing --email argument.');
    console.log('\nUsage: node backend/scripts/addRandomIncomesByEmail.js --email="user@example.com" [--count=6] [--currency=INR] [--min=500] [--max=8000] [--daysBack=90]');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User ${email} not found`);
      return;
    }

    let categories = await Category.find({ user: user._id });
    if (categories.length === 0) {
      categories = await Category.createDefaultCategories(user._id);
      console.log(`📂 Created ${categories.length} default categories`);
    }

    const investmentCat = categories.find(c => c.name === 'Investment');
    const otherIncomeCat = categories.find(c => c.name === 'Other Income');
    const salaryCat = categories.find(c => c.name === 'Salary');
    const fallbackCatId = categories[0]?._id;

    const titles = [
      'Stock Profit',
      'Dividend Income',
      'Interest Income',
      'Gift Received',
      'Cashback Reward',
      'Referral Bonus',
      'Side Hustle Income',
      'Rental Income',
      'Selling Old Items',
      'Crypto Gains'
    ];

    const categoryPickers = [
      () => investmentCat?._id || fallbackCatId,
      () => investmentCat?._id || fallbackCatId,
      () => investmentCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => otherIncomeCat?._id || fallbackCatId,
      () => investmentCat?._id || fallbackCatId,
    ];

    const transactions = [];
    for (let i = 0; i < count; i++) {
      const title = choice(titles);
      const catId = categoryPickers[randInt(0, categoryPickers.length - 1)]();
      const amount = randInt(minAmt, maxAmt);
      const date = randomDateWithin(daysBack);
      const tags = [title.toLowerCase().replace(/\s+/g, '-')];

      transactions.push({
        user: user._id,
        title,
        category: catId,
        type: 'income',
        amount,
        description: `${title} credited`,
        account: 'Primary Bank Account',
        paymentMethod: 'bank_transfer',
        currency,
        date,
        status: 'completed',
        tags,
      });
    }

    const inserted = await Transaction.insertMany(transactions);
    console.log(`🧾 Added ${inserted.length} random income transactions for ${email}.`);

    console.log('\n✅ Done.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

run();