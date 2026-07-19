import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { format, parseISO } from 'date-fns';
import {
  Plus,
  CreditCard,
  Eye,
} from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import NumberStat from '../../components/ui/NumberStat';
import BrutalCard from '../../components/ui/BrutalCard';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-brutal-ink">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-4 border-brutal-ink pb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brutal-ink/60">Dashboard</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brutal-ink">
            Welcome back, {user?.firstName}<span className="text-brutal-accent">.</span>
          </h1>
          <p className="text-brutal-ink/70 mt-1">
            Here's your financial overview for {dashboardData.rangeLabel || format(new Date(), 'MMMM yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border-2 border-brutal-ink bg-brutal-paper text-brutal-ink text-sm font-bold focus:outline-none focus:bg-amber-50"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => navigate('/transactions/new')}
            className="inline-flex items-center gap-2 bg-brutal-ink text-brutal-paper border-2 border-brutal-ink px-4 py-2 text-sm font-bold uppercase tracking-[0.14em] shadow-[4px_4px_0_0_#0a0a0a] hover:shadow-[2px_2px_0_0_#0a0a0a] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all"
          >
            <Plus size={16} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <NumberStat
          variant="brutal"
          label="Net Cash Flow"
          value={formatCurrency(dashboardData.summary.net).replace(/^./, (c) => c)}
          delta={Number(dashboardData.changes?.net)}
          trend="prev period"
        />
        <NumberStat
          variant="brutal"
          label="Income"
          value={formatCurrency(dashboardData.summary.income).replace(/^./, (c) => c)}
          delta={Number(dashboardData.changes?.income)}
          trend="prev period"
        />
        <NumberStat
          variant="brutal"
          label="Expenses"
          value={formatCurrency(dashboardData.summary.expenses).replace(/^./, (c) => c)}
          delta={Number(dashboardData.changes?.expenses)}
          trend="prev period"
        />
        <NumberStat
          variant="brutal"
          label="Savings Rate"
          value={`${(Number(dashboardData.summary.savingsRate) || 0).toFixed(1)}`}
          suffix="%"
          delta={undefined}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Monthly Trend Chart */}
        <BrutalCard className="p-6">
          <div className="flex items-center justify-between border-b-2 border-brutal-ink pb-3 mb-5">
            <h3 className="text-base font-extrabold tracking-tight text-brutal-ink uppercase">
              Income vs Expenses
            </h3>
            <button className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent">
              Details
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0a0a0a22" />
                <XAxis dataKey="label" stroke="#0a0a0a" fontSize={11} tick={{ fill: '#0a0a0a', fontWeight: 600 }} />
                <YAxis stroke="#0a0a0a" fontSize={11} tick={{ fill: '#0a0a0a', fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f5f5f0',
                    border: '2px solid #0a0a0a',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0 0 #0a0a0a',
                    color: '#0a0a0a',
                    fontFamily: 'Geist, sans-serif',
                  }}
                  formatter={(value) => [formatCurrency(value), '']}
                />
                <Area type="monotone" dataKey="income" stackId="1" stroke="#0a0a0a" fill="#0a0a0a" fillOpacity={1} strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ff3b3b" fill="#ff3b3b" fillOpacity={1} strokeWidth={2} strokeDasharray="6 3" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BrutalCard>

        {/* Category Breakdown */}
        <BrutalCard className="p-6">
          <div className="flex items-center justify-between border-b-2 border-brutal-ink pb-3 mb-5">
            <h3 className="text-base font-extrabold tracking-tight text-brutal-ink uppercase">
              Expense Categories
            </h3>
            <button className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent">
              View All
            </button>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dashboardData.categoryBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={2} dataKey="value" stroke="#0a0a0a" strokeWidth={2}>
                  {dashboardData.categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#f5f5f0',
                    border: '2px solid #0a0a0a',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0 0 #0a0a0a',
                    color: '#0a0a0a',
                    fontFamily: 'Geist, sans-serif',
                  }}
                  formatter={(value) => [formatCurrency(value), '']}
                />
                <Legend wrapperStyle={{ fontFamily: 'Geist, sans-serif', fontSize: 12, fontWeight: 600, color: '#0a0a0a' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </BrutalCard>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Transactions */}
        <BrutalCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between border-b-2 border-brutal-ink pb-3 mb-5">
            <h3 className="text-base font-extrabold tracking-tight text-brutal-ink uppercase">
              Recent Transactions
            </h3>
            <button
              onClick={() => navigate('/transactions')}
              className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent flex items-center space-x-1"
            >
              <span>View All</span>
              <Eye size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {dashboardData.recentTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-3 border-2 border-transparent hover:border-brutal-ink hover:bg-amber-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/transactions/${transaction.id}`)}
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 border-2 border-brutal-ink ${
                    transaction.type === 'income' ? 'bg-emerald-200' : 'bg-rose-200'
                  }`}>
                    <CreditCard size={14} className="text-brutal-ink" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="font-bold text-brutal-ink">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-brutal-ink/60 tabular-nums">
                      {transaction.category} · {format(new Date(transaction.date), 'MMM dd')}
                    </p>
                  </div>
                </div>
                <div className={`font-extrabold tabular-nums ${
                  transaction.amount > 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                </div>
              </div>
            ))}
          </div>
        </BrutalCard>

        {/* Budget Progress */}
        <BrutalCard className="p-6">
          <div className="flex items-center justify-between border-b-2 border-brutal-ink pb-3 mb-5">
            <h3 className="text-base font-extrabold tracking-tight text-brutal-ink uppercase">
              Budget Progress
            </h3>
            <button
              onClick={() => navigate('/budgets')}
              className="text-[11px] font-bold uppercase tracking-[0.14em] text-brutal-ink underline underline-offset-2 decoration-2 decoration-brutal-accent"
            >
              Manage
            </button>
          </div>
          <div className="space-y-4">
            {dashboardData.budgetProgress.map((budget) => (
              <div key={budget.id || budget.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-bold text-brutal-ink">
                    {budget.name}
                  </span>
                  <span className="text-xs text-brutal-ink/70 tabular-nums">
                    {formatCurrency(budget.spent)} / {formatCurrency(budget.budgeted)}
                  </span>
                </div>
                <div className="w-full bg-brutal-paper border-2 border-brutal-ink h-3">
                  <div
                    className={`h-full transition-all duration-300 ${
                      budget.percentage > 90
                        ? 'bg-rose-500'
                        : budget.percentage > 75
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-[11px] font-bold tabular-nums uppercase tracking-wide ${
                    budget.percentage > 90
                      ? 'text-rose-700'
                      : budget.percentage > 75
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                  }`}>
                    {Number(budget.percentage || 0).toFixed(0)}% used
                  </span>
                  <span className="text-[11px] text-brutal-ink/60 tabular-nums">
                    {formatCurrency(budget.budgeted - budget.spent)} left
                  </span>
                </div>
              </div>
            ))}
          </div>
        </BrutalCard>
      </div>
    </div>
  );
};

export default Dashboard;
