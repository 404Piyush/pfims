import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks for transaction operations
export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/transactions', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transactions');
    }
  }
);

export const createTransaction = createAsyncThunk(
  'transactions/createTransaction',
  async (transactionData, { rejectWithValue }) => {
    try {
      const response = await api.post('/transactions', transactionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create transaction');
    }
  }
);

export const updateTransaction = createAsyncThunk(
  'transactions/updateTransaction',
  async ({ id, ...transactionData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/transactions/${id}`, transactionData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update transaction');
    }
  }
);

export const deleteTransaction = createAsyncThunk(
  'transactions/deleteTransaction',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/transactions/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete transaction');
    }
  }
);

export const getTransactionStats = createAsyncThunk(
  'transactions/getTransactionStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/transactions/stats', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch transaction stats');
    }
  }
);

// Analytics summary thunk for Reports & Analytics page
export const fetchAnalyticsSummary = createAsyncThunk(
  'transactions/fetchAnalyticsSummary',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/transactions/analytics/summary', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch analytics summary');
    }
  }
);

const initialState = {
  transactions: [],
  listSummary: {
    totalIncome: 0,
    totalExpense: 0,
    count: 0
  },
  stats: {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    monthlyData: [],
    categoryBreakdown: []
  },
  analyticsSummary: {
    totalIncome: 0,
    totalExpense: 0,
    netIncome: 0,
    transactionCount: 0,
    categories: {
      income: [],
      expense: []
    },
    trends: {
      period: 'month',
      dateRange: { start: null, end: null },
      monthlyData: []
    }
  },
  analyticsError: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
  filters: {
    category: '',
    type: '',
    dateRange: {
      start: null,
      end: null
    },
    search: ''
  }
};

const transactionSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch transactions
      .addCase(fetchTransactions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.loading = false;
        // Ensure transactions is always an array
        if (Array.isArray(action.payload)) {
          state.transactions = action.payload;
        } else if (action.payload.data && action.payload.data.transactions && Array.isArray(action.payload.data.transactions)) {
          state.transactions = action.payload.data.transactions;
        } else if (action.payload.transactions && Array.isArray(action.payload.transactions)) {
          state.transactions = action.payload.transactions;
        } else {
          state.transactions = [];
        }
        if (action.payload.data && action.payload.data.pagination) {
          state.pagination = action.payload.data.pagination;
        } else if (action.payload.pagination) {
          state.pagination = action.payload.pagination;
        }
        // Capture summary totals from list endpoint when available
        const summary = action.payload?.data?.summary || action.payload?.summary;
        if (summary && typeof summary === 'object') {
          state.listSummary = {
            totalIncome: summary.totalIncome ?? 0,
            totalExpense: summary.totalExpense ?? 0,
            count: summary.count ?? summary.transactionCount ?? 0
          };
        } else {
          state.listSummary = initialState.listSummary;
        }
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.transactions = []; // Ensure transactions is always an array
      })
      
      // Create transaction
      .addCase(createTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createTransaction.fulfilled, (state, action) => {
        state.loading = false;
        // Ensure transactions is an array before using unshift
        if (Array.isArray(state.transactions)) {
          state.transactions.unshift(action.payload);
        } else {
          state.transactions = [action.payload];
        }
      })
      .addCase(createTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update transaction
      .addCase(updateTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateTransaction.fulfilled, (state, action) => {
        state.loading = false;
        // Ensure transactions is an array before using findIndex
        if (Array.isArray(state.transactions)) {
          const index = state.transactions.findIndex(t => t._id === action.payload._id);
          if (index !== -1) {
            state.transactions[index] = action.payload;
          }
        } else {
          state.transactions = [action.payload];
        }
      })
      .addCase(updateTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete transaction
      .addCase(deleteTransaction.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteTransaction.fulfilled, (state, action) => {
        state.loading = false;
        // Ensure transactions is an array before using filter
        if (Array.isArray(state.transactions)) {
          state.transactions = state.transactions.filter(t => t._id !== action.payload);
        } else {
          state.transactions = [];
        }
      })
      .addCase(deleteTransaction.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get transaction stats
      .addCase(getTransactionStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getTransactionStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(getTransactionStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch analytics summary
      .addCase(fetchAnalyticsSummary.pending, (state) => {
        state.loading = true;
        state.analyticsError = null;
      })
      .addCase(fetchAnalyticsSummary.fulfilled, (state, action) => {
        state.loading = false;
        const payload = action.payload?.data ?? action.payload;
        if (payload && typeof payload === 'object') {
          state.analyticsSummary = {
            totalIncome: payload.totalIncome ?? 0,
            totalExpense: payload.totalExpense ?? 0,
            netIncome: payload.netIncome ?? 0,
            transactionCount: payload.transactionCount ?? 0,
            categories: payload.categories ?? { income: [], expense: [] },
            trends: {
              period: payload.trends?.period ?? 'month',
              dateRange: payload.trends?.dateRange ?? { start: null, end: null },
              monthlyData: payload.trends?.monthlyData ?? []
            }
          };
        }
      })
      .addCase(fetchAnalyticsSummary.rejected, (state, action) => {
        state.loading = false;
        state.analyticsError = action.payload || 'Failed to load analytics summary';
        state.analyticsSummary = initialState.analyticsSummary;
      });
  }
});

export const { clearError, setFilters, clearFilters, setPagination, setLoading } = transactionSlice.actions;
export default transactionSlice.reducer;