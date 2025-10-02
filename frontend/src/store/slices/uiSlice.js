import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  sidebarOpen: false,
  theme: 'light',
  modals: {
    deleteConfirm: {
      isOpen: false,
      title: '',
      message: '',
      onConfirm: null,
      loading: false,
    },
    transactionForm: {
      isOpen: false,
      transaction: null,
      mode: 'create', // 'create' or 'edit'
    },
    categoryForm: {
      isOpen: false,
      category: null,
      mode: 'create',
    },
    budgetForm: {
      isOpen: false,
      budget: null,
      mode: 'create',
    },
  },
  notifications: [],
  loading: {
    global: false,
    transactions: false,
    categories: false,
    budgets: false,
    reports: false,
  },
  filters: {
    transactions: {
      dateRange: 'thisMonth',
      category: '',
      type: '',
      search: '',
      sortBy: 'date',
      sortOrder: 'desc',
    },
    budgets: {
      status: 'active',
      period: '',
      search: '',
    },
    reports: {
      period: 'thisMonth',
      type: 'overview',
    },
  },
  pagination: {
    transactions: {
      page: 1,
      limit: 20,
      total: 0,
    },
    budgets: {
      page: 1,
      limit: 10,
      total: 0,
    },
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Sidebar
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = action.payload;
    },

    // Theme
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },

    // Modals
    openModal: (state, action) => {
      const { modalName, data } = action.payload;
      if (state.modals[modalName]) {
        state.modals[modalName].isOpen = true;
        if (data) {
          Object.assign(state.modals[modalName], data);
        }
      }
    },
    closeModal: (state, action) => {
      const modalName = action.payload;
      if (state.modals[modalName]) {
        state.modals[modalName].isOpen = false;
        // Reset modal data
        if (modalName === 'deleteConfirm') {
          state.modals[modalName] = {
            ...initialState.modals.deleteConfirm,
          };
        } else if (modalName === 'transactionForm') {
          state.modals[modalName] = {
            ...initialState.modals.transactionForm,
          };
        } else if (modalName === 'categoryForm') {
          state.modals[modalName] = {
            ...initialState.modals.categoryForm,
          };
        } else if (modalName === 'budgetForm') {
          state.modals[modalName] = {
            ...initialState.modals.budgetForm,
          };
        }
      }
    },
    setModalLoading: (state, action) => {
      const { modalName, loading } = action.payload;
      if (state.modals[modalName]) {
        state.modals[modalName].loading = loading;
      }
    },

    // Notifications
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        type: 'info',
        title: '',
        message: '',
        duration: 5000,
        ...action.payload,
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },

    // Loading states
    setLoading: (state, action) => {
      const { key, loading } = action.payload;
      if (state.loading.hasOwnProperty(key)) {
        state.loading[key] = loading;
      }
    },
    setGlobalLoading: (state, action) => {
      state.loading.global = action.payload;
    },

    // Filters
    setFilter: (state, action) => {
      const { section, key, value } = action.payload;
      if (state.filters[section] && state.filters[section].hasOwnProperty(key)) {
        state.filters[section][key] = value;
      }
    },
    resetFilters: (state, action) => {
      const section = action.payload;
      if (state.filters[section]) {
        state.filters[section] = initialState.filters[section];
      }
    },
    setFilters: (state, action) => {
      const { section, filters } = action.payload;
      if (state.filters[section]) {
        state.filters[section] = { ...state.filters[section], ...filters };
      }
    },

    // Pagination
    setPagination: (state, action) => {
      const { section, pagination } = action.payload;
      if (state.pagination[section]) {
        state.pagination[section] = { ...state.pagination[section], ...pagination };
      }
    },
    resetPagination: (state, action) => {
      const section = action.payload;
      if (state.pagination[section]) {
        state.pagination[section] = {
          ...initialState.pagination[section],
        };
      }
    },

    // Bulk actions
    resetUI: (state) => {
      return initialState;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  toggleTheme,
  openModal,
  closeModal,
  setModalLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  setLoading,
  setGlobalLoading,
  setFilter,
  resetFilters,
  setFilters,
  setPagination,
  resetPagination,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;