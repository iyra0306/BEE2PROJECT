import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Lock,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemoDataBadge } from '../components/DemoDataBadge';
import { FeedStatusBadge } from '../components/FeedStatusBadge';
import { useAppContext } from '../context/AppContext';
import { ChartRange, MarketRegion } from '../types/market';
import { formatSignedPercent } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const {
    user,
    accountService,
    logoutUser,
    preferences,
    updatePreferences,
    resetPreferences,
    fxUsdToInr,
    dataMode,
    setDataMode,
    hasRealSource,
    providerMeta,
    bhavcopyStats,
    importBhavcopyFiles,
    clearBhavcopyData,
  } = useAppContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    warnings?: string[];
  } | null>(null);

  const fxLabel = fxUsdToInr
    ? `FX 1 USD = ₹${fxUsdToInr.toFixed(2)}`
    : 'Native fallback until FX feed connected';

  const gfdlConnected = Boolean(providerMeta?.providers.gfdl.configured);
  const twelveDataConnected = Boolean(providerMeta?.providers.twelveData.configured);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImporting(true);
    setImportFeedback(null);
    try {
      const summary = await importBhavcopyFiles(files);
      setImportFeedback({
        type: 'success',
        message: `Imported ${summary.rowsImported.toLocaleString()} NSE equity rows across ${summary.datesAdded.length} trading date(s) (${summary.formatDetected}). ${summary.symbolsUpdated.toLocaleString()} symbols updated.`,
        warnings: summary.warnings,
      });
    } catch (err) {
      setImportFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Unable to parse Bhavcopy CSV file.',
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleClearBhavcopy = async () => {
    setImportFeedback(null);
    await clearBhavcopyData();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-[#91A197]">
            Market Data Sources, Local Bhavcopy Import &amp; Display Preferences
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#E8F0EA] mt-1">
            Settings
          </h1>
        </div>

        <button
          type="button"
          onClick={resetPreferences}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-[#18211C] text-xs text-[#91A197] hover:text-[#E8F0EA] transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset Local Defaults
        </button>
      </div>

      {/* Data Source Mode */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#36C982]" aria-hidden="true" />
              <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
                Market Data Mode
              </h2>
              {dataMode === 'demo' && <DemoDataBadge compact />}
            </div>
            <p className="text-xs text-[#91A197] mt-1">
              Demo mode renders full simulated equity fixtures with zero credentials. Real data mode uses optional server Secrets and locally imported NSE Bhavcopy EOD files with zero demo leakage.
            </p>
          </div>
          <span className="text-xs font-mono-num text-[#A5EBC3]">
            Active: {dataMode === 'demo' ? 'Demo data' : 'Real data'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              {
                id: 'auto',
                label: 'Automatic',
                desc: hasRealSource
                  ? 'Real source detected (switching to Real)'
                  : 'No real source active (defaults to Demo)',
              },
              {
                id: 'demo',
                label: 'Demo Mode',
                desc: 'Full India + US fixtures, charts, news & illustrative AI forecasts',
              },
              {
                id: 'real',
                label: 'Real Data Mode',
                desc: 'Twelve Data US watchlist + Bhavcopy EOD + optional GFDL',
              },
            ] as const
          ).map((opt) => {
            const active = preferences.dataModePreference === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDataMode(opt.id)}
                className={`text-left rounded-xl border p-3.5 transition-colors ${
                  active
                    ? 'border-[#36C982] bg-[#214B37]/40'
                    : 'border-white/8 bg-[#141C17] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#E8F0EA]">
                    {opt.label}
                  </span>
                  {active && (
                    <span className="w-2 h-2 rounded-full bg-[#36C982]" />
                  )}
                </div>
                <p className="text-[11px] text-[#91A197] mt-1 leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3.5 flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-[#E8F0EA]">
                Twelve Data (US Watchlist)
              </div>
              <p className="text-[11px] text-[#91A197] mt-0.5 leading-relaxed">
                {twelveDataConnected
                  ? 'Configured via server TWELVE_DATA_API_KEY. Cached 90s to respect Basic 8 credits/min limit for prioritized watchlist US stocks.'
                  : 'Optional server secret TWELVE_DATA_API_KEY is unset.'}
              </p>
            </div>
            <FeedStatusBadge
              status={twelveDataConnected ? 'Delayed' : 'Unavailable'}
              provider="Twelve Data"
            />
          </div>

          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3.5 flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-[#E8F0EA]">
                Global Datafeeds (NSE / BSE)
              </div>
              <p className="text-[11px] text-[#91A197] mt-0.5 leading-relaxed">
                {gfdlConnected
                  ? 'Configured via server GFDL_API_KEY.'
                  : bhavcopyStats.totalRows > 0
                  ? `GFDL optional & unset. Using imported NSE CM-UDiFF Bhavcopy EOD (${bhavcopyStats.latestDate}).`
                  : 'Optional server secret GFDL_API_KEY is unset. Import NSE Bhavcopy CSV below for EOD data.'}
              </p>
            </div>
            <FeedStatusBadge
              status={
                gfdlConnected
                  ? 'Live'
                  : bhavcopyStats.totalRows > 0
                  ? 'End of day'
                  : 'Unavailable'
              }
              provider={
                gfdlConnected
                  ? 'GFDL'
                  : bhavcopyStats.totalRows > 0
                  ? 'Bhavcopy CSV'
                  : 'GFDL'
              }
            />
          </div>
        </div>
      </section>

      {/* Local NSE CM-UDiFF Bhavcopy CSV Import */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet
                className="w-4 h-4 text-[#A5EBC3]"
                aria-hidden="true"
              />
              <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
                NSE CM-UDiFF Bhavcopy CSV Import
              </h2>
              <span className="inline-flex items-center rounded border border-[#36C982]/35 bg-[#214B37]/40 px-2 py-0.5 text-[10px] font-mono-num font-semibold text-[#A5EBC3]">
                End of day
              </span>
            </div>
            <p className="text-xs text-[#91A197] mt-1 max-w-2xl leading-relaxed">
              Import one or multiple daily official NSE CM-UDiFF Bhavcopy CSV files (
              <span className="font-mono-num text-[#E8F0EA]">
                TradDt, TckrSymb, SctySrs, OpnPric, HghPric, LwPric, ClsPric, PrvsClsgPric, TtlTradgVol
              </span>
              ). Multi-date imports merge chronologically in browser IndexedDB to power Real data mode EOD closes and candlestick history.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="bhavcopy-csv-upload"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#36C982] text-[#101512] text-xs font-semibold hover:bg-[#A5EBC3] transition-colors disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              {importing ? 'Importing CSV...' : 'Import Bhavcopy CSV(s)'}
            </button>
            {bhavcopyStats.totalRows > 0 && (
              <button
                type="button"
                onClick={handleClearBhavcopy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-[#141C17] text-xs text-[#91A197] hover:text-[#E06C65] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                Clear Imported
              </button>
            )}
          </div>
        </div>

        {importFeedback && (
          <div
            className={`rounded-lg border px-4 py-3 text-xs flex items-start gap-2.5 ${
              importFeedback.type === 'success'
                ? 'border-[#36C982]/40 bg-[#214B37]/30 text-[#A5EBC3]'
                : 'border-[#E06C65]/40 bg-[#E06C65]/10 text-[#E06C65]'
            }`}
          >
            {importFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div className="space-y-1">
              <p className="font-medium">{importFeedback.message}</p>
              {importFeedback.warnings && importFeedback.warnings.length > 0 && (
                <p className="text-[11px] text-[#D4A857]">
                  {importFeedback.warnings.join(' · ')}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-num">
          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3">
            <span className="text-[#91A197] block">NSE Symbols</span>
            <span className="text-base font-bold text-[#E8F0EA] mt-0.5 block">
              {bhavcopyStats.totalSymbols.toLocaleString()}
            </span>
          </div>
          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3">
            <span className="text-[#91A197] block">Trading Dates</span>
            <span className="text-base font-bold text-[#E8F0EA] mt-0.5 block">
              {bhavcopyStats.dates.length}
            </span>
          </div>
          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3">
            <span className="text-[#91A197] block">Earliest Date</span>
            <span className="text-sm font-bold text-[#E8F0EA] mt-0.5 block">
              {bhavcopyStats.earliestDate ?? '—'}
            </span>
          </div>
          <div className="rounded-lg border border-white/8 bg-[#141C17] p-3">
            <span className="text-[#91A197] block">Latest Trade Date</span>
            <span className="text-sm font-bold text-[#A5EBC3] mt-0.5 block">
              {bhavcopyStats.latestDate ?? '—'}
            </span>
          </div>
        </div>

        {bhavcopyStats.sampleCloses.length > 0 ? (
          <div className="rounded-lg border border-white/8 bg-[#141C17] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between text-xs">
              <span className="font-medium text-[#E8F0EA]">
                Latest Imported Closes (End of day)
              </span>
              <span className="font-mono-num text-[#91A197]">
                {bhavcopyStats.totalRows.toLocaleString()} OHLCV bars stored locally
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left border-collapse text-xs font-mono-num">
                <thead>
                  <tr className="border-b border-white/8 text-[#91A197]">
                    <th className="px-4 py-2 font-medium">Ticker</th>
                    <th className="px-4 py-2 font-medium">Trade Date</th>
                    <th className="px-4 py-2 font-medium text-right">EOD Close</th>
                    <th className="px-4 py-2 font-medium text-right">Daily %</th>
                    <th className="px-4 py-2 font-medium text-right">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {bhavcopyStats.sampleCloses.map((item) => (
                    <tr key={item.symbol}>
                      <td className="px-4 py-2 text-[#E8F0EA] font-semibold">
                        NSE:{item.symbol}
                      </td>
                      <td className="px-4 py-2 text-[#91A197]">{item.date}</td>
                      <td className="px-4 py-2 text-right text-[#E8F0EA]">
                        ₹{item.close.toFixed(2)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right ${
                          (item.changePercent ?? 0) >= 0
                            ? 'text-[#36C982]'
                            : 'text-[#E06C65]'
                        }`}
                      >
                        {item.changePercent !== null
                          ? formatSignedPercent(item.changePercent)
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right text-[#A5EBC3]">
                        End of day
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/12 bg-[#141C17]/60 px-4 py-4 text-xs text-[#91A197]">
            No Bhavcopy CSV files imported yet. Select one or more NSE CM-UDiFF CSV files above to populate Indian equity closes and historical daily candles in Real data mode.
          </div>
        )}
      </section>

      {/* Account & Watchlist Sync */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
            Account &amp; Watchlist Sync
          </h2>
          {user ? (
            <span className="inline-flex items-center gap-1 text-xs text-[#36C982]">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              Signed In · MongoDB Sync Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-[#91A197]">
              <Lock className="w-3.5 h-3.5 text-[#D4A857]" aria-hidden="true" />
              {accountService?.ready
                ? 'Guest Mode · Sign in to sync'
                : 'Account Service Unconfigured'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-[#91A197] block">Account</span>
            <div className="mt-1 px-3 py-2 rounded-lg border border-white/8 bg-[#141C17] text-[#E8F0EA]">
              {user ? `${user.name} (${user.email})` : 'Guest Analyst'}
            </div>
          </div>
          <div>
            <span className="text-xs text-[#91A197] block">
              Watchlist Persistence
            </span>
            <div className="mt-1 px-3 py-2 rounded-lg border border-white/8 bg-[#141C17] text-[#91A197]">
              {user
                ? 'MongoDB Account Document (HttpOnly JWT Session)'
                : 'Browser localStorage (Guest Mode)'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-[#91A197]">
            {accountService?.message ??
              'Configure MONGODB_URI and JWT_SECRET on the server to enable account sync.'}
          </p>
          {user ? (
            <button
              type="button"
              onClick={() => void logoutUser()}
              className="px-3.5 py-1.5 rounded-lg border border-white/12 bg-[#141C17] text-xs font-medium text-[#E06C65] hover:border-[#E06C65]/40 transition-colors"
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/login"
              className="px-3.5 py-1.5 rounded-lg bg-[#214B37] text-xs font-medium text-[#A5EBC3] hover:bg-[#36C982] hover:text-[#101512] transition-colors"
            >
              Sign In / Register
            </Link>
          )}
        </div>
      </section>

      {/* Appearance & Currency */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
            Appearance, Market &amp; Currency
          </h2>
          <p className="text-xs text-[#91A197] mt-0.5">
            Persisted automatically in browser localStorage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="pref-theme"
              className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
            >
              Theme Mode
            </label>
            <select
              id="pref-theme"
              value="dark"
              onChange={() => updatePreferences({ theme: 'dark' })}
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA]"
            >
              <option value="dark">Dark Emerald (Active)</option>
              <option value="light" disabled>
                Light Mode (Tokens structured · Future release)
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-market"
              className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
            >
              Default Market Scope
            </label>
            <select
              id="pref-market"
              value={preferences.defaultMarket}
              onChange={(e) =>
                updatePreferences({
                  defaultMarket: e.target.value as 'All' | MarketRegion,
                })
              }
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA]"
            >
              <option value="All">All Markets (India &amp; US)</option>
              <option value="India">India (NSE / BSE)</option>
              <option value="US">United States (NASDAQ / NYSE)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-currency"
              className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
            >
              Currency Display
            </label>
            <select
              id="pref-currency"
              value={preferences.currencyMode}
              onChange={(e) =>
                updatePreferences({
                  currencyMode: e.target.value as 'Native' | 'USD' | 'INR',
                })
              }
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA]"
            >
              <option value="Native">Native (INR for India / USD for US)</option>
              <option value="INR">Convert All to INR ({fxLabel})</option>
              <option value="USD">Convert All to USD ({fxLabel})</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/8 bg-[#141C17] px-3.5 py-2.5">
            <div>
              <div className="text-xs font-medium text-[#E8F0EA]">
                Compact Screener Rows
              </div>
              <div className="text-[11px] text-[#91A197]">
                Tighter vertical spacing in stock tables
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="Compact screener rows"
              checked={preferences.compactTables}
              onChange={(e) =>
                updatePreferences({ compactTables: e.target.checked })
              }
              className="w-4 h-4 accent-[#36C982]"
            />
          </div>
        </div>
      </section>

      {/* Chart Preferences */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-5">
        <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
          Chart Preferences
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="pref-chart-type"
              className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
            >
              Default Chart Style
            </label>
            <select
              id="pref-chart-type"
              value={preferences.defaultChartType}
              onChange={(e) =>
                updatePreferences({
                  defaultChartType: e.target.value as 'candlestick' | 'line',
                })
              }
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA]"
            >
              <option value="candlestick">Candlestick</option>
              <option value="line">Area / Line</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="pref-range"
              className="block text-xs font-medium text-[#E8F0EA] mb-1.5"
            >
              Default Timeframe
            </label>
            <select
              id="pref-range"
              value={preferences.defaultRange}
              onChange={(e) =>
                updatePreferences({
                  defaultRange: e.target.value as ChartRange,
                })
              }
              className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#141C17] text-sm text-[#E8F0EA]"
            >
              {(['1D', '1W', '1M', '3M', '6M', '1Y', '5Y', 'MAX'] as const).map(
                (r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/8 bg-[#141C17] px-3.5 py-2.5">
            <div>
              <div className="text-xs font-medium text-[#E8F0EA]">
                Volume Histogram
              </div>
              <div className="text-[11px] text-[#91A197]">Show by default</div>
            </div>
            <input
              type="checkbox"
              aria-label="Show volume histogram by default"
              checked={preferences.showVolumeByDefault}
              onChange={(e) =>
                updatePreferences({ showVolumeByDefault: e.target.checked })
              }
              className="w-4 h-4 accent-[#36C982]"
            />
          </div>
        </div>
      </section>

      {/* Notifications & Security */}
      <section className="rounded-xl border border-white/8 bg-[#18211C] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-[#E8F0EA]">
            Notifications &amp; Account Security
          </h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-[#91A197]">
            {accountService?.ready ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-[#36C982]" aria-hidden="true" />
                HttpOnly JWT Sessions Active
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-[#D4A857]" aria-hidden="true" />
                Account Service Unconfigured
              </>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border border-white/8 bg-[#141C17] px-3.5 py-3">
            <div>
              <div className="text-xs font-medium text-[#E8F0EA]">
                In-App Price Alert Preview
              </div>
              <div className="text-[11px] text-[#91A197]">
                Local preference persisted in browser
              </div>
            </div>
            <input
              type="checkbox"
              aria-label="In-app price alert preview"
              checked={preferences.priceAlertsEnabled}
              onChange={(e) =>
                updatePreferences({ priceAlertsEnabled: e.target.checked })
              }
              className="w-4 h-4 accent-[#36C982]"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-white/8 bg-[#141C17] px-3.5 py-3 opacity-80">
            <div>
              <div className="text-xs font-medium text-[#E8F0EA]">
                Two-Factor Auth &amp; Server Push
              </div>
              <div className="text-[11px] text-[#91A197]">
                Email &amp; MFA delivery not enabled in this workspace
              </div>
            </div>
            <span className="text-[11px] font-mono-num text-[#91A197]">
              Unavailable
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
