import React from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { CustomCursor } from './components/CustomCursor';
import { DashboardLayout } from './components/DashboardLayout';
import { ToastRegion } from './components/ToastRegion';
import { AppProvider } from './context/AppContext';
import { AuthPages } from './pages/AuthPages';
import { ExplorePage } from './pages/ExplorePage';
import { LandingPage } from './pages/LandingPage';
import { NewsPage } from './pages/NewsPage';
import { OverviewPage } from './pages/OverviewPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StockDetailPage } from './pages/StockDetailPage';
import { TechnicalAnalysisPage } from './pages/TechnicalAnalysisPage';
import { WatchlistPage } from './pages/WatchlistPage';

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#101512] text-[#E8F0EA] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#18211C] p-8 text-center space-y-4">
        <div className="font-mono-num text-xs text-[#A5EBC3]">404</div>
        <h1 className="font-display text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-[#91A197]">
          The requested BULLSIGHT route does not exist. Return to the landing
          page or open the demo workspace.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-lg border border-white/12 bg-[#141C17] text-xs font-semibold text-[#E8F0EA]"
          >
            Home
          </Link>
          <Link
            to="/app/overview"
            className="px-4 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold"
          >
            Demo Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <AppProvider>
        <BrowserRouter>
          <CustomCursor />
          <ToastRegion />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPages mode="login" />} />
            <Route path="/register" element={<AuthPages mode="register" />} />
            <Route
              path="/forgot-password"
              element={<AuthPages mode="forgot" />}
            />

            <Route path="/app" element={<DashboardLayout />}>
              <Route index element={<Navigate to="/app/overview" replace />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route
                path="stock"
                element={<Navigate to="/app/stock/RELIANCE" replace />}
              />
              <Route path="stock/:ticker" element={<StockDetailPage />} />
              <Route path="predictions" element={<PredictionsPage />} />
              <Route path="technical" element={<TechnicalAnalysisPage />} />
              <Route path="news" element={<NewsPage />} />
              <Route path="watchlist" element={<WatchlistPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </MotionConfig>
  );
}
