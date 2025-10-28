import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fetchTransactions } from '../../store/slices/transactionSlice';
import api from '../../services/api';
import {
  PlusIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
  CreditCardIcon,
  ChartBarIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

// Mock data - replace with actual API calls
const mockDashboardData = {
  summary: {
    totalBalance: 15420.50,
    monthlyIncome: 5200.00,
    monthlyExpenses: 3180.75,
    monthlyNet: 2019.25,
    budgetUtilization: 68.5,
    savingsRate: 38.8,
  },
  recentTransactions: [
    {
      id: 1,
      description: 'Grocery Store',
      amount: -85.50,
      category: 'Food & Dining',
      date: '2024-01-15',
      type: 'expense'
    },
    {
      id: 2,
      description: 'Salary Deposit',
      amount: 2600.00,
      category: 'Salary',
      date: '2024-01-15',
      type: 'income'
    },
    {
      id: 3,
      description: 'Electric Bill',
      amount: -120.00,
      category: 'Utilities',
      date: '2024-01-14',
      type: 'expense'
    },
    {
      id: 4,
      description: 'Coffee Shop',
      amount: -4.50,
      category: 'Food & Dining',
      date: '2024-01-14',
      type: 'expense'
    },
    {
      id: 5,
      description: 'Gas Station',
      amount: -45.00,
      category: 'Transportation',
      date: '2024-01-13',
      type: 'expense'
    },
  ],
  monthlyTrend: [
    { month: 'Aug', income: 4800, expenses: 3200, net: 1600 },
    { month: 'Sep', income: 5000, expenses: 3400, net: 1600 },
    { month: 'Oct', income: 5200, expenses: 3100, net: 2100 },
    { month: 'Nov', income: 5100, expenses: 3300, net: 1800 },
    { month: 'Dec', income: 5300, expenses: 3500, net: 1800 },
    { month: 'Jan', income: 5200, expenses: 3180, net: 2020 },
  ],
  categoryBreakdown: [
    { name: 'Food & Dining', value: 850, color: '#ef4444' },
    { name: 'Transportation', value: 420, color: '#f97316' },
    { name: 'Utilities', value: 380, color: '#eab308' },
    { name: 'Entertainment', value: 280, color: '#22c55e' },
    { name: 'Shopping', value: 520, color: '#3b82f6' },
    { name: 'Healthcare', value: 180, color: '#8b5cf6' },
    { name: 'Other', value: 250, color: '#6b7280' },
  ],
  budgetProgress: [
    { category: 'Food & Dining', budgeted: 1000, spent: 850, percentage: 85 },
    { category: 'Transportation', budgeted: 500, spent: 420, percentage: 84 },
    { category: 'Utilities', budgeted: 400, spent: 380, percentage: 95 },
    { category: 'Entertainment', budgeted: 300, spent: 280, percentage: 93 },
    { category: 'Shopping', budgeted: 600, spent: 520, percentage: 87 },
  ],
};

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { transactions } = useSelector((state) => state.transactions);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(mockDashboardData);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  useEffect(() => {
    // Fetch dashboard data for current and previous month, and overall balance
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const currentStart = startOfMonth(now);
        const currentEnd = endOfMonth(now);

        const prev = subMonths(now, 1);
        const prevStart = startOfMonth(prev);
        const prevEnd = endOfMonth(prev);

        // Fetch recent transactions for the current month for the list (uses slice store)
        await dispatch(fetchTransactions({
          startDate: format(currentStart, 'yyyy-MM-dd'),
          endDate: format(currentEnd, 'yyyy-MM-dd'),
          sortBy: 'date',
          sortOrder: 'desc',
          limit: 100
        }));

        // Fetch summary analytics for current and previous month
        const [currentSummaryRes, previousSummaryRes, overallSummaryRes] = await Promise.all([
          api.get('/transactions/analytics/summary', {
            params: {
              period: 'custom',
              startDate: format(currentStart, 'yyyy-MM-dd'),
              endDate: format(currentEnd, 'yyyy-MM-dd')
            }
          }),
          api.get('/transactions/analytics/summary', {
            params: {
              period: 'custom',
              startDate: format(prevStart, 'yyyy-MM-dd'),
              endDate: format(prevEnd, 'yyyy-MM-dd')
            }
          }),
          // Overall balance to date (simple approximation using all recorded transactions)
          api.get('/transactions/analytics/summary', {
            params: {
              period: 'year' // Use YTD as a practical overall balance proxy
            }
          })
        ]);

        const currentSummary = currentSummaryRes?.data?.data || {};
        const previousSummary = previousSummaryRes?.data?.data || {};
        const overallSummary = overallSummaryRes?.data?.data || {};

        const monthlyIncome = Number(currentSummary.totalIncome || 0);
        const monthlyExpenses = Number(currentSummary.totalExpense || 0);
        const monthlyNet = Number(currentSummary.netIncome || 0);

        const previousMonthIncome = Number(previousSummary.totalIncome || 0);
        const previousMonthExpenses = Number(previousSummary.totalExpense || 0);
        const previousMonthNet = Number(previousSummary.netIncome || 0);

        // Percentage changes where possible
        const incomePct = previousMonthIncome > 0
          ? ((monthlyIncome - previousMonthIncome) / previousMonthIncome) * 100
          : null;
        const expensePct = previousMonthExpenses > 0
          ? ((monthlyExpenses - previousMonthExpenses) / previousMonthExpenses) * 100
          : null;
        const netPct = previousMonthNet !== 0
          ? ((monthlyNet - previousMonthNet) / Math.abs(previousMonthNet)) * 100
          : null;

        // Amount differences (used when percent is not meaningful)
        const incomeDiff = monthlyIncome - previousMonthIncome;
        const expenseDiff = monthlyExpenses - previousMonthExpenses;
        const netDiff = monthlyNet - previousMonthNet;

        // Helper to format change text
        const formatChangeText = (pct, diff, prevVal) => {
          if (pct !== null) {
            const sign = pct >= 0 ? '+' : '';
            return `${sign}${pct.toFixed(1)}% from last month`;
          }
          // When previous month has no data, show last month's value and absolute change
          const diffSign = diff >= 0 ? '+' : '';
          return `Last month: ${formatCurrency(prevVal)} (${diffSign}${formatCurrency(Math.abs(diff))} difference)`;
        };

        setDashboardData(prev => ({
          ...prev,
          summary: {
            ...prev.summary,
            monthlyIncome,
            monthlyExpenses,
            monthlyNet,
            savingsRate: monthlyIncome > 0 ? ((monthlyNet / monthlyIncome) * 100) : 0,
            // Overall balance proxy: year-to-date net income
            totalBalance: Number(overallSummary.netIncome || 0)
          },
          changes: {
            income: incomePct,
            incomeText: formatChangeText(incomePct, incomeDiff, previousMonthIncome),
            expenses: expensePct,
            expensesText: formatChangeText(expensePct, expenseDiff, previousMonthExpenses),
            net: netPct,
            netText: formatChangeText(netPct, netDiff, previousMonthNet),
            balance: netPct, // use net trend for balance
            balanceText: formatChangeText(netPct, netDiff, previousMonthNet)
          }
        }));
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [selectedPeriod, dispatch]);

  // Update recent transactions list when store changes
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      setDashboardData(prev => ({
        ...prev,
        recentTransactions: transactions.slice(0, 5).map(transaction => ({
          id: transaction._id,
          description: transaction.title || transaction.description,
          amount: transaction.type === 'expense' ? -transaction.amount : transaction.amount,
          category: transaction.category?.name || transaction.category || 'Uncategorized',
          date: transaction.date,
          type: transaction.type
        }))
      }));
    }
  }, [transactions]);

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
            Here's your financial overview for {format(new Date(), 'MMMM yyyy')}
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
          title="Total Balance (YTD)"
          value={formatCurrency(dashboardData.summary.totalBalance)}
          change={dashboardData.changes?.balanceText}
          icon={BanknotesIcon}
          color="primary"
          trend={dashboardData.changes?.balance !== null && dashboardData.changes?.balance !== undefined
            ? (dashboardData.changes.balance >= 0 ? 'up' : 'down')
            : 'neutral'}
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(dashboardData.summary.monthlyIncome)}
          change={dashboardData.changes?.incomeText}
          icon={ArrowTrendingUpIcon}
          color="success"
          trend={dashboardData.changes?.income !== null && dashboardData.changes?.income !== undefined
            ? (dashboardData.changes.income >= 0 ? 'up' : 'down')
            : 'neutral'}
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(dashboardData.summary.monthlyExpenses)}
          change={dashboardData.changes?.expensesText}
          icon={ArrowTrendingDownIcon}
          color="danger"
          trend={dashboardData.changes?.expenses !== null && dashboardData.changes?.expenses !== undefined
            ? (dashboardData.changes.expenses >= 0 ? 'up' : 'down')
            : 'neutral'}
        />
        <StatCard
          title="Net Income"
          value={formatCurrency(dashboardData.summary.monthlyNet)}
          change={dashboardData.changes?.netText}
          icon={ChartBarIcon}
          color="primary"
          trend={dashboardData.changes?.net !== null && dashboardData.changes?.net !== undefined
            ? (dashboardData.changes.net >= 0 ? 'up' : 'down')
            : 'neutral'}
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
              <AreaChart data={dashboardData.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
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
              <div key={budget.category}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-secondary-700">
                    {budget.category}
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
                    {budget.percentage}% used
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