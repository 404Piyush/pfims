import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, startOfYear, endOfYear } from 'date-fns';
import {
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  DocumentArrowDownIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { fetchTransactions } from '../../store/slices/transactionSlice';
import { fetchCategories } from '../../store/slices/categorySlice';
import { fetchBudgets } from '../../store/slices/budgetSlice';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

const Reports = () => {
  const dispatch = useDispatch();
  const { transactions, loading } = useSelector((state) => state.transactions);
  const { categories } = useSelector((state) => state.categories);
  const { budgets } = useSelector((state) => state.budgets);
  
  // State for date range and filters
  const [dateRange, setDateRange] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reportType, setReportType] = useState('overview');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // Load data on component mount and when filters change
  useEffect(() => {
    const { startDate, endDate } = getDateRange();
    dispatch(fetchTransactions()); // Remove status filter to get all transactions
    dispatch(fetchCategories());
    dispatch(fetchBudgets());
  }, [dispatch, dateRange, categoryFilter]);

  // Get date range based on selection
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'thisMonth':
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
      case 'thisYear':
        return { startDate: startOfYear(now), endDate: endOfYear(now) };
      case 'custom':
        return {
          startDate: customDateFrom ? parseISO(customDateFrom) : startOfMonth(now),
          endDate: customDateTo ? parseISO(customDateTo) : endOfMonth(now)
        };
      default:
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  };

  // Filter transactions based on current filters
  const filteredTransactions = Array.isArray(transactions) ? transactions.filter(transaction => {
    // For "all" date range, don't filter by date
    if (dateRange === 'all') {
      const inCategory = categoryFilter === 'all' || transaction.category?._id === categoryFilter;
      return inCategory;
    }
    
    // For other date ranges, apply date filtering
    const { startDate, endDate } = getDateRange();
    const transactionDate = parseISO(transaction.date);
    const inDateRange = transactionDate >= startDate && transactionDate <= endDate;
    const inCategory = categoryFilter === 'all' || transaction.category?._id === categoryFilter;
    return inDateRange && inCategory;
  }) : [];

  // Calculate financial metrics
  const calculateMetrics = () => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const netIncome = income - expenses;
    const savingsRate = income > 0 ? ((netIncome / income) * 100) : 0;
    
    return { 
      income, 
      expenses, 
      netIncome, 
      savingsRate: isNaN(savingsRate) ? 0 : savingsRate 
    };
  };

  // Get spending by category
  const getSpendingByCategory = () => {
    const categorySpending = {};
    
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const categoryName = transaction.category?.name || 'Uncategorized';
        const categoryColor = transaction.category?.color || '#6B7280';
        
        if (!categorySpending[categoryName]) {
          categorySpending[categoryName] = {
            amount: 0,
            color: categoryColor,
            transactions: 0
          };
        }
        
        categorySpending[categoryName].amount += transaction.amount;
        categorySpending[categoryName].transactions += 1;
      });
    
    return Object.entries(categorySpending)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);
  };

  // Get monthly trends (for the year view)
  const getMonthlyTrends = () => {
    const monthlyData = {};
    
    filteredTransactions.forEach(transaction => {
      const month = format(parseISO(transaction.date), 'MMM yyyy');
      
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expenses: 0 };
      }
      
      if (transaction.type === 'income') {
        monthlyData[month].income += transaction.amount;
      } else {
        monthlyData[month].expenses += transaction.amount;
      }
    });
    
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        ...data,
        net: data.income - data.expenses
      }))
      .sort((a, b) => new Date(a.month) - new Date(b.month));
  };

  // Get budget performance
  const getBudgetPerformance = () => {
    return Array.isArray(budgets) ? budgets.map(budget => {
      const { startDate, endDate } = getDateRange();
      
      // Calculate total budget amount from all categories
      const totalBudgetAmount = Array.isArray(budget.categories) 
        ? budget.categories.reduce((sum, cat) => sum + (cat.budgetAmount || 0), 0)
        : (budget.totalBudget || budget.amount || 0);
      
      // Get category IDs for this budget
      const budgetCategoryIds = Array.isArray(budget.categories) 
        ? budget.categories.map(cat => cat.category?._id || cat.category)
        : [budget.category?._id || budget.category].filter(Boolean);
      
      // Filter transactions for this budget's categories and period
      const budgetTransactions = filteredTransactions.filter(transaction => {
        const transactionDate = parseISO(transaction.date);
        const categoryId = transaction.category?._id || transaction.category;
        return (
          budgetCategoryIds.includes(categoryId) &&
          transaction.type === 'expense' &&
          transactionDate >= parseISO(budget.startDate) &&
          transactionDate <= parseISO(budget.endDate)
        );
      });
      
      const spent = budgetTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const percentage = totalBudgetAmount > 0 ? (spent / totalBudgetAmount) * 100 : 0;
      
      return {
        ...budget,
        spent: isNaN(spent) ? 0 : spent,
        percentage: isNaN(percentage) ? 0 : percentage,
        remaining: isNaN(totalBudgetAmount - spent) ? totalBudgetAmount : totalBudgetAmount - spent,
        amount: totalBudgetAmount, // Add this for display consistency
        status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'on-track'
      };
    }) : [];
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const metrics = calculateMetrics();
  const categorySpending = getSpendingByCategory();
  const monthlyTrends = getMonthlyTrends();
  const budgetPerformance = getBudgetPerformance();

  if (loading && transactions.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Reports & Analytics</h1>
          <p className="text-secondary-600">Comprehensive financial insights and trends</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="btn-secondary flex items-center space-x-2">
            <DocumentArrowDownIcon className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button 
            onClick={() => {
              const { startDate, endDate } = getDateRange();
              dispatch(fetchTransactions({ 
                dateFrom: format(startDate, 'yyyy-MM-dd'),
                dateTo: format(endDate, 'yyyy-MM-dd')
              }));
            }}
            className="btn-primary flex items-center space-x-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="flex-1">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="input"
              >
                <option value="all">All Transactions</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="thisYear">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            
            {dateRange === 'custom' && (
              <>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="input"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="input"
                  />
                </div>
              </>
            )}
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Categories</option>
                {Array.isArray(categories) && categories.map(category => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Income</p>
              <p className="text-2xl font-bold text-success-600">{formatCurrency(metrics.income)}</p>
            </div>
            <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="h-6 w-6 text-success-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Expenses</p>
              <p className="text-2xl font-bold text-danger-600">{formatCurrency(metrics.expenses)}</p>
            </div>
            <div className="h-12 w-12 bg-danger-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingDownIcon className="h-6 w-6 text-danger-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Net Income</p>
              <p className={`text-2xl font-bold ${metrics.netIncome >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {formatCurrency(metrics.netIncome)}
              </p>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <CurrencyDollarIcon className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Savings Rate</p>
              <p className={`text-2xl font-bold ${metrics.savingsRate >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                {isNaN(metrics.savingsRate) ? '0.0' : metrics.savingsRate.toFixed(1)}%
              </p>
            </div>
            <div className="h-12 w-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <ChartBarIcon className="h-6 w-6 text-warning-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-6">Spending by Category</h3>
          <div className="space-y-4">
            {categorySpending.slice(0, 8).map((category, index) => {
              const percentage = metrics.expenses > 0 ? (category.amount / metrics.expenses) * 100 : 0;
              return (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-secondary-900">
                          {category.name}
                        </span>
                        <span className="text-sm text-secondary-600">
                          {formatCurrency(category.amount)}
                        </span>
                      </div>
                      <div className="w-full bg-secondary-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: category.color 
                          }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-secondary-500">
                          {category.transactions} transactions
                        </span>
                        <span className="text-xs text-secondary-500">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-6">Budget Performance</h3>
          <div className="space-y-4">
            {budgetPerformance.slice(0, 6).map((budget) => (
              <div key={budget._id} className="border border-secondary-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-secondary-900">{budget.name}</span>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    budget.status === 'exceeded' ? 'bg-danger-100 text-danger-800' :
                    budget.status === 'warning' ? 'bg-warning-100 text-warning-800' :
                    'bg-success-100 text-success-800'
                  }`}>
                    {budget.status === 'exceeded' ? 'Exceeded' :
                     budget.status === 'warning' ? 'Warning' : 'On Track'}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-secondary-600">
                    {formatCurrency(budget.spent || 0)} / {formatCurrency(budget.amount || 0)}
                  </span>
                  <span className="text-sm text-secondary-600">
                    {(budget.percentage || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-secondary-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      budget.status === 'exceeded' ? 'bg-danger-500' :
                      budget.status === 'warning' ? 'bg-warning-500' : 'bg-success-500'
                    }`}
                    style={{ width: `${Math.min(budget.percentage || 0, 100)}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {budgetPerformance.length === 0 && (
              <div className="text-center py-8">
                <ChartBarIcon className="mx-auto h-12 w-12 text-secondary-400 mb-4" />
                <p className="text-secondary-600">No budgets found for this period</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Trends (only show for yearly view) */}
      {dateRange === 'thisYear' && monthlyTrends.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <h3 className="text-lg font-semibold text-secondary-900 mb-6">Monthly Trends</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="text-left py-3 px-4 font-medium text-secondary-900">Month</th>
                  <th className="text-right py-3 px-4 font-medium text-secondary-900">Income</th>
                  <th className="text-right py-3 px-4 font-medium text-secondary-900">Expenses</th>
                  <th className="text-right py-3 px-4 font-medium text-secondary-900">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrends.map((month, index) => (
                  <tr key={month.month} className="border-b border-secondary-100">
                    <td className="py-3 px-4 text-secondary-900">{month.month}</td>
                    <td className="py-3 px-4 text-right text-success-600 font-medium">
                      {formatCurrency(month.income)}
                    </td>
                    <td className="py-3 px-4 text-right text-danger-600 font-medium">
                      {formatCurrency(month.expenses)}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      month.net >= 0 ? 'text-success-600' : 'text-danger-600'
                    }`}>
                      {formatCurrency(month.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Transaction Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <h3 className="text-lg font-semibold text-secondary-900 mb-6">Transaction Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary-900 mb-1">
              {filteredTransactions.length}
            </div>
            <div className="text-sm text-secondary-600">Total Transactions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success-600 mb-1">
              {filteredTransactions.filter(t => t.type === 'income').length}
            </div>
            <div className="text-sm text-secondary-600">Income Transactions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-danger-600 mb-1">
              {filteredTransactions.filter(t => t.type === 'expense').length}
            </div>
            <div className="text-sm text-secondary-600">Expense Transactions</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;