import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks for budget operations
export const fetchBudgets = createAsyncThunk(
  'budgets/fetchBudgets',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/budgets', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch budgets');
    }
  }
);

export const createBudget = createAsyncThunk(
  'budgets/createBudget',
  async (budgetData, { rejectWithValue }) => {
    try {
      const response = await api.post('/budgets', budgetData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create budget');
    }
  }
);

export const updateBudget = createAsyncThunk(
  'budgets/updateBudget',
  async ({ id, ...budgetData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/budgets/${id}`, budgetData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update budget');
    }
  }
);

export const deleteBudget = createAsyncThunk(
  'budgets/deleteBudget',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/budgets/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete budget');
    }
  }
);

export const getBudgetProgress = createAsyncThunk(
  'budgets/getBudgetProgress',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/budgets/progress', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch budget progress');
    }
  }
);

export const getBudgetAlerts = createAsyncThunk(
  'budgets/getBudgetAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/budgets/alerts');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch budget alerts');
    }
  }
);

const initialState = {
  budgets: [],
  progress: [],
  alerts: [],
  progressLoading: false,
  alertsLoading: false,
  stats: {
    totalBudgets: 0,
    activeBudgets: 0,
    totalBudgetAmount: 0,
    totalSpent: 0,
    averageProgress: 0
  },
  loading: false,
  error: null,
  filters: {
    category: '',
    status: '', // 'active', 'exceeded', 'completed'
    period: '', // 'monthly', 'yearly'
    search: ''
  }
};

const budgetSlice = createSlice({
  name: 'budgets',
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
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    updateBudgetProgress: (state, action) => {
      const { budgetId, spent, progress } = action.payload;
      const budget = state.budgets.find(b => b._id === budgetId);
      if (budget) {
        budget.spent = spent;
        budget.progress = progress;
      }
    },
    markAlertAsRead: (state, action) => {
      const alert = state.alerts.find(a => (a.id || a._id) === action.payload);
      if (alert) {
        alert.isRead = true;
      }
    },
    clearAlerts: (state) => {
      state.alerts = [];
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch budgets
      .addCase(fetchBudgets.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBudgets.fulfilled, (state, action) => {
        state.loading = false;
        // Handle nested API response structure
        if (action.payload.data && Array.isArray(action.payload.data.budgets)) {
          state.budgets = action.payload.data.budgets;
        } else if (Array.isArray(action.payload.budgets)) {
          state.budgets = action.payload.budgets;
        } else if (Array.isArray(action.payload)) {
          state.budgets = action.payload;
        } else {
          state.budgets = [];
        }
        
        // Handle stats from nested structure
        if (action.payload.data && action.payload.data.summary) {
          state.stats = action.payload.data.summary;
        } else if (action.payload.summary) {
          state.stats = action.payload.summary;
        } else if (action.payload.stats) {
          state.stats = action.payload.stats;
        }
      })
      .addCase(fetchBudgets.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create budget
      .addCase(createBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBudget.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets.push(action.payload);
      })
      .addCase(createBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update budget
      .addCase(updateBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateBudget.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.budgets.findIndex(b => b._id === action.payload._id);
        if (index !== -1) {
          state.budgets[index] = action.payload;
        }
      })
      .addCase(updateBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete budget
      .addCase(deleteBudget.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteBudget.fulfilled, (state, action) => {
        state.loading = false;
        state.budgets = state.budgets.filter(b => b._id !== action.payload);
      })
      .addCase(deleteBudget.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get budget progress
      .addCase(getBudgetProgress.pending, (state) => {
        state.progressLoading = true;
        state.error = null;
      })
      .addCase(getBudgetProgress.fulfilled, (state, action) => {
        state.progressLoading = false;
        state.progress = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(getBudgetProgress.rejected, (state, action) => {
        state.progressLoading = false;
        state.error = action.payload;
      })
      
      // Get budget alerts
      .addCase(getBudgetAlerts.pending, (state) => {
        state.alertsLoading = true;
        state.error = null;
      })
      .addCase(getBudgetAlerts.fulfilled, (state, action) => {
        state.alertsLoading = false;
        state.alerts = Array.isArray(action.payload)
          ? action.payload.map((alert) => ({ ...alert, isRead: Boolean(alert.isRead) }))
          : [];
      })
      .addCase(getBudgetAlerts.rejected, (state, action) => {
        state.alertsLoading = false;
        state.error = action.payload;
      });
  }
});

export const { 
  clearError, 
  setFilters, 
  clearFilters, 
  setLoading, 
  updateBudgetProgress,
  markAlertAsRead,
  clearAlerts
} = budgetSlice.actions;

export default budgetSlice.reducer;
