import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format, parseISO } from 'date-fns';
import {
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import api from '../../services/api';

const pctChange = (current, previous) => {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / p) * 100;
};

const getPeriodRange = (period) => {
  const now = new Date();
  let start;
  let prevStart;
  let prevEnd;

  if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
    prevEnd = new Date(start);
    prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 7);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  } else if (period === 'quarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    start = new Date(now.getFullYear(), quarterStartMonth, 1);
    prevStart = new Date(start);
    prevStart.setMonth(start.getMonth() - 3);
    prevEnd = new Date(start);
    prevEnd.setDate(0);
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = new Date(now.getFullYear(), 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  }

  return { now, start, prevStart, prevEnd };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    rangeLabel: '',
    summary: {
      income: 0,
      expenses: 0,
      net: 0,
      savingsRate: 0,
    },
    changes: {},
    trend: [],
    categoryBreakdown: [],
    recentTransactions: [],
    budgetProgress: [],
  });
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { now, start, prevStart, prevEnd } = getPeriodRange(selectedPeriod);
        const currentOverviewParams = { period: selectedPeriod };
        const prevOverviewParams = {
          period: 'custom',
          startDate: format(prevStart, 'yyyy-MM-dd'),
          endDate: format(prevEnd, 'yyyy-MM-dd'),
        };

        const [currentOverviewRes, prevOverviewRes, recentRes, budgetRes] = await Promise.all([
          api.get('/reports/overview', { params: currentOverviewParams }),
          api.get('/reports/overview', { params: prevOverviewParams }),
          api.get('/transactions', { params: { sortBy: 'date', sortOrder: 'desc', limit: 5 } }),
          api.get('/budgets/progress', { params: { refresh: true } }),
        ]);

        const currentOverview = currentOverviewRes?.data || {};
        const prevOverview = prevOverviewRes?.data || {};

        const curSummary = currentOverview.summary || {};
        const prevSummary = prevOverview.summary || {};
        const income = Number(curSummary.income || 0);
        const expenses = Number(curSummary.expense || 0);
        const net = Number(curSummary.netIncome ?? (income - expenses));
        const savingsRate = income > 0 ? (net / income) * 100 : 0;

        const incomeDelta = pctChange(income, Number(prevSummary.income || 0));
        const expenseDelta = pctChange(expenses, Number(prevSummary.expense || 0));
        const netDelta = pctChange(net, Number(prevSummary.netIncome ?? 0));

        const dailyTrends = Array.isArray(currentOverview.dailyTrends) ? currentOverview.dailyTrends : [];
        let trend = dailyTrends.map((d) => {
          const dateStr = d?._id;
          const date = typeof dateStr === 'string' ? parseISO(dateStr) : null;
          return {
            label: date ? format(date, 'MMM d') : String(dateStr || ''),
            income: Number(d?.income || 0),
            expenses: Number(d?.expense || 0),
          };
        });

        if (trend.length > 60) {
          const byMonth = new Map();
          for (const d of dailyTrends) {
            const dateStr = d?._id;
            const date = typeof dateStr === 'string' ? parseISO(dateStr) : null;
            if (!date) continue;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const prev = byMonth.get(key) || { label: format(date, 'MMM yy'), income: 0, expenses: 0 };
            prev.income += Number(d?.income || 0);
            prev.expenses += Number(d?.expense || 0);
            byMonth.set(key, prev);
          }
          trend = Array.from(byMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, v]) => v);
        }

        const rawBreakdown = Array.isArray(currentOverview.categoryBreakdown) ? currentOverview.categoryBreakdown : [];
        const expenseBreakdown = rawBreakdown
          .filter((c) => c?._id?.type === 'expense')
          .map((c) => ({
            name: c?.categoryName || 'Uncategorized',
            value: Number(c?.total || 0),
            color: c?.categoryColor || '#6b7280',
          }))
          .filter((c) => c.value > 0);

        const sortedBreakdown = expenseBreakdown.sort((a, b) => b.value - a.value);
        const top = sortedBreakdown.slice(0, 7);
        const rest = sortedBreakdown.slice(7);
        const restTotal = rest.reduce((s, x) => s + x.value, 0);
        const categoryBreakdown = restTotal > 0 ? top.concat([{ name: 'Other', value: restTotal, color: '#6b7280' }]) : top;

        const recentPayload = recentRes?.data;
        const recentList =
          Array.isArray(recentPayload)
            ? recentPayload
            : (recentPayload?.data?.transactions || recentPayload?.transactions || []);
        const recentTransactions = Array.isArray(recentList)
          ? recentList.slice(0, 5).map((t) => ({
              id: t?._id || t?.id,
              description: t?.title || t?.description || '',
              amount: t?.type === 'expense' ? -Number(t?.amount || 0) : Number(t?.amount || 0),
              category: t?.category?.name || t?.category || 'Uncategorized',
              date: t?.date,
              type: t?.type,
            }))
          : [];

        const budgetProgress = Array.isArray(budgetRes?.data)
          ? budgetRes.data.slice(0, 6).map((b) => ({
              id: b?.budgetId,
              name: b?.name || 'Budget',
              budgeted: Number(b?.totalBudget || 0),
              spent: Number(b?.totalSpent || 0),
              percentage: Number(b?.utilizationPercentage || 0),
            }))
          : [];

        const rangeStart = currentOverview?.dateRange?.start ? new Date(currentOverview.dateRange.start) : start;
        const rangeEnd = currentOverview?.dateRange?.end ? new Date(currentOverview.dateRange.end) : now;
        const rangeLabel = `${format(rangeStart, 'MMM d')} – ${format(rangeEnd, 'MMM d, yyyy')}`;

        setDashboardData({
          rangeLabel,
          summary: {
            income,
            expenses,
            net,
            savingsRate,
          },
          changes: {
            income: incomeDelta,
            expenses: expenseDelta,
            net: netDelta,
          },
          trend,
          categoryBreakdown,
          recentTransactions,
          budgetProgress,
        });
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedPeriod]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const StatCard = ({ title, value, change, icon: Icon, color = 'primary', trend }) => (
    <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-secondary-600">{title}</p>
          <p className="text-2xl font-bold text-secondary-900 mt-1">{value}</p>
          {change && (
            <div className={`flex items-center mt-2 text-sm ${
              trend === 'up' ? 'text-success-600' : trend === 'down' ? 'text-danger-600' : 'text-secondary-600'
            }`}>
              {trend === 'up' && <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />}
              {trend === 'down' && <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />}
              {change}
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-secondary-600 mt-1">
            Here's your financial overview for {dashboardData.rangeLabel || format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => navigate('/transactions/new')}
            className="btn-primary flex items-center space-x-2"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Net Cash Flow"
          value={formatCurrency(dashboardData.summary.net)}
          change={Number.isFinite(dashboardData.changes?.net) ? 
            `${dashboardData.changes.net >= 0 ? '+' : ''}${dashboardData.changes.net.toFixed(1)}% vs previous period` : 
            undefined}
          icon={BanknotesIcon}
          color="primary"
          trend={Number(dashboardData.summary.net) >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Income"
          value={formatCurrency(dashboardData.summary.income)}
          change={Number.isFinite(dashboardData.changes?.income) ? 
            `${dashboardData.changes.income >= 0 ? '+' : ''}${dashboardData.changes.income.toFixed(1)}% vs previous period` : 
            undefined}
          icon={ArrowTrendingUpIcon}
          color="success"
          trend={Number(dashboardData.summary.income) >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Expenses"
          value={formatCurrency(dashboardData.summary.expenses)}
          change={Number.isFinite(dashboardData.changes?.expenses) ? 
            `${dashboardData.changes.expenses >= 0 ? '+' : ''}${dashboardData.changes.expenses.toFixed(1)}% vs previous period` : 
            undefined}
          icon={ArrowTrendingDownIcon}
          color="danger"
          trend={Number(dashboardData.summary.expenses) >= 0 ? "up" : "down"}
        />
        <StatCard
          title="Savings Rate"
          value={`${(Number(dashboardData.summary.savingsRate) || 0).toFixed(1)}%`}
          change={undefined}
          icon={ChartBarIcon}
          color="primary"
          trend={Number(dashboardData.summary.savingsRate) >= 0 ? "up" : "down"}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Income vs Expenses
            </h3>
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View Details
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value) => [formatCurrency(value), '']}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                  name="Income"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stackId="2"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.6}
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Expense Categories
            </h3>
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              View All
            </button>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData.categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dashboardData.categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [formatCurrency(value), '']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Recent Transactions
            </h3>
            <button
              onClick={() => navigate('/transactions')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <EyeIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-4">
            {dashboardData.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/transactions/${transaction.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    transaction.type === 'income' ? 'bg-success-100' : 'bg-danger-100'
                  }`}>
                    <CreditCardIcon className={`h-4 w-4 ${
                      transaction.type === 'income' ? 'text-success-600' : 'text-danger-600'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-secondary-900">
                      {transaction.description}
                    </p>
                    <p className="text-sm text-secondary-500">
                      {transaction.category} • {format(new Date(transaction.date), 'MMM dd')}
                    </p>
                  </div>
                </div>
                <div className={`font-semibold ${
                  transaction.amount > 0 ? 'text-success-600' : 'text-danger-600'
                }`}>
                  {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-secondary-900">
              Budget Progress
            </h3>
            <button
              onClick={() => navigate('/budgets')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage
            </button>
          </div>
          <div className="space-y-4">
            {dashboardData.budgetProgress.map((budget) => (
              <div key={budget.id || budget.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary-700">
                    {budget.name}
                  </span>
                  <span className="text-sm text-secondary-500">
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.budgeted)}
                  </span>
                </div>
                <div className="w-full bg-secondary-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      budget.percentage > 90
                        ? 'bg-danger-500'
                        : budget.percentage > 75
                        ? 'bg-warning-500'
                        : 'bg-success-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-xs font-medium ${
                    budget.percentage > 90
                      ? 'text-danger-600'
                      : budget.percentage > 75
                      ? 'text-warning-600'
                      : 'text-success-600'
                  }`}>
                    {Number(budget.percentage || 0).toFixed(0)}% used
                  </span>
                  <span className="text-xs text-secondary-500">
                    {formatCurrency(budget.budgeted - budget.spent)} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
