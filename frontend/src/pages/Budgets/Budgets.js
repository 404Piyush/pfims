import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  WalletIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { fetchBudgets, deleteBudget, createBudget, updateBudget, getBudgetAlerts, markAlertAsRead, clearAlerts } from '../../store/slices/budgetSlice';
import { fetchCategories } from '../../store/slices/categorySlice';
import { fetchTransactions } from '../../store/slices/transactionSlice';
import LoadingSpinner, { LoadingOverlay } from '../../components/ui/LoadingSpinner';
import Modal from '../../components/ui/Modal';
import BudgetForm from '../../components/Forms/BudgetForm';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import BrutalistScreen from '../../components/layout/BrutalistScreen';
import { toast } from 'react-hot-toast';

const Budgets = () => {
  const dispatch = useDispatch();
  const { budgets, loading, error, alerts, alertsLoading } = useSelector((state) => state.budgets);
  const { transactions } = useSelector((state) => state.transactions);

  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isDeletingBudget, setIsDeletingBudget] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const shownAlertIdsRef = useRef(new Set());
  
  // State for modals and forms
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);
  
  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  
  // Load data on component mount
  const loadPageData = useCallback(() => {
    dispatch(fetchBudgets());
    dispatch(getBudgetAlerts());
    dispatch(fetchCategories());
    dispatch(fetchTransactions({ 
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    }));
  }, [dispatch]);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    if (!Array.isArray(alerts) || alerts.length === 0) return;

    const newUnreadAlerts = alerts.filter((alert) => {
      const key = alert.id || alert._id;
      return key && !alert.isRead && !shownAlertIdsRef.current.has(key);
    });

    if (newUnreadAlerts.length === 0) return;

    newUnreadAlerts.forEach((alert) => {
      const key = alert.id || alert._id;
      if (key) shownAlertIdsRef.current.add(key);
    });

    if (newUnreadAlerts.length === 1) {
      const alert = newUnreadAlerts[0];
      const utilization = typeof alert.utilizationPercentage === 'number'
        ? `${alert.utilizationPercentage.toFixed(1)}%`
        : '';
      toast(`${alert.budgetName || 'Budget'} alert ${utilization}`.trim());
    } else {
      toast(`${newUnreadAlerts.length} new budget alerts`);
    }
  }, [alerts]);

  // Calculate budget progress
  const calculateBudgetProgress = (budget) => {
    const budgetStart = parseISO(budget.startDate);
    const budgetEnd = parseISO(budget.endDate);
    
    // Calculate total budget amount from all categories
    const totalBudgetAmount = Array.isArray(budget.categories) 
      ? budget.categories.reduce((sum, cat) => sum + (cat.budgetAmount || 0), 0)
      : (budget.totalBudget || 0);
    
    // Get category IDs for this budget
    const budgetCategoryIds = Array.isArray(budget.categories) 
      ? budget.categories.map(cat => cat.category?._id || cat.category)
      : [];
    
    // Filter transactions for this budget's categories and period
    const budgetTransactions = Array.isArray(transactions) ? transactions.filter(transaction => {
      const transactionDate = parseISO(transaction.date);
      const categoryId = transaction.category?._id || transaction.category;
      return (
        budgetCategoryIds.includes(categoryId) &&
        transaction.type === 'expense' &&
        transactionDate >= budgetStart &&
        transactionDate <= budgetEnd
      );
    }) : [];
    
    const spent = budgetTransactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
    const percentage = totalBudgetAmount > 0 ? (spent / totalBudgetAmount) * 100 : 0;
    const remaining = totalBudgetAmount - spent;
    
    let status = 'on-track';
    if (percentage >= 100) {
      status = 'exceeded';
    } else if (percentage >= 80) {
      status = 'warning';
    }
    
    // Ensure no NaN values
    return {
      spent: isNaN(spent) ? 0 : spent,
      percentage: isNaN(percentage) ? 0 : Math.min(percentage, 100),
      remaining: isNaN(remaining) ? totalBudgetAmount : remaining,
      status,
      transactionCount: budgetTransactions.length,
      totalBudgetAmount: isNaN(totalBudgetAmount) ? 0 : totalBudgetAmount
    };
  };

  // Filter budgets based on search and filters
  const filteredBudgets = Array.isArray(budgets) ? budgets.filter(budget => {
    const progress = calculateBudgetProgress(budget);
    const matchesSearch = budget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (budget.description && budget.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || progress.status === statusFilter;
    const matchesPeriod = periodFilter === 'all' || budget.period === periodFilter;
    return matchesSearch && matchesStatus && matchesPeriod;
  }) : [];

  const handleEdit = (budget) => {
    setSelectedBudget(budget);
    setShowBudgetModal(true);
  };

  const handleDelete = (budget) => {
    setSelectedBudget(budget);
    setShowDeleteDialog(true);
  };

  const handleExportBudgets = () => {
    try {
      const headers = [
        'Name',
        'Period',
        'Start Date',
        'End Date',
        'Categories',
        'Budget Amount',
        'Spent Amount',
        'Remaining Amount',
        'Utilization %',
        'Status'
      ];

      const csvContent = [
        headers.join(','),
        ...filteredBudgets.map((budget) => {
          const progress = calculateBudgetProgress(budget);
          const name = `"${(budget.name || '').replace(/"/g, '""')}"`;
          const period = budget.period || '';
          const startDate = budget.startDate || '';
          const endDate = budget.endDate || '';
          const categoriesCount = Array.isArray(budget.categories) ? budget.categories.length : 0;
          const total = progress.totalBudgetAmount || 0;
          const spent = progress.spent || 0;
          const remaining = (progress.remaining ?? 0);
          const pct = typeof progress.percentage === 'number' ? progress.percentage.toFixed(1) : '0.0';
          const status = progress.status || '';

          return [
            name,
            period,
            startDate,
            endDate,
            categoriesCount,
            total,
            spent,
            remaining,
            pct,
            status
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `budgets_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Budgets exported successfully!');
    } catch (e) {
      toast.error('Failed to export budgets');
    }
  };

  const confirmDelete = async () => {
    if (selectedBudget) {
      setIsDeletingBudget(true);
      try {
        await dispatch(deleteBudget(selectedBudget._id)).unwrap();
        toast.success('Budget deleted.');
        setShowDeleteDialog(false);
        setSelectedBudget(null);
      } catch (e) {
        const errorMessage = typeof e === 'string' ? e : e?.message || 'Failed to delete budget';
        toast.error(errorMessage);
      } finally {
        setIsDeletingBudget(false);
      }
    }
  };

  // Handle budget form submission
  const handleBudgetSubmit = async (budgetData) => {
    if (isSavingBudget) return;
    try {
      setIsSavingBudget(true);
      if (selectedBudget) {
        // Update existing budget
        await dispatch(updateBudget({ id: selectedBudget._id, ...budgetData })).unwrap();
        toast.success('Budget updated successfully!');
      } else {
        // Create new budget
        await dispatch(createBudget(budgetData)).unwrap();
        toast.success('Budget created successfully!');
      }
      setShowBudgetModal(false);
      setSelectedBudget(null);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : error?.message || 'Failed to save budget';
      toast.error(errorMessage);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'exceeded':
        return 'bg-danger-100 text-danger-800 border-danger-200';
      case 'warning':
        return 'bg-warning-100 text-warning-800 border-warning-200';
      case 'on-track':
        return 'bg-success-100 text-success-800 border-success-200';
      default:
        return 'bg-secondary-100 text-secondary-800 border-secondary-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'exceeded':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'warning':
        return <ClockIcon className="h-4 w-4" />;
      case 'on-track':
        return <CheckCircleIcon className="h-4 w-4" />;
      default:
        return <ChartBarIcon className="h-4 w-4" />;
    }
  };

  const getProgressBarColor = (status) => {
    switch (status) {
      case 'exceeded':
        return 'bg-danger-500';
      case 'warning':
        return 'bg-warning-500';
      case 'on-track':
        return 'bg-success-500';
      default:
        return 'bg-primary-500';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getPeriodLabel = (period) => {
    const labels = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
      custom: 'Custom'
    };
    return labels[period] || period;
  };

  // Calculate overall statistics
  const totalBudgets = budgets.length;
  const totalBudgetAmount = Array.isArray(budgets) ? budgets.reduce((sum, budget) => {
    // Calculate total from categories array or use totalBudget field
    const budgetAmount = Array.isArray(budget.categories) 
      ? budget.categories.reduce((catSum, cat) => catSum + (cat.budgetAmount || 0), 0)
      : (budget.totalBudget || 0);
    return sum + budgetAmount;
  }, 0) : 0;
  
  const totalSpent = Array.isArray(budgets) ? budgets.reduce((sum, budget) => {
    const progress = calculateBudgetProgress(budget);
    return sum + progress.spent;
  }, 0) : 0;
  
  const budgetsExceeded = Array.isArray(budgets) ? budgets.filter(budget => {
    const progress = calculateBudgetProgress(budget);
    return progress.status === 'exceeded';
  }).length : 0;

  const alertKey = (alert) => alert.id || alert._id;
  const unreadAlerts = Array.isArray(alerts) ? alerts.filter(a => !a.isRead) : [];
  const displayedAlerts = showAllAlerts ? (alerts || []) : (alerts || []).slice(0, 5);

  const getAlertSeverity = (alert) => {
    const utilization = typeof alert.utilizationPercentage === 'number' ? alert.utilizationPercentage : 0;
    if (alert.type === 'over_budget' || utilization >= 100) return 'critical';
    if (utilization >= 90) return 'high';
    return 'medium';
  };

  const getAlertStyles = (severity) => {
    switch (severity) {
      case 'critical':
        return {
          container: 'border-danger-200 bg-danger-50',
          badge: 'bg-danger-100 text-danger-800',
          icon: <ExclamationTriangleIcon className="h-4 w-4 text-danger-600" />
        };
      case 'high':
        return {
          container: 'border-warning-200 bg-warning-50',
          badge: 'bg-warning-100 text-warning-800',
          icon: <ClockIcon className="h-4 w-4 text-warning-600" />
        };
      default:
        return {
          container: 'border-primary-200 bg-primary-50',
          badge: 'bg-primary-100 text-primary-800',
          icon: <ChartBarIcon className="h-4 w-4 text-primary-600" />
        };
    }
  };

  const formatAlertTime = (createdAt) => {
    if (!createdAt) return '';
    try {
      return format(parseISO(createdAt), 'MMM dd, HH:mm');
    } catch (e) {
      return '';
    }
  };

  if (loading && budgets.length === 0) {
    return <LoadingSpinner fullScreen text="Loading budgets..." />;
  }

  return (
    <BrutalistScreen>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Budgets</h1>
          <p className="text-secondary-600">Track and manage your spending limits</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handleExportBudgets}
            className="btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
            disabled={loading || filteredBudgets.length === 0}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => {
              setSelectedBudget(null);
              setShowBudgetModal(true);
            }}
            className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Create Budget</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-medium text-danger-800">Couldn’t load budgets</div>
              <div className="text-sm text-danger-700">{error}</div>
            </div>
            <button
              onClick={loadPageData}
              className="btn-secondary w-full sm:w-auto"
              disabled={loading}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Budgets</p>
              <p className="text-2xl font-bold text-secondary-900">{totalBudgets}</p>
            </div>
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <WalletIcon className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Allocated</p>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(totalBudgetAmount)}</p>
            </div>
            <div className="h-12 w-12 bg-success-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingUpIcon className="h-6 w-6 text-success-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Total Spent</p>
              <p className="text-2xl font-bold text-secondary-900">{formatCurrency(totalSpent)}</p>
            </div>
            <div className="h-12 w-12 bg-warning-100 rounded-lg flex items-center justify-center">
              <ArrowTrendingDownIcon className="h-6 w-6 text-warning-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-600">Exceeded</p>
              <p className="text-2xl font-bold text-danger-600">{budgetsExceeded}</p>
            </div>
            <div className="h-12 w-12 bg-danger-100 rounded-lg flex items-center justify-center">
              <ExclamationTriangleIcon className="h-6 w-6 text-danger-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-secondary-900">Budget Alerts</h3>
            {unreadAlerts.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger-100 text-danger-800">
                {unreadAlerts.length} unread
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => dispatch(getBudgetAlerts())}
              className="btn-secondary flex items-center space-x-2"
              disabled={alertsLoading}
            >
              <ArrowPathIcon className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => dispatch(clearAlerts())}
              className="btn-secondary"
              disabled={(alerts || []).length === 0}
            >
              Clear
            </button>
          </div>
        </div>

        <LoadingOverlay isLoading={alertsLoading && (alerts || []).length > 0} text="Updating alerts...">
          {(alerts || []).length === 0 ? (
            <div className="text-sm text-secondary-600">
              No budget alerts right now.
            </div>
          ) : (
            <div className="space-y-3">
              {displayedAlerts.map((alert) => {
                const severity = getAlertSeverity(alert);
                const styles = getAlertStyles(severity);
                const key = alertKey(alert);
                const utilization = typeof alert.utilizationPercentage === 'number'
                  ? alert.utilizationPercentage.toFixed(1)
                  : null;
                const threshold = typeof alert.threshold === 'number' ? alert.threshold : null;

                return (
                  <div
                    key={key}
                    className={`border rounded-lg p-4 ${styles.container} ${alert.isRead ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {styles.icon}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-secondary-900">
                              {alert.budgetName || 'Budget'}
                              {alert.categoryName ? ` • ${alert.categoryName}` : ''}
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                              {alert.type === 'over_budget' ? 'Over budget' : 'Threshold'}
                            </span>
                            {utilization !== null && (
                              <span className="text-xs text-secondary-600">
                                {utilization}%{threshold !== null ? ` (threshold ${threshold}%)` : ''}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-sm text-secondary-700">
                            Spent {formatCurrency(alert.spentAmount || 0)} of {formatCurrency(alert.budgetAmount || 0)}
                            {typeof alert.spentAmount === 'number' && typeof alert.budgetAmount === 'number'
                              ? ` • Remaining ${formatCurrency((alert.budgetAmount || 0) - (alert.spentAmount || 0))}`
                              : ''}
                          </div>
                          {alert.createdAt && (
                            <div className="mt-1 text-xs text-secondary-600">
                              {formatAlertTime(alert.createdAt)}
                            </div>
                          )}
                        </div>
                      </div>
                      {!alert.isRead && key && (
                        <button
                          onClick={() => dispatch(markAlertAsRead(key))}
                          className="btn-secondary"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {(alerts || []).length > 5 && (
                <div className="pt-2">
                  <button
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {showAllAlerts ? 'Show less' : `Show all (${(alerts || []).length})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </LoadingOverlay>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
              <input
                type="text"
                placeholder="Search budgets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input sm:w-40"
            >
              <option value="all">All Status</option>
              <option value="on-track">On Track</option>
              <option value="warning">Warning</option>
              <option value="exceeded">Exceeded</option>
            </select>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="input sm:w-40"
            >
              <option value="all">All Periods</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      {/* Budgets Grid */}
      <LoadingOverlay isLoading={loading && budgets.length > 0} text="Updating budgets...">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBudgets.map((budget) => {
            const progress = calculateBudgetProgress(budget);
            return (
              <div
                key={budget._id}
                className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-secondary-900 mb-1">
                      {budget.name}
                    </h3>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-sm text-secondary-600">
                        {Array.isArray(budget.categories) && budget.categories.length > 0
                          ? budget.categories.length === 1 
                            ? budget.categories[0].category?.name || 'Category'
                            : `${budget.categories.length} Categories`
                          : 'All Categories'}
                      </span>
                      <span className="text-secondary-400">•</span>
                      <span className="text-sm text-secondary-600">
                        {getPeriodLabel(budget.period)}
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(progress.status)}`}>
                      {getStatusIcon(progress.status)}
                      <span className="ml-1 capitalize">{progress.status.replace('-', ' ')}</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(budget)}
                      className="text-primary-600 hover:text-primary-700 p-1"
                      title="Edit"
                      disabled={loading}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(budget)}
                      className="text-danger-600 hover:text-danger-700 p-1"
                      title="Delete"
                      disabled={loading}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {budget.description && (
                  <p className="text-sm text-secondary-600 mb-4">
                    {budget.description}
                  </p>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-secondary-700">
                      {formatCurrency(progress.spent)} / {formatCurrency(progress.totalBudgetAmount || 0)}
                    </span>
                    <span className="text-sm text-secondary-600">
                      {(progress.percentage || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(progress.status)}`}
                      style={{ width: `${Math.min(progress.percentage || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-secondary-600">Remaining:</span>
                    <div className={`font-semibold ${(progress.remaining || 0) >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                      {formatCurrency(Math.abs(progress.remaining || 0))}
                      {(progress.remaining || 0) < 0 && ' over'}
                    </div>
                  </div>
                  <div>
                    <span className="text-secondary-600">Transactions:</span>
                    <div className="font-semibold text-secondary-900">
                      {progress.transactionCount || 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-secondary-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-secondary-500">
                    <span>From: {format(parseISO(budget.startDate), 'MMM dd, yyyy')}</span>
                    <span>To: {format(parseISO(budget.endDate), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </LoadingOverlay>

      {/* Empty State */}
      {filteredBudgets.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-12 text-center">
          <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
            <WalletIcon className="h-12 w-12" />
          </div>
          <h3 className="text-lg font-medium text-secondary-900 mb-2">
            {searchTerm || statusFilter !== 'all' || periodFilter !== 'all' ? 'No budgets found' : 'No budgets yet'}
          </h3>
          <p className="text-secondary-600 mb-6">
            {searchTerm || statusFilter !== 'all' || periodFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Create your first budget to start tracking your spending limits.'
            }
          </p>
          {(!searchTerm && statusFilter === 'all' && periodFilter === 'all') && (
            <button
              onClick={() => {
                setSelectedBudget(null);
                setShowBudgetModal(true);
              }}
              className="btn-primary"
            >
              Create Budget
            </button>
          )}
        </div>
      )}

      {/* Budget Modal */}
      <Modal
        isOpen={showBudgetModal}
        onClose={() => {
          setShowBudgetModal(false);
          setSelectedBudget(null);
        }}
        title={selectedBudget ? 'Edit Budget' : 'Create Budget'}
      >
        <BudgetForm
          budget={selectedBudget}
          onSubmit={handleBudgetSubmit}
          onCancel={() => {
            setShowBudgetModal(false);
            setSelectedBudget(null);
          }}
          isLoading={isSavingBudget}
        />
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Budget"
        message={`Are you sure you want to delete "${selectedBudget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={isDeletingBudget}
      />
    </div>
    </BrutalistScreen>
  );
};

export default Budgets;
