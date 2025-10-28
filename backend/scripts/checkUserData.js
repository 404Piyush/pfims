const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
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

async function checkForEmail() {
  const email = getArg('email', process.env.SEED_EMAIL);
  if (!email) {
    console.error('❌ Missing --email argument.');
    console.log('\nUsage: node backend/scripts/checkUserData.js --email="user@example.com"');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pfims');
    console.log('✅ Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ User ${email} not found.`);
      return;
    }

    console.log('\n👤 User:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Currency: ${user.currency}`);
    console.log(`   Timezone: ${user.timezone}`);
    console.log(`   Email Verified: ${user.isEmailVerified}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Created: ${user.createdAt}`);

    const categories = await Category.find({ user: user._id });
    console.log(`\n📂 Categories: ${categories.length}`);

    const transactions = await Transaction.find({ user: user._id }).sort({ date: -1 }).limit(10).populate('category');
    const txnCount = await Transaction.countDocuments({ user: user._id });
    const incomeTotal = await Transaction.aggregate([
      { $match: { user: user._id, type: 'income', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const expenseTotal = await Transaction.aggregate([
      { $match: { user: user._id, type: 'expense', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const incomeSum = incomeTotal[0]?.total || 0;
    const expenseSum = expenseTotal[0]?.total || 0;

    console.log(`\n🧾 Transactions: ${txnCount} (showing latest 10)`);
    transactions.forEach((t, idx) => {
      console.log(`   ${idx + 1}. ${t.title} - ${t.type.toUpperCase()} ${t.amount} ${t.currency} (${t.category?.name || 'Uncategorized'}) on ${t.date.toISOString().slice(0,10)}`);
    });
    console.log(`\n💵 Total Income: ${incomeSum}`);
    console.log(`💸 Total Expense: ${expenseSum}`);
    console.log(`💰 Net Balance: ${incomeSum - expenseSum}`);

    const budgets = await Budget.find({ user: user._id }).populate('categories.category');
    console.log(`\n📊 Budgets: ${budgets.length}`);
    budgets.forEach((b, idx) => {
      console.log(`   ${idx + 1}. ${b.name} [${b.period}] ${b.totalSpent}/${b.totalBudget} ${b.currency} (status: ${b.status})`);
      b.categories.forEach((bc) => {
        console.log(`      - ${bc.category?.name || 'Unknown'}: spent ${bc.spentAmount}/${bc.budgetAmount}`);
      });
    });

    console.log('\n✅ Check complete.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkForEmail();