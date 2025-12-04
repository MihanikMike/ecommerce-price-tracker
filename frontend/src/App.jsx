import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/layout';
import { ErrorBoundary, PageLoader } from './components/common';

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Tracked = lazy(() => import('./pages/Tracked'));
const PriceDrops = lazy(() => import('./pages/PriceDrops'));
const Compare = lazy(() => import('./pages/Compare'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={
                    <Suspense fallback={<PageLoader />}>
                      <Dashboard />
                    </Suspense>
                  } />
                  <Route path="products" element={
                    <Suspense fallback={<PageLoader />}>
                      <Products />
                    </Suspense>
                  } />
                  <Route path="products/:id" element={
                    <Suspense fallback={<PageLoader />}>
                      <ProductDetail />
                    </Suspense>
                  } />
                  <Route path="tracked" element={
                    <Suspense fallback={<PageLoader />}>
                      <Tracked />
                    </Suspense>
                  } />
                  <Route path="price-drops" element={
                    <Suspense fallback={<PageLoader />}>
                      <PriceDrops />
                    </Suspense>
                  } />
                  <Route path="compare" element={
                    <Suspense fallback={<PageLoader />}>
                      <Compare />
                    </Suspense>
                  } />
                  <Route path="alerts" element={
                    <Suspense fallback={<PageLoader />}>
                      <Alerts />
                    </Suspense>
                  } />
                  <Route path="settings" element={
                    <Suspense fallback={<PageLoader />}>
                      <Settings />
                    </Suspense>
                  } />
                </Route>
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

