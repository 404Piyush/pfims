import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

const buildCacheKey = (params) => {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
};

const CACHE_TTL_MS = 30000;

// Async thunks for category operations
export const fetchCategories = createAsyncThunk(
  'categories/fetchCategories',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const cacheKey = buildCacheKey(params);
      const cached = getState()?.categories?.cache?.[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.payload;
      }
      const response = await api.get('/categories', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch categories');
    }
  }
);

export const createCategory = createAsyncThunk(
  'categories/createCategory',
  async (categoryData, { rejectWithValue }) => {
    try {
      const response = await api.post('/categories', categoryData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create category');
    }
  }
);

export const updateCategory = createAsyncThunk(
  'categories/updateCategory',
  async ({ id, ...categoryData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/categories/${id}`, categoryData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update category');
    }
  }
);

export const deleteCategory = createAsyncThunk(
  'categories/deleteCategory',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/categories/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete category');
    }
  }
);

export const getCategoryStats = createAsyncThunk(
  'categories/getCategoryStats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/categories/stats', { params });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch category stats');
    }
  }
);

const initialState = {
  categories: [],
  stats: {
    totalCategories: 0,
    incomeCategories: 0,
    expenseCategories: 0,
    categoryUsage: []
  },
  pagination: null,
  summary: null,
  loading: false,
  error: null,
  cache: {},
  filters: {
    type: '', // 'income' or 'expense'
    search: '',
    isActive: true
  }
};

const categorySlice = createSlice({
  name: 'categories',
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
    toggleCategoryStatus: (state, action) => {
      const category = state.categories.find(c => c._id === action.payload);
      if (category) {
        category.isActive = !category.isActive;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch categories
      .addCase(fetchCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading = false;
        const cacheKey = buildCacheKey(action.meta?.arg || {});
        state.cache[cacheKey] = { payload: action.payload, timestamp: Date.now() };

        if (action.payload?.data?.categories) {
          state.categories = action.payload.data.categories;
          state.pagination = action.payload.data.pagination || null;
          state.summary = action.payload.data.summary || null;
        } else if (action.payload?.categories) {
          state.categories = action.payload.categories;
          state.pagination = action.payload.pagination || null;
          state.summary = action.payload.summary || null;
        } else if (Array.isArray(action.payload)) {
          state.categories = action.payload;
          state.pagination = null;
          state.summary = null;
        } else {
          state.categories = [];
          state.pagination = null;
          state.summary = null;
        }
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create category
      .addCase(createCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.cache = {};
        const createdCategory = action.payload?.category || action.payload;
        if (createdCategory) {
          state.categories.push(createdCategory);
        }
      })
      .addCase(createCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update category
      .addCase(updateCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.cache = {};
        const updatedCategory = action.payload?.category || action.payload;
        const index = state.categories.findIndex(c => c._id === updatedCategory?._id);
        if (index !== -1) {
          state.categories[index] = updatedCategory;
        }
      })
      .addCase(updateCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete category
      .addCase(deleteCategory.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.loading = false;
        state.cache = {};
        state.categories = state.categories.filter(c => c._id !== action.payload);
      })
      .addCase(deleteCategory.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Get category stats
      .addCase(getCategoryStats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getCategoryStats.fulfilled, (state, action) => {
        state.loading = false;
        state.stats = action.payload;
      })
      .addCase(getCategoryStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { 
  clearError, 
  setFilters, 
  clearFilters, 
  setLoading, 
  toggleCategoryStatus 
} = categorySlice.actions;

export default categorySlice.reducer;
