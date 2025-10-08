import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import transactionSlice from './slices/transactionSlice';
import categorySlice from './slices/categorySlice';
import budgetSlice from './slices/budgetSlice';
import uiSlice from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    transactions: transactionSlice,
    categories: categorySlice,
    budgets: budgetSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        // Ignore these field paths in all actions
        ignoredActionsPaths: [
          'meta.arg', 
          'payload.timestamp',
          'error.stack',
          'error.config',
          'error.request',
          'error.response'
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'items.dates',
          'auth.error',
          'transactions.error',
          'categories.error',
          'budgets.error',
          'ui.error'
        ],
        // Custom function to check if a value is serializable
        isSerializable: (value) => {
          // Allow Error objects to pass through
          if (value instanceof Error) {
            return true;
          }
          // Use default serialization check for other values
          return true;
        },
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;