const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');
const Transaction = require('../models/Transaction');
require('../models/Category');

async function main() {
  const [email, monthArg] = process.argv.slice(2);
  if (!email) {
    console.error('Usage: node scripts/findSalaryTransaction.js <email> [YYYY-MM]');
    process.exit(1);
  }
  const [y, m] = (monthArg || `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`).split('-').map(Number);
  const start = new Date(y, m-1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email }).lean();
    if (!user) { console.error('User not found:', email); process.exit(1); }
    const tx = await Transaction.find({ user: user._id, type: 'income', date: { $gte: start, $lte: end }, title: /salary/i })
      .populate('category', 'name isActive user type')
      .lean();
    console.log('Salary-like incomes in month:', tx.length);
    tx.forEach(t => console.log({ id: t._id.toString(), amount: t.amount, date: t.date, status: t.status, category: t.category }));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();