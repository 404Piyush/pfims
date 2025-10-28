const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Transaction = require('../models/Transaction');
// Ensure Category model is registered for population
require('../models/Category');

async function main() {
  const [email, startArg, endArg] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/listUserMonthTransactions.js <email> [start yyyy-mm-dd] [end yyyy-mm-dd]');
    process.exit(1);
  }

  const start = new Date((startArg || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`) + 'T00:00:00');
  const end = new Date((endArg || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate()).padStart(2,'0')}`) + 'T23:59:59');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email });
    if (!user) {
      console.error('User not found:', email);
      process.exit(1);
    }

    const txns = await Transaction.find({ user: user._id, status: 'completed', date: { $gte: start, $lte: end } })
      .populate('category', 'name type isActive user')
      .sort({ date: 1 });

    const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    console.log(`Transactions for ${email} from ${fmtDate(start)} to ${fmtDate(end)}:`);
    let incomeSum = 0, expenseSum = 0;
    txns.forEach(t => {
      const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '';
      if (t.type === 'income') incomeSum += t.amount;
      if (t.type === 'expense') expenseSum += t.amount;
      console.log(`${fmtDate(new Date(t.date))} | ${sign}${fmtINR(t.amount)} | ${t.type} | ${t.title || t.description} | cat=${t.category?.name || 'null'} (${t.category?.type || 'n/a'}) active=${t.category?.isActive ?? 'n/a'}`);
    });
    console.log(`\nTotals: Income ${fmtINR(incomeSum)} | Expense ${fmtINR(expenseSum)} | Net ${fmtINR(incomeSum - expenseSum)}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();