import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { fetchTransactions, deleteTransaction, createTransaction, updateTransaction } from '../../store/slices/transactionSlice';
import { fetchCategories } from '../../store/slices/categorySlice';
import LoadingSpinner, { LoadingOverlay } from '../../components/UI/LoadingSpinner';
import Modal from '../../components/UI/Modal';
import TransactionForm from '../../components/Forms/TransactionForm';
import { toast } from 'react-hot-toast';
import ConfirmationDialog from '../../components/UI/ConfirmationDialog';
import api from '../../services/api';
import BrutalistScreen from '../../components/layout/BrutalistScreen';

const Transactions = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { transactions, loading, error, pagination } = useSelector((state) => state.transactions);
  const { categories } = useSelector((state) => state.categories);

  const [isFetchingTransactions, setIsFetchingTransactions] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  
  // State for modals and forms
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // State for filters and search
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    type: searchParams.get('type') || 'all',
    category: searchParams.get('category') || 'all',
    dateFrom: searchParams.get('dateFrom') || searchParams.get('startDate') || '',
    dateTo: searchParams.get('dateTo') || searchParams.get('endDate') || '',
    minAmount: searchParams.get('minAmount') || '',
    maxAmount: searchParams.get('maxAmount') || '',
    status: searchParams.get('status') || 'all',
  });
  
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'date');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page')) || 1);
  const debounceTimerRef = useRef(null);
  const lastSearchRef = useRef(filters.search);
  const lastLocationRef = useRef(filters.location);
  const bankStatementFileInputRef = useRef(null);

  const [bankStatementFile, setBankStatementFile] = useState(null);
  const [bankStatementAccount, setBankStatementAccount] = useState('Bank');
  const [bankStatementPassword, setBankStatementPassword] = useState('');
  const [defaultIncomeCategory, setDefaultIncomeCategory] = useState('');
  const [defaultExpenseCategory, setDefaultExpenseCategory] = useState('');
  const [bankStatementPreview, setBankStatementPreview] = useState([]);
  const [isParsingBankStatement, setIsParsingBankStatement] = useState(false);
  const [isImportingBankStatement, setIsImportingBankStatement] = useState(false);
  const [isAiCategorizingBankStatement, setIsAiCategorizingBankStatement] = useState(false);

  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.location) ||
    filters.type !== 'all' ||
    filters.category !== 'all' ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.minAmount) ||
    Boolean(filters.maxAmount) ||
    filters.status !== 'all';

  const buildQueryParams = useCallback(({ pageOverride } = {}) => {
    const { dateFrom, dateTo, ...restFilters } = filters;
    const params = {
      page: pageOverride || currentPage,
      limit: 10,
      sortBy,
      sortOrder,
      ...restFilters,
      startDate: dateFrom,
      endDate: dateTo,
    };

    Object.keys(params).forEach((key) => {
      if (params[key] === '' || params[key] === 'all') {
        delete params[key];
      }
    });

    return params;
  }, [currentPage, filters, sortBy, sortOrder]);

  const fetchTransactionsWithParams = useCallback(async (params) => {
    setIsFetchingTransactions(true);
    try {
      await dispatch(fetchTransactions(params)).unwrap();
    } catch (e) {
      const message = typeof e === 'string' ? e : e?.message || 'Failed to fetch transactions';
      toast.error(message);
    } finally {
      setIsFetchingTransactions(false);
    }
  }, [dispatch]);

  // Load data on component mount and when filters change
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const run = () => {
      const params = buildQueryParams();
      fetchTransactionsWithParams(params);

      const newSearchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) newSearchParams.set(key, value.toString());
      });
      setSearchParams(newSearchParams);
    };

    const searchChanged = lastSearchRef.current !== filters.search;
    const locationChanged = lastLocationRef.current !== filters.location;
    lastSearchRef.current = filters.search;
    lastLocationRef.current = filters.location;

    if (searchChanged || locationChanged) {
      debounceTimerRef.current = setTimeout(run, 350);
      return () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      };
    }

    run();
    return undefined;
  }, [buildQueryParams, fetchTransactionsWithParams, currentPage, sortBy, sortOrder, filters, setSearchParams]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionModal(true);
  };

  const handleDelete = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedTransaction) {
      setIsDeletingTransaction(true);
      try {
        await dispatch(deleteTransaction(selectedTransaction._id)).unwrap();
        toast.success('Transaction deleted.');
        setShowDeleteDialog(false);
        setSelectedTransaction(null);
      } catch (e) {
        const errorMessage = typeof e === 'string' ? e : e?.message || 'Failed to delete transaction';
        toast.error(errorMessage);
      } finally {
        setIsDeletingTransaction(false);
      }
    }
  };

  const handleTransactionSubmit = async (formData) => {
    if (isSavingTransaction) return;
    try {
      setIsSavingTransaction(true);
      let result;
      if (selectedTransaction) {
        // Update existing transaction
        result = await dispatch(updateTransaction({
          id: selectedTransaction._id,
          ...formData
        }));
        if (updateTransaction.fulfilled.match(result)) {
          toast.success('Transaction updated successfully!');
        } else {
          // Ensure we display a string message, not an object
          const errorMessage = typeof result.payload === 'string' 
            ? result.payload 
            : result.payload?.message || 'Failed to update transaction';
          toast.error(errorMessage || 'Failed to update transaction');
        }
      } else {
        // Create new transaction
        result = await dispatch(createTransaction(formData));
        if (createTransaction.fulfilled.match(result)) {
          toast.success('Transaction created successfully!');
        } else {
          // Ensure we display a string message, not an object
          const errorMessage = typeof result.payload === 'string' 
            ? result.payload 
            : result.payload?.message || 'Failed to create transaction';
          toast.error(errorMessage || 'Failed to create transaction');
        }
      }
      
      // Close modal and refresh data on success
      if (result.meta.requestStatus === 'fulfilled') {
        setShowTransactionModal(false);
        setSelectedTransaction(null);
        await fetchTransactionsWithParams(buildQueryParams());
      }
    } catch (error) {
      console.error('Error handling transaction:', error);
      toast.error('Could not save the transaction. Please try again.');
    } finally {
      setIsSavingTransaction(false);
    }
  };

  const handleExport = () => {
    try {
      // Create CSV content
      const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Status'];
      const csvContent = [
        headers.join(','),
        ...(transactions || []).map(transaction => [
          formatDate(transaction.date),
          `"${transaction.description || transaction.title || ''}"`,
          `"${transaction.category?.name || transaction.category || 'Uncategorized'}"`,
          transaction.type,
          transaction.amount,
          transaction.status || 'completed'
        ].join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Transactions exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export transactions');
    }
  };

  const handlePreviewBankStatement = async () => {
    if (!bankStatementFile) {
      toast.error('Please choose a bank statement file');
      return;
    }
    if (!bankStatementAccount.trim()) {
      toast.error('Please enter an account name');
      return;
    }
    if (!bankStatementPassword.trim()) {
      toast.error('Please enter the file password');
      return;
    }

    setIsParsingBankStatement(true);
    try {
      const formData = new FormData();
      formData.append('file', bankStatementFile);
      formData.append('password', bankStatementPassword);
      const response = await api.post('/transactions/import/bank-statement/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const list = response?.data?.data?.transactions;
      const otherIncomeCategoryId = Array.isArray(categories)
        ? categories.find((c) => c?.isActive !== false && (c?.type === 'income' || c?.type === 'both') && String(c?.name || '').trim().toLowerCase() === 'other income')?._id
        : '';
      const otherExpenseCategoryId = Array.isArray(categories)
        ? categories.find((c) => c?.isActive !== false && (c?.type === 'expense' || c?.type === 'both') && String(c?.name || '').trim().toLowerCase() === 'other expenses')?._id
        : '';
      const rows = Array.isArray(list)
        ? list.map((t, idx) => {
          const type = t?.type === 'income' || t?.type === 'expense' || t?.type === 'transfer' ? t.type : 'expense';
          const amount = typeof t?.amount === 'number' ? t.amount : Number(t?.amount);
          return {
            id: String(idx),
            selected: true,
            date: t?.date || '',
            title: t?.title || 'Bank transaction',
            description: t?.description || '',
            type,
            amount: Number.isFinite(amount) ? amount : 0,
            category: (type === 'income'
              ? (defaultIncomeCategory || otherIncomeCategoryId)
              : (defaultExpenseCategory || otherExpenseCategoryId)) || '',
          };
        })
        : [];

      if (!rows.length) {
        toast.error('No transactions detected in that PDF');
      }

      setBankStatementPreview(rows);
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'Failed to parse bank statement';
      toast.error(message);
    } finally {
      setIsParsingBankStatement(false);
    }
  };

  const handleAiCategorizeBankStatement = async () => {
    if (!bankStatementPreview.length) return;
    setIsAiCategorizingBankStatement(true);
    try {
      const payload = {
        transactions: bankStatementPreview.map((r) => ({
          title: r.title,
          description: r.description,
          amount: r.amount,
          type: r.type,
          date: r.date,
        })),
      };
      if (defaultIncomeCategory) payload.defaultIncomeCategory = defaultIncomeCategory;
      if (defaultExpenseCategory) payload.defaultExpenseCategory = defaultExpenseCategory;

      const response = await api.post('/transactions/import/bank-statement/ai-categorize', payload, { timeout: 60000 });
      const suggestions = response?.data?.data?.suggestions;
      if (!Array.isArray(suggestions) || !suggestions.length) {
        toast.error('No suggestions returned');
        return;
      }

      const map = new Map(
        suggestions
          .map((s) => ({
            index: Number(s?.index),
            title: typeof s?.title === 'string' ? s.title : '',
            category: typeof s?.category === 'string' ? s.category : '',
          }))
          .filter((s) => Number.isFinite(s.index))
          .map((s) => [String(s.index), s])
      );

      setBankStatementPreview((prev) =>
        prev.map((r) => {
          const s = map.get(String(r.id));
          if (!s) return r;
          return {
            ...r,
            title: s.title ? s.title : r.title,
            category: s.category ? s.category : r.category,
          };
        })
      );

      toast.success('Auto-categorization applied');
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'Failed to auto-categorize';
      toast.error(message);
    } finally {
      setIsAiCategorizingBankStatement(false);
    }
  };

  const handleImportBankStatement = async () => {
    const selected = bankStatementPreview.filter((r) => r.selected);
    if (!selected.length) {
      toast.error('Select at least one transaction to import');
      return;
    }

    const missingCategory = selected.find((r) => !r.category);
    if (missingCategory) {
      toast.error('Pick a category for all selected transactions');
      return;
    }

    setIsImportingBankStatement(true);
    try {
      const payload = selected.map((r) => ({
        title: r.title,
        amount: r.amount,
        type: r.type,
        category: r.category,
        account: bankStatementAccount.trim(),
        date: r.date,
        description: r.description,
      }));

      const response = await api.post('/transactions/import/bank-statement/commit', { transactions: payload });
      const count = response?.data?.data?.count ?? payload.length;
      toast.success(`Imported ${count} transactions`);

      setBankStatementPreview([]);
      setBankStatementFile(null);
      setBankStatementPassword('');
      if (bankStatementFileInputRef.current) bankStatementFileInputRef.current.value = '';

      await fetchTransactionsWithParams(buildQueryParams({ pageOverride: 1 }));
      setCurrentPage(1);
    } catch (e) {
      const message = e?.response?.data?.message || e?.message || 'Failed to import transactions';
      toast.error(message);
    } finally {
      setIsImportingBankStatement(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    try {
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const getTransactionTypeColor = (type) => {
    return type === 'income' ? 'text-success-600' : 'text-danger-600';
  };

  const getTransactionTypeIcon = (type) => {
    return type === 'income' ? (
      <ArrowUpIcon className="h-4 w-4 text-success-600" />
    ) : (
      <ArrowDownIcon className="h-4 w-4 text-danger-600" />
    );
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      location: '',
      type: 'all',
      category: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: '',
      status: 'all',
    });
    setCurrentPage(1);
  };

  if ((loading || isFetchingTransactions) && transactions.length === 0) {
    return <LoadingSpinner fullScreen text="Loading transactions..." />;
  }

  const totalPages = pagination?.totalPages ?? pagination?.pages ?? 1;
  const totalItems = pagination?.totalItems ?? pagination?.total ?? 0;
  const itemsPerPage = pagination?.itemsPerPage ?? pagination?.limit ?? 10;
  const paginationStart = totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const paginationEnd = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <BrutalistScreen>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Transactions</h1>
          <p className="text-secondary-600">Manage your financial transactions</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={handleExport}
            className="btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
            disabled={isFetchingTransactions}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={() => {
              setSelectedTransaction(null);
              setShowTransactionModal(true);
            }}
            className="btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
          >
            <PlusIcon className="h-4 w-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 border border-danger-200 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="font-medium text-danger-800">Couldn’t load transactions</div>
              <div className="text-sm text-danger-700">{error}</div>
            </div>
            <button
              onClick={() => fetchTransactionsWithParams(buildQueryParams())}
              className="btn-secondary w-full sm:w-auto"
              disabled={isFetchingTransactions}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-secondary-900">Bank statement</h3>
          <p className="text-secondary-600 text-sm">Upload a PDF and import transactions in bulk.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-secondary-700 mb-2">Statement (PDF/XLSX)</label>
            <input
              ref={bankStatementFileInputRef}
              type="file"
              accept="application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.pdf,.xlsx"
              onChange={(e) => setBankStatementFile(e.target.files?.[0] || null)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Account</label>
            <input
              type="text"
              value={bankStatementAccount}
              onChange={(e) => setBankStatementAccount(e.target.value)}
              className="input"
              placeholder="e.g. HDFC Savings"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Password</label>
            <input
              type="password"
              value={bankStatementPassword}
              onChange={(e) => setBankStatementPassword(e.target.value)}
              className="input"
              placeholder="Enter statement password"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={handlePreviewBankStatement}
              className="btn-secondary w-full"
              disabled={isParsingBankStatement || isImportingBankStatement}
            >
              {isParsingBankStatement ? 'Parsing…' : 'Preview'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Default expense category</label>
            <select
              value={defaultExpenseCategory}
              onChange={(e) => setDefaultExpenseCategory(e.target.value)}
              className="input"
            >
              <option value="">Select category</option>
              {Array.isArray(categories) && categories
                .filter((c) => c?.isActive !== false && (c?.type === 'expense' || c?.type === 'both'))
                .map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">Default income category</label>
            <select
              value={defaultIncomeCategory}
              onChange={(e) => setDefaultIncomeCategory(e.target.value)}
              className="input"
            >
              <option value="">Select category</option>
              {Array.isArray(categories) && categories
                .filter((c) => c?.isActive !== false && (c?.type === 'income' || c?.type === 'both'))
                .map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
            </select>
          </div>
        </div>

        {bankStatementPreview.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-secondary-700">
                Previewing {bankStatementPreview.length} detected transactions
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setBankStatementPreview((prev) => prev.map((r) => ({ ...r, selected: true })))}
                  disabled={isImportingBankStatement}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setBankStatementPreview((prev) => prev.map((r) => ({ ...r, selected: false })))}
                  disabled={isImportingBankStatement || isAiCategorizingBankStatement}
                >
                  Select none
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAiCategorizeBankStatement}
                  disabled={isImportingBankStatement || isAiCategorizingBankStatement}
                >
                  {isAiCategorizingBankStatement ? 'Auto-categorizing…' : 'Auto-categorize'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleImportBankStatement}
                  disabled={isImportingBankStatement || isAiCategorizingBankStatement}
                >
                  {isImportingBankStatement ? 'Importing…' : 'Import selected'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto hide-scrollbar border border-secondary-200 rounded-xl">
              <table className="table min-w-[900px]">
                <thead className="table-header">
                  <tr>
                    <th className="table-header-cell w-10"></th>
                    <th className="table-header-cell">Date</th>
                    <th className="table-header-cell">Description</th>
                    <th className="table-header-cell">Type</th>
                    <th className="table-header-cell">Amount</th>
                    <th className="table-header-cell">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-200">
                  {bankStatementPreview.map((row) => (
                    <tr key={row.id} className={row.selected ? '' : 'opacity-60'}>
                      <td className="table-cell">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBankStatementPreview((prev) => prev.map((r) => (r.id === row.id ? { ...r, selected: checked } : r)));
                          }}
                        />
                      </td>
                      <td className="table-cell whitespace-nowrap">{row.date ? formatDate(row.date) : '—'}</td>
                      <td className="table-cell">
                        <div className="max-w-[520px] truncate" title={row.description || row.title}>
                          {row.title}
                        </div>
                      </td>
                      <td className="table-cell whitespace-nowrap capitalize">{row.type}</td>
                      <td className="table-cell whitespace-nowrap">{formatCurrency(row.amount)}</td>
                      <td className="table-cell">
                        <select
                          value={row.category}
                          onChange={(e) => {
                            const value = e.target.value;
                            setBankStatementPreview((prev) => prev.map((r) => (r.id === row.id ? { ...r, category: value } : r)));
                          }}
                          className="input"
                        >
                          <option value="">Select category</option>
                          {Array.isArray(categories) && categories
                            .filter((c) => c?.isActive !== false && (c?.type === 'both' || c?.type === row.type))
                            .map((c) => (
                              <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-secondary-900">Filters</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center space-x-2"
          >
            <FunnelIcon className="h-4 w-4" />
            <span>{showFilters ? 'Hide' : 'Show'} Filters</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="input"
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Category
              </label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="input"
              >
                <option value="all">All Categories</option>
                {(categories || []).map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Min Amount
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Max Amount
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Location
              </label>
              <input
                type="text"
                placeholder="e.g. Los Angeles, CA"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="input"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="btn-secondary w-full"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <LoadingOverlay
        isLoading={isFetchingTransactions && transactions.length > 0}
        text="Updating transactions..."
      >
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 overflow-hidden">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="table min-w-[900px]">
              <thead className="table-header">
                <tr>
                  <th
                    className="table-header-cell cursor-pointer hover:bg-secondary-100"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Date</span>
                      {sortBy === 'date' && (
                        sortOrder === 'asc' ? 
                          <ArrowUpIcon className="h-4 w-4" /> : 
                          <ArrowDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="table-header-cell">Description</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Type</th>
                  <th
                    className="table-header-cell cursor-pointer hover:bg-secondary-100"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Amount</span>
                      {sortBy === 'amount' && (
                        sortOrder === 'asc' ? 
                          <ArrowUpIcon className="h-4 w-4" /> : 
                          <ArrowDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(transactions || []).map((transaction) => (
                  <tr key={transaction._id} className="table-row">
                    <td className="table-cell">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="font-medium text-secondary-900">
                          {transaction.description || transaction.title || 'Untitled'}
                        </div>
                        {transaction.notes && (
                          <div className="text-sm text-secondary-500">
                            {transaction.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                        {transaction.category?.name || 'Uncategorized'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-1">
                        {getTransactionTypeIcon(transaction.type)}
                        <span className={`capitalize ${getTransactionTypeColor(transaction.type)}`}>
                          {transaction.type}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`font-semibold ${getTransactionTypeColor(transaction.type)}`}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (transaction.status || 'completed') === 'completed' 
                          ? 'bg-success-100 text-success-800'
                          : (transaction.status || 'completed') === 'pending'
                          ? 'bg-warning-100 text-warning-800'
                          : 'bg-danger-100 text-danger-800'
                      }`}>
                        {transaction.status || 'completed'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-primary-600 hover:text-primary-700"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction)}
                          className="text-danger-600 hover:text-danger-700"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {transactions.length === 0 && !loading && !isFetchingTransactions && (
            <div className="text-center py-12">
              <div className="mx-auto h-12 w-12 text-secondary-400 mb-4">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-secondary-900 mb-2">No transactions found</h3>
              <p className="text-secondary-600 mb-4">
                {hasActiveFilters
                  ? 'Try adjusting your filters or search query.'
                  : 'Get started by adding your first transaction.'}
              </p>
              <button
                onClick={() => {
                  setSelectedTransaction(null);
                  setShowTransactionModal(true);
                }}
                className="btn-primary"
              >
                Add Transaction
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-4 border-t border-secondary-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-secondary-700">
                  Showing {paginationStart} to {paginationEnd} of {totalItems} results
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1 || isFetchingTransactions}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-secondary-700 whitespace-nowrap">
                    Page {Math.min(currentPage, totalPages)} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages || isFetchingTransactions}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </LoadingOverlay>

      {/* Transaction Modal */}
      <Modal
        isOpen={showTransactionModal}
        onClose={() => {
          setShowTransactionModal(false);
          setSelectedTransaction(null);
        }}
        title={selectedTransaction ? 'Edit Transaction' : 'Add Transaction'}
      >
        <TransactionForm
          transaction={selectedTransaction}
          onSubmit={handleTransactionSubmit}
          onCancel={() => {
            setShowTransactionModal(false);
            setSelectedTransaction(null);
          }}
          isLoading={isSavingTransaction}
        />
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={confirmDelete}
        title="Delete Transaction"
        message={`Are you sure you want to delete "${selectedTransaction?.description}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        isLoading={isDeletingTransaction}
      />
    </div>
    </BrutalistScreen>
  );
};

export default Transactions;
