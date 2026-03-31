import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { InlineSpinner } from '../../components/UI/LoadingSpinner';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : null;
};

const formatMoneyInr = (val) => {
  const num = toNumber(val);
  if (num === null) return 'n/a';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
  } catch (e) {
    return `₹${num.toFixed(2)}`;
  }
};

const formatInt = (val) => {
  const num = toNumber(val);
  if (num === null) return 'n/a';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(num);
};

const formatShortDate = (val) => {
  const s = String(val || '');
  if (!s) return '';
  return s.slice(5);
};

const badgeClasses = (signal) => {
  const s = String(signal || '').toUpperCase();
  if (s === 'BUY') return 'bg-success-100 text-success-800 border-success-200';
  if (s === 'SELL') return 'bg-danger-100 text-danger-800 border-danger-200';
  return 'bg-warning-100 text-warning-800 border-warning-200';
};

const noteClasses = (signal) => {
  const s = String(signal || '').toUpperCase();
  if (s === 'BUY') return 'bg-success-50 text-success-900 border-success-200';
  if (s === 'SELL') return 'bg-danger-50 text-danger-900 border-danger-200';
  return 'bg-warning-50 text-warning-900 border-warning-200';
};

const barColor = (signal) => {
  const s = String(signal || '').toUpperCase();
  if (s === 'BUY') return 'bg-success-500';
  if (s === 'SELL') return 'bg-danger-500';
  return 'bg-warning-500';
};

const ScoreBar = ({ score, maxAbs, signal }) => {
  const abs = Math.abs(toNumber(score) || 0);
  const pct = maxAbs > 0 ? Math.min(100, Math.round((abs / maxAbs) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-secondary-100 overflow-hidden">
      <div className={`h-2 ${barColor(signal)}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const StockAnalysis = () => {
  const [query, setQuery] = useState('');
  const [ticker, setTicker] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const searchAbortRef = useRef(null);

  const recommendation = String(result?.recommendation || '').toUpperCase();

  const indicators = useMemo(() => result?.indicators || {}, [result]);
  const chartData = useMemo(() => {
    const history = Array.isArray(result?.history) ? result.history : [];
    return history
      .filter((r) => r && r.date && toNumber(r.close) !== null)
      .map((r) => ({
        date: r.date,
        close: toNumber(r.close),
        sma20: toNumber(r.sma20),
        sma50: toNumber(r.sma50),
        sma200: toNumber(r.sma200),
      }));
  }, [result]);
  const breakdown = useMemo(() => {
    const rsi = indicators?.rsi || {};
    const movingAverages = indicators?.movingAverages || {};
    const macd = indicators?.macd || {};
    const volume = indicators?.volume || {};
    return [
      { key: 'RSI (14)', signal: rsi.signal, score: rsi.score, details: `${rsi.value ?? 'n/a'}` , maxAbs: 2.5 },
      {
        key: 'Moving Averages',
        signal: movingAverages.signal,
        score: movingAverages.score,
        details: `SMA20 ${formatMoneyInr(movingAverages.sma20)} · SMA50 ${formatMoneyInr(movingAverages.sma50)} · SMA200 ${formatMoneyInr(movingAverages.sma200)}`,
        maxAbs: 3.5,
      },
      {
        key: 'MACD',
        signal: macd.signal,
        score: macd.score,
        details: `MACD ${macd.macdLine ?? 'n/a'} · Signal ${macd.signalLine ?? 'n/a'}`,
        maxAbs: 2.5,
      },
      {
        key: 'Volume (20D)',
        signal: volume.signal,
        score: volume.score,
        details: `${volume.changePercent ?? 'n/a'}% vs avg`,
        maxAbs: 1.5,
      },
    ];
  }, [indicators]);

  useEffect(() => {
    const q = String(query || '').trim();
    setError('');
    setResult(null);

    if (searchAbortRef.current) {
      searchAbortRef.current.cancelled = true;
    }

    if (q.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setTicker(q.toUpperCase());
      setSearching(false);
      return undefined;
    }

    const req = { cancelled: false };
    searchAbortRef.current = req;
    setSearching(true);

    const t = setTimeout(async () => {
      try {
        const resp = await api.get('/analyse/search', { params: { q } });
        if (req.cancelled) return;
        const results = resp?.data?.data?.results || [];
        setSearchResults(Array.isArray(results) ? results : []);
        setShowResults(true);
      } catch (e) {
        if (req.cancelled) return;
        setSearchResults([]);
        setShowResults(false);
      } finally {
        if (!req.cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      req.cancelled = true;
    };
  }, [query]);

  const onAnalyse = async () => {
    const trimmedTicker = String(ticker || '').trim();
    if (!trimmedTicker) {
      setError('Enter a stock name or ticker (e.g. MAZDOCK.NS)');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const resp = await api.post('/analyse', { ticker: trimmedTicker });
      setResult(resp.data);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.details || e?.message || 'Failed to analyse ticker';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <h1 className="text-xl font-semibold text-secondary-900">Stock Technical Analysis</h1>
        <p className="text-sm text-secondary-600 mt-1">
          RSI · Moving Averages · MACD · Volume → weighted BUY / SELL / HOLD
        </p>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setTicker(String(e.target.value || '').trim().toUpperCase());
              }}
              onFocus={() => {
                if (searchResults.length) setShowResults(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowResults(false), 150);
              }}
              className="input w-full"
              placeholder="Search stock name or enter ticker (e.g. MAZDOCK.NS)"
              autoComplete="off"
            />

            {showResults && (searching || searchResults.length > 0) ? (
              <div className="absolute z-20 mt-2 w-full bg-white border border-secondary-200 rounded-lg shadow-lg overflow-hidden">
                {searching ? (
                  <div className="px-3 py-2 text-sm text-secondary-600 flex items-center">
                    <InlineSpinner size="sm" className="mr-2" />
                    Searching...
                  </div>
                ) : null}

                {searchResults.slice(0, 8).map((r) => (
                  <button
                    key={`${r.ticker}-${r.exchange || ''}`}
                    type="button"
                    onClick={() => {
                      setTicker(String(r.ticker || '').toUpperCase());
                      setQuery(`${r.name} (${String(r.ticker || '').toUpperCase()})`);
                      setShowResults(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-secondary-50 transition-colors"
                  >
                    <div className="text-sm font-medium text-secondary-900">{r.name}</div>
                    <div className="text-xs text-secondary-600">
                      {String(r.ticker || '').toUpperCase()}
                      {r.exchange ? ` · ${r.exchange}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onAnalyse}
            disabled={loading}
            className="btn-primary flex items-center justify-center px-6"
          >
            {loading ? (
              <>
                <InlineSpinner size="sm" color="white" className="mr-2" />
                Analysing...
              </>
            ) : (
              'Analyse'
            )}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-danger-50 border border-danger-200 p-4 text-sm text-danger-800">
            {error}
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <div className={`mb-4 rounded-lg border p-4 text-sm ${noteClasses(recommendation)}`}>
            Note: Recommendation is <span className="font-semibold">{recommendation || 'HOLD'}</span>.
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="text-sm text-secondary-500">Stock Name</div>
              <div className="text-lg font-semibold text-secondary-900">{result.name || '—'}</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-sm text-secondary-500">Ticker</div>
                  <div className="font-medium text-secondary-900">{result.ticker || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-secondary-500">Current Price</div>
                  <div className="font-medium text-secondary-900">{formatMoneyInr(result.currentPrice)}</div>
                </div>
                <div>
                  <div className="text-sm text-secondary-500">Total Score</div>
                  <div className="font-medium text-secondary-900">{result.totalScore ?? '—'}</div>
                </div>
              </div>
            </div>

            <div className="min-w-[220px]">
              <div className="text-sm text-secondary-500">Recommendation</div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${badgeClasses(recommendation)}`}>
                  {recommendation || 'HOLD'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-sm text-secondary-500">Reason Summary</div>
            <div className="mt-1 text-sm text-secondary-800">{result.reasonSummary || '—'}</div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold text-secondary-900 mb-3">Indicator Breakdown</div>
            <div className="space-y-3">
              {breakdown.map((row) => (
                <div key={row.key} className="border border-secondary-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="font-medium text-secondary-900">{row.key}</div>
                      <div className="text-xs text-secondary-600 mt-0.5">{row.details}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${badgeClasses(row.signal)}`}>
                        {String(row.signal || 'HOLD').toUpperCase()}
                      </span>
                      <div className="text-sm font-semibold text-secondary-900">
                        {row.score ?? 0}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ScoreBar score={row.score} maxAbs={row.maxAbs} signal={row.signal} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-secondary-200 rounded-lg p-4">
              <div className="font-medium text-secondary-900">MACD</div>
              <div className="text-sm text-secondary-700 mt-2">
                MACD {indicators?.macd?.macdLine ?? '—'} · Signal {indicators?.macd?.signalLine ?? '—'} · Histogram {indicators?.macd?.histogram ?? '—'}
              </div>
            </div>
            <div className="border border-secondary-200 rounded-lg p-4">
              <div className="font-medium text-secondary-900">Volume</div>
              <div className="text-sm text-secondary-700 mt-2">
                Today {formatInt(indicators?.volume?.todayVolume)} · Avg 20D {formatInt(indicators?.volume?.avgVolume)} · {indicators?.volume?.changePercent ?? '—'}% vs avg
              </div>
            </div>
          </div>

          {chartData.length ? (
            <div className="mt-6 border border-secondary-200 rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="font-medium text-secondary-900">Price & Moving Averages (200D)</div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-700">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#2563eb' }} />
                    Close
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#16a34a' }} />
                    SMA20
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                    SMA50
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                    SMA200
                  </div>
                </div>
              </div>
              <div className="mt-3" style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      minTickGap={24}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickFormatter={(v) => {
                        const n = toNumber(v);
                        if (n === null) return '';
                        return `₹${Math.round(n)}`;
                      }}
                      tick={{ fontSize: 12 }}
                      width={56}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = toNumber(value);
                        const label =
                          name === 'close'
                            ? 'Close'
                            : name === 'sma20'
                              ? 'SMA20'
                              : name === 'sma50'
                                ? 'SMA50'
                                : name === 'sma200'
                                  ? 'SMA200'
                                  : String(name);
                        return [n === null ? 'n/a' : formatMoneyInr(n), label];
                      }}
                      labelFormatter={(label) => `Date ${label}`}
                    />
                    <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sma20" stroke="#16a34a" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
                    <Line type="monotone" dataKey="sma200" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default StockAnalysis;
