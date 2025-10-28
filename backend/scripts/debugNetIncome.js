const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models from backend
const Transaction = require('../models/Transaction');
const User = require('../models/User');
// Ensure Category schema is registered for population
require('../models/Category');

async function run() {
  const [emailArg, startArg, endArg] = process.argv.slice(2);
  const email = emailArg || 'piyush@gmail.com';
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('Error: MONGODB_URI not set. Please ensure backend/.env contains MONGODB_URI');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`User not found for email: ${email}`);
      return;
    }
    console.log(`Using user: ${user.firstName || ''} ${user.lastName || ''} <${email}>`);

    // Helper to format INR and dates
    const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Date ranges
    const now = new Date();
    const monthStart = startArg ? new Date(startArg + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = endArg ? new Date(endArg + 'T23:59:59') : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const ytdEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Base match
    const baseMatch = { user: user._id, status: 'completed' };

    // Aggregation helper
    const totalsForRange = async (start, end) => {
      const dateMatch = { $gte: start, $lte: end };
      const pipeline = [
        { $match: { ...baseMatch, date: dateMatch } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ];
      const grouped = await Transaction.aggregate(pipeline);
      const summary = { income: 0, expense: 0, transfer: 0, transactionCount: 0 };
      grouped.forEach(g => { summary[g._id] = g.total; summary.transactionCount += g.count; });
      summary.netIncome = (summary.income || 0) - (summary.expense || 0);
      return summary;
    };

    // Mimic backend /analytics/summary route (with category lookup/unwind)
    const routeSummaryForRange = async (start, end) => {
      const dateMatch = { $gte: start, $lte: end };
      const pipeline = [
        { $match: { ...baseMatch, date: dateMatch } },
        {
          $lookup: {
            from: 'categories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo'
          }
        },
        { $unwind: '$categoryInfo' },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
      ];
      const grouped = await Transaction.aggregate(pipeline);
      const summary = { income: 0, expense: 0, transfer: 0, transactionCount: 0 };
      grouped.forEach(g => { summary[g._id] = g.total; summary.transactionCount += g.count; });
      summary.netIncome = (summary.income || 0) - (summary.expense || 0);
      return summary;
    };

    const overallPipeline = [
      { $match: baseMatch },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ];
    const overallGrouped = await Transaction.aggregate(overallPipeline);
    const overall = { income: 0, expense: 0, transfer: 0, transactionCount: 0 };
    overallGrouped.forEach(g => { overall[g._id] = g.total; overall.transactionCount += g.count; });
    overall.netIncome = (overall.income || 0) - (overall.expense || 0);

    const currentMonth = await totalsForRange(monthStart, monthEnd);
    const currentMonthRoute = await routeSummaryForRange(monthStart, monthEnd);
    const prevMonth = await totalsForRange(prevMonthStart, prevMonthEnd);
    const ytd = await totalsForRange(ytdStart, ytdEnd);

    console.log('\n=== OVERALL (Completed) ===');
    console.log(`Income:   ${fmtINR(overall.income || 0)} (${overallGrouped.find(g => g._id === 'income')?.count || 0} txns)`);
    console.log(`Expenses: ${fmtINR(overall.expense || 0)} (${overallGrouped.find(g => g._id === 'expense')?.count || 0} txns)`);
    console.log(`Transfers:${fmtINR(overall.transfer || 0)} (${overallGrouped.find(g => g._id === 'transfer')?.count || 0} txns)`);
    console.log(`Net:      ${fmtINR(overall.netIncome)}`);

    console.log(`\n=== PERIOD (${fmtDate(monthStart)} to ${fmtDate(monthEnd)}) ===`);
    console.log(`Income:   ${fmtINR(currentMonth.income || 0)} (route: ${fmtINR(currentMonthRoute.income || 0)})`);
    console.log(`Expenses: ${fmtINR(currentMonth.expense || 0)} (route: ${fmtINR(currentMonthRoute.expense || 0)})`);
    console.log(`Net:      ${fmtINR(currentMonth.netIncome)} (route: ${fmtINR(currentMonthRoute.netIncome)})`);
    console.log(`Last Month (${fmtDate(prevMonthStart)} to ${fmtDate(prevMonthEnd)}): Income ${fmtINR(prevMonth.income || 0)}, Expenses ${fmtINR(prevMonth.expense || 0)}, Net ${fmtINR(prevMonth.netIncome)}`);

    console.log(`\n=== YEAR TO DATE (${fmtDate(ytdStart)} to ${fmtDate(ytdEnd)}) ===`);
    console.log(`Income:   ${fmtINR(ytd.income || 0)}`);
    console.log(`Expenses: ${fmtINR(ytd.expense || 0)}`);
    console.log(`Net:      ${fmtINR(ytd.netIncome)}`);

    // Optional: list outliers or large expenses/incomes for quick inspection
    const topExpenses = await Transaction.find({ ...baseMatch, type: 'expense' })
      .sort({ amount: -1 })
      .limit(5)
      .populate('category', 'name');
    const topIncomes = await Transaction.find({ ...baseMatch, type: 'income' })
      .sort({ amount: -1 })
      .limit(5)
      .populate('category', 'name');

    console.log('\nTop 5 Expenses:');
    topExpenses.forEach((t, i) => {
      const d = new Date(t.date);
      console.log(`${i + 1}. ${t.title || t.description || 'Untitled'} | ${fmtINR(t.amount)} | ${t.category?.name || 'Uncategorized'} | ${fmtDate(d)}`);
    });

    console.log('\nTop 5 Incomes:');
    topIncomes.forEach((t, i) => {
      const d = new Date(t.date);
      console.log(`${i + 1}. ${t.title || t.description || 'Untitled'} | ${fmtINR(t.amount)} | ${t.category?.name || 'Uncategorized'} | ${fmtDate(d)}`);
    });

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

run();