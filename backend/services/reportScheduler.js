const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const emailService = require('../utils/emailService');

// Utility to generate report data for a user within dateRange
const buildReportForUser = async (user, start, end) => {
  const dateRange = { $gte: start, $lte: end };

  const [incomeExpenseSummary, categoryBreakdown] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: user._id, date: dateRange, status: 'completed' } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 }, average: { $avg: '$amount' } } }
    ]),
    Transaction.aggregate([
      { $match: { user: user._id, date: dateRange, status: 'completed' } },
      { $lookup: { from: 'categories', localField: 'category', foreignField: '_id', as: 'categoryInfo' } },
      { $unwind: '$categoryInfo' },
      { $group: { _id: { category: '$category', type: '$type' }, categoryName: { $first: '$categoryInfo.name' }, categoryColor: { $first: '$categoryInfo.color' }, categoryIcon: { $first: '$categoryInfo.icon' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ])
  ]);

  const summary = { income: 0, expense: 0, netIncome: 0, transactionCount: 0 };
  incomeExpenseSummary.forEach(item => { summary[item._id] = item.total; summary.transactionCount += item.count; });
  summary.netIncome = summary.income - summary.expense;

  const topCategories = categoryBreakdown
    .filter(c => c._id.type === 'expense')
    .slice(0, 5)
    .map(c => ({ categoryName: c.categoryName, total: c.total }));

  return { summary, topCategories, periodRange: { start, end } };
};

const sendWeeklyReports = async () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 7);

  const users = await User.find({ 'notifications.weeklyReports': true, isActive: true });
  for (const user of users) {
    try {
      const report = await buildReportForUser(user, start, now);
      const xlsxBuffer = await emailService.generateReportXlsxBuffer(user, report, 'weekly');
      const fileName = `pfims_weekly_report_${now.toISOString().slice(0, 10)}.xlsx`;
      await emailService.sendReportEmail(user, report, 'weekly', {
        attachments: [
          {
            filename: fileName,
            content: xlsxBuffer,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ]
      });
      console.log(`Weekly report sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send weekly report to ${user.email}:`, err?.message || err);
    }
  }
};

const sendMonthlyReports = async () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const users = await User.find({ 'notifications.monthlyReports': true, isActive: true });
  for (const user of users) {
    try {
      const report = await buildReportForUser(user, start, now);
      await emailService.sendReportEmail(user, report, 'monthly');
      console.log(`Monthly report sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send monthly report to ${user.email}:`, err?.message || err);
    }
  }
};

function startReportScheduler() {
  const enabled = process.env.ENABLE_REPORT_SCHEDULER === 'true';
  if (!enabled) {
    throw new Error('ENABLE_REPORT_SCHEDULER is not enabled');
  }

  // Every Monday at 08:00 server time
  cron.schedule('0 8 * * 1', async () => {
    console.log('Cron: Sending weekly reports...');
    await sendWeeklyReports();
  });

  // First day of the month at 09:00 server time
  cron.schedule('0 9 1 * *', async () => {
    console.log('Cron: Sending monthly reports...');
    await sendMonthlyReports();
  });

  console.log('Report scheduler started (weekly and monthly jobs registered)');
}

module.exports = { startReportScheduler };
