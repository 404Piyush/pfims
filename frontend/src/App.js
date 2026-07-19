import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from './store/slices/authSlice';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import PublicRoute from './components/Auth/PublicRoute';
import Layout from './components/layout/Layout';
import LoadingSpinner from './components/ui/LoadingSpinner';
import Toast from './components/ui/Toast';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import { Toaster } from 'react-hot-toast';

// Auth pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyEmail from './pages/Auth/VerifyEmail';

// Main pages
import Dashboard from './pages/Dashboard/Dashboard';
import Transactions from './pages/Transactions/Transactions';
import NewTransaction from './pages/Transactions/NewTransaction';
import Categories from './pages/Categories/Categories';
import Budgets from './pages/Budgets/Budgets';
import Reports from './pages/Reports/Reports';
import Profile from './pages/Profile/Profile';
import Settings from './pages/Settings/Settings';
import Assistant from './pages/Assistant/Assistant';
import Portfolio from './pages/Portfolio/Portfolio';
import InvestmentProfileOnboarding from './pages/Onboarding/InvestmentProfileOnboarding';
import StockAnalysis from './pages/Stocks/StockAnalysis';

// Error pages
import NotFound from './pages/Error/NotFound';

function App() {
  const dispatch = useDispatch();
  const { isBootstrapping } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="App">
        <Routes>
          {/* Public routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPassword />
                </PublicRoute>
              }
            />
            <Route
              path="/verify-email"
              element={
                <PublicRoute>
                  <VerifyEmail />
                </PublicRoute>
              }
            />

            <Route
              path="/onboarding/investment-profile"
              element={
                <ProtectedRoute>
                  <InvestmentProfileOnboarding />
                </ProtectedRoute>
              }
            />

            {/* Protected routes with Layout */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="transactions/new" element={<NewTransaction />} />
              <Route path="categories" element={<Categories />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="reports" element={<Reports />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="stocks/analyse" element={<StockAnalysis />} />
              <Route
                path="mutual-funds"
                element={
                  <InvestmentProfileOnboarding
                    embedded
                    title="Mutual Funds"
                    subtitle="Answer the questionnaire to generate ranked mutual fund picks."
                    continueTo="/"
                  />
                }
              />
              <Route path="assistant" element={<Assistant />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* 404 page */}
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* Global Toast notifications */}
          <Toast />
          <Toaster position="top-right" />
        </div>
    </ErrorBoundary>
  );
}

export default App;
