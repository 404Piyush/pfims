import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../services/api';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import BrutalistScreen from '../../components/layout/BrutalistScreen';

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

const formatCompactInr = (val) => {
  const num = toNumber(val);
  if (num === null) return 'n/a';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs < 1000) return `${sign}₹${Math.round(abs)}`;
  if (abs < 100000) return `${sign}₹${(abs / 1000).toFixed(abs < 10000 ? 1 : 0)}k`;
  if (abs < 10000000) return `${sign}₹${(abs / 100000).toFixed(abs < 1000000 ? 1 : 0)}L`;
  return `${sign}₹${(abs / 10000000).toFixed(abs < 100000000 ? 1 : 0)}Cr`;
};

const parseCandleTimestampMs = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val > 1e12 ? val : val * 1000;
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n > 1e12 ? n : n * 1000;
  }
  const d = new Date(s);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
};

const Portfolio = () => {
  const [status, setStatus] = useState({ connected: false, updatedAt: null, accounts: [], defaultAccountId: null });
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [label, setLabel] = useState('Primary');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [portfolio, setPortfolio] = useState(null);
  const [aggregate, setAggregate] = useState(null);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [editingKeys, setEditingKeys] = useState(true);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [historyCandles, setHistoryCandles] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const autoRefreshTimerRef = useRef(null);
  const portfolioFetchInFlightRef = useRef(false);

  const holdings = useMemo(() => portfolio?.holdings?.payload?.holdings || [], [portfolio]);
  const profile = useMemo(() => portfolio?.profile?.payload || null, [portfolio]);
  const margins = useMemo(() => portfolio?.margins?.payload || null, [portfolio]);
  const positionsCash = useMemo(() => portfolio?.positions?.CASH?.payload?.positions || [], [portfolio]);
  const positionsFno = useMemo(() => portfolio?.positions?.FNO?.payload?.positions || [], [portfolio]);
  const aggregateTotals = useMemo(() => aggregate?.totals || null, [aggregate]);
  const aggregateAccounts = useMemo(() => aggregate?.accounts || [], [aggregate]);
  const combinedHoldings = useMemo(() => {
    const map = new Map();
    for (const row of aggregateAccounts) {
      if (!row?.ok) continue;
      const holdingsArr = row?.data?.holdings?.payload?.holdings || [];
      for (const h of holdingsArr) {
        const symbol = h?.trading_symbol || h?.isin || '—';
        const key = String(symbol);
        const qty = toNumber(h?.quantity) || 0;
        const avg = toNumber(h?.average_price) || 0;
        const invested = qty * avg;
        const existing = map.get(key) || { symbol, qty: 0, invested: 0, isin: h?.isin || '' };
        existing.qty += qty;
        existing.invested += invested;
        if (!existing.isin && h?.isin) existing.isin = h.isin;
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.invested - a.invested);
  }, [aggregateAccounts]);

  const totals = useMemo(() => {
    let invested = 0;
    let marketValue = 0;
    let pnl = 0;
    for (const h of holdings) {
      const qty = toNumber(h?.quantity);
      const avg = toNumber(h?.average_price);
      if (qty === null || avg === null) continue;
      const investedRow = qty * avg;
      invested += investedRow;

      const ltp = toNumber(
        h?.last_price ??
          h?.ltp ??
          h?.last_traded_price ??
          h?.current_price ??
          h?.price ??
          h?.close
      );
      const marketValueRow = ltp !== null ? qty * ltp : null;
      if (marketValueRow !== null) {
        marketValue += marketValueRow;
        const pnlFromApi = toNumber(h?.pnl ?? h?.pnl_amount ?? h?.unrealised_pnl ?? h?.unrealized_pnl);
        pnl += pnlFromApi !== null ? pnlFromApi : (marketValueRow - investedRow);
      }
    }
    return { invested, marketValue, pnl };
  }, [holdings]);

  const holdingAllocation = useMemo(() => {
    const rows = holdings
      .map((h) => {
        const qty = toNumber(h?.quantity) || 0;
        const avg = toNumber(h?.average_price) || 0;
        const invested = qty * avg;
        return {
          name: h?.trading_symbol || h?.isin || '—',
          invested,
        };
      })
      .filter((r) => r.invested > 0)
      .sort((a, b) => b.invested - a.invested);

    const top = rows.slice(0, 8);
    const rest = rows.slice(8);
    const others = rest.reduce((sum, r) => sum + r.invested, 0);
    const data = others > 0 ? [...top, { name: 'Others', invested: others }] : top;
    return { data, topRows: rows.slice(0, 10) };
  }, [holdings]);

  const chartColors = ['#2563eb', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#0ea5e9', '#64748b'];
  const historySeries = useMemo(() => {
    const candles = Array.isArray(historyCandles) ? historyCandles : [];
    const rows = candles
      .map((c) => {
        if (!Array.isArray(c) || c.length < 5) return null;
        const tsMs = parseCandleTimestampMs(c[0]);
        const close = toNumber(c[4]);
        if (tsMs === null || close === null) return null;
        return {
          ts: tsMs,
          label: new Date(tsMs).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
          close,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);
    return rows;
  }, [historyCandles]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    setError(null);
    try {
      const res = await api.get('/users/integrations/groww');
      const integration = res.data?.integration;
      const accounts = Array.isArray(integration?.accounts) ? integration.accounts : [];
      const connected = Boolean(integration?.connected);
      const defaultAccountId = integration?.defaultAccountId || accounts[0]?.id || null;
      setStatus({
        connected,
        updatedAt: integration?.updatedAt || null,
        accounts,
        defaultAccountId,
      });
      setSelectedAccountId((prev) => {
        if (!connected) return '__new__';
        if (prev === '__all__' && accounts.length > 1) return '__all__';
        if (prev && accounts.some((a) => String(a?.id) === String(prev))) return prev;
        return defaultAccountId || (accounts[0]?.id || '');
      });
      setEditingKeys(!connected);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load integration status');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const saveKeys = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), label: label.trim() || 'Primary' };
      if (selectedAccountId && selectedAccountId !== '__new__') body.accountId = selectedAccountId;
      const res = await api.put('/users/integrations/groww', body);
      setApiKey('');
      setApiSecret('');
      setLabel('Primary');
      await loadStatus();
      const nextId = res.data?.accountId;
      if (nextId) setSelectedAccountId(nextId);
      setEditingKeys(false);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save API keys');
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async ({ all } = { all: false }) => {
    setDisconnecting(true);
    setError(null);
    try {
      const params =
        all || !selectedAccountId || selectedAccountId === '__new__' ? undefined : { accountId: selectedAccountId };
      await api.delete('/users/integrations/groww', params ? { params } : undefined);
      setPortfolio(null);
      setAggregate(null);
      await loadStatus();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const refreshPortfolio = useCallback(async () => {
    if (!selectedAccountId || selectedAccountId === '__new__') return;
    if (portfolioFetchInFlightRef.current) return;
    portfolioFetchInFlightRef.current = true;
    setLoadingPortfolio(true);
    setError(null);
    try {
      if (selectedAccountId === '__all__') {
        const res = await api.get('/users/portfolio/groww/all');
        setAggregate(res.data?.data || null);
        setPortfolio(null);
      } else {
        const params =
          selectedAccountId && selectedAccountId !== '__new__' ? { accountId: selectedAccountId } : undefined;
        const res = await api.get('/users/portfolio/groww', params ? { params } : undefined);
        setPortfolio(res.data?.data || null);
        setAggregate(null);
      }
      setShowRaw(false);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Failed to fetch portfolio');
    } finally {
      setLoadingPortfolio(false);
      portfolioFetchInFlightRef.current = false;
    }
  }, [selectedAccountId]);

  const openHoldingDetails = async (h) => {
    const symbol = h?.trading_symbol ? String(h.trading_symbol) : '';
    if (!symbol) return;
    setSelectedHolding(h);
    setHistoryError(null);
    setHistoryCandles([]);
    setLoadingHistory(true);
    try {
      const params = {
        accountId:
          selectedAccountId && selectedAccountId !== '__new__' && selectedAccountId !== '__all__'
            ? selectedAccountId
            : undefined,
        exchange: 'NSE',
        segment: 'CASH',
        tradingSymbol: symbol,
        candleInterval: '1day',
        days: 180,
      };
      const res = await api.get('/users/market/groww/history', { params });
      setHistoryCandles(res.data?.data?.candles || []);
    } catch (e) {
      setHistoryError(e?.response?.data?.message || e?.message || 'Failed to load historical data');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
    autoRefreshTimerRef.current = null;

    if (!status.connected) return undefined;
    if (!selectedAccountId || selectedAccountId === '__new__') return undefined;
    if (editingKeys) return undefined;

    refreshPortfolio();

    if (selectedAccountId === '__all__') return undefined;

    autoRefreshTimerRef.current = setInterval(() => {
      if (document.hidden) return;
      refreshPortfolio();
    }, 5000);

    return () => {
      if (autoRefreshTimerRef.current) clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    };
  }, [status.connected, selectedAccountId, editingKeys, refreshPortfolio]);

  return (
    <BrutalistScreen>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Portfolio</h1>
          <p className="text-sm text-secondary-600">Connect broker APIs and view everything in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" onClick={loadStatus} disabled={loadingStatus}>
            {loadingStatus ? 'Checking…' : 'Check Status'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!status.connected || loadingPortfolio || selectedAccountId === '__new__'}
            onClick={refreshPortfolio}
          >
            {loadingPortfolio ? 'Refreshing…' : 'Refresh Groww'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      ) : null}

      <div className="bg-white border border-secondary-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-secondary-900">Groww</h2>
              {loadingStatus ? (
                <span className="text-xs px-2 py-1 rounded-full bg-secondary-100 text-secondary-700">Checking…</span>
              ) : status.connected ? (
                <span className="text-xs px-2 py-1 rounded-full bg-success-100 text-success-700">Connected</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-secondary-100 text-secondary-700">Not connected</span>
              )}
            </div>
            <div className="mt-1 text-sm text-secondary-600">
              {status.updatedAt ? `Last updated ${new Date(status.updatedAt).toLocaleString()}` : 'No keys saved yet.'}
            </div>
            {status.connected && status.accounts.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  className="input h-10"
                  value={selectedAccountId || ''}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedAccountId(next);
                    setPortfolio(null);
                    setAggregate(null);
                    setError(null);
                    if (next === '__new__') {
                      setEditingKeys(true);
                      setApiKey('');
                      setApiSecret('');
                      setLabel('Primary');
                    } else if (next === '__all__') {
                      setEditingKeys(false);
                    } else {
                      setEditingKeys(false);
                    }
                  }}
                >
                  {status.accounts.length > 1 ? <option value="__all__">All accounts</option> : null}
                  {status.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label || a.id}
                    </option>
                  ))}
                  <option value="__new__">+ Add account</option>
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={selectedAccountId === '__all__'}
                  onClick={() => setEditingKeys((v) => !v)}
                >
                  {editingKeys ? 'Close' : 'Update Keys'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={disconnecting}
                  onClick={() => disconnect({ all: status.accounts.length <= 1 || selectedAccountId === '__all__' })}
                >
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </button>
                {status.accounts.length > 1 ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={disconnecting}
                    onClick={() => disconnect({ all: true })}
                  >
                    Remove All
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {editingKeys ? (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-secondary-700 mb-1">Account Label</label>
              <input
                className="input w-full"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main, Dad, Long-term, SIP"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">API Key</label>
              <textarea
                className="input w-full min-h-[108px]"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Groww API Key"
              />
            </div>
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-secondary-700 mb-1">API Secret</label>
              <input
                className="input w-full"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Paste Groww API Secret"
                type="password"
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                {status.connected ? (
                  <button type="button" className="btn-secondary" onClick={() => setEditingKeys(false)}>
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving || !apiKey.trim() || !apiSecret.trim()}
                  onClick={saveKeys}
                >
                  {saving ? 'Saving…' : status.connected ? 'Save Changes' : 'Connect'}
                </button>
              </div>
              <div className="mt-2 text-xs text-secondary-500">
                Keys are stored encrypted on the server.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {aggregate ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Accounts</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">
                {aggregateAccounts.filter((a) => a?.ok).length}/{aggregateAccounts.length}
              </div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Total Invested</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(aggregateTotals?.invested)}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Market Value</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(aggregateTotals?.marketValue)}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Total PnL</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(aggregateTotals?.pnl)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Accounts Summary</div>
              <div className="mt-4 overflow-x-auto border border-secondary-200 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary-50 text-secondary-700">
                    <tr>
                      <th className="text-left px-4 py-3">Account</th>
                      <th className="text-right px-4 py-3">Invested</th>
                      <th className="text-right px-4 py-3">Market Value</th>
                      <th className="text-right px-4 py-3">PnL</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregateAccounts.map((a) => (
                      <tr key={a?.account?.id || a?.account?.label} className="border-t border-secondary-200">
                        <td className="px-4 py-3 font-medium text-secondary-900">{a?.account?.label || a?.account?.id || '—'}</td>
                        <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(a?.summary?.invested)}</td>
                        <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(a?.summary?.marketValue)}</td>
                        <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(a?.summary?.pnl)}</td>
                        <td className="px-4 py-3 text-secondary-700">{a?.ok ? 'OK' : (a?.error || 'Failed')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Combined Holdings (Invested)</div>
              {combinedHoldings.length ? (
                <div className="mt-4 overflow-x-auto border border-secondary-200 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-secondary-50 text-secondary-700">
                      <tr>
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">ISIN</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Invested</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedHoldings.slice(0, 25).map((h) => (
                        <tr key={`${h.symbol}-${h.isin}`} className="border-t border-secondary-200">
                          <td className="px-4 py-3 font-medium text-secondary-900">{h.symbol}</td>
                          <td className="px-4 py-3 text-secondary-700">{h.isin || '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{h.qty}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(h.invested)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 text-sm text-secondary-600">No holdings returned.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {portfolio ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Holdings</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{holdings.length}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Positions</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{positionsCash.length + positionsFno.length}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Invested (qty × avg)</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(totals.invested)}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Market Value</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(totals.marketValue)}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Total PnL</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(totals.pnl)}</div>
            </div>
            <div className="bg-white border border-secondary-200 rounded-2xl p-5">
              <div className="text-xs font-medium text-secondary-500">Clear Cash</div>
              <div className="mt-1 text-2xl font-bold text-secondary-900">{formatMoneyInr(margins?.clear_cash)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Holdings Allocation</div>
              {holdingAllocation.data.length ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={holdingAllocation.data} dataKey="invested" nameKey="name" innerRadius={58} outerRadius={110} paddingAngle={2}>
                        {holdingAllocation.data.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatMoneyInr(value), 'Invested']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 text-sm text-secondary-600">No invested holdings to chart.</div>
              )}
            </div>

            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Top Holdings (Invested)</div>
              {holdingAllocation.topRows.length ? (
                <div className="mt-4 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={holdingAllocation.topRows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} interval={0} angle={-20} height={60} textAnchor="end" />
                      <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => formatCompactInr(v)} />
                      <Tooltip formatter={(value) => [formatMoneyInr(value), 'Invested']} />
                      <Bar dataKey="invested" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 text-sm text-secondary-600">No invested holdings to chart.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">User</div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-secondary-500">UCC</div>
                  <div className="font-medium text-secondary-900 truncate">{profile?.ucc || 'n/a'}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-secondary-500">Vendor User ID</div>
                  <div className="font-medium text-secondary-900 truncate">{profile?.vendor_user_id || 'n/a'}</div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-secondary-500">Segments</div>
                  <div className="font-medium text-secondary-900 truncate">
                    {Array.isArray(profile?.active_segments) ? profile.active_segments.join(', ') : 'n/a'}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-secondary-500">DDPI</div>
                  <div className="font-medium text-secondary-900">{profile?.ddpi_enabled === true ? 'Enabled' : 'Disabled'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-secondary-200 rounded-2xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-secondary-900">Margin / Balance</div>
                <button type="button" className="btn-secondary" onClick={() => setShowRaw((v) => !v)}>
                  {showRaw ? 'Hide Advanced' : 'Advanced'}
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <div className="text-xs text-secondary-500">Clear Cash</div>
                  <div className="mt-1 font-semibold text-secondary-900">{formatMoneyInr(margins?.clear_cash)}</div>
                </div>
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <div className="text-xs text-secondary-500">Collateral Available</div>
                  <div className="mt-1 font-semibold text-secondary-900">{formatMoneyInr(margins?.collateral_available)}</div>
                </div>
                <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <div className="text-xs text-secondary-500">Net Margin Used</div>
                  <div className="mt-1 font-semibold text-secondary-900">{formatMoneyInr(margins?.net_margin_used)}</div>
                </div>
              </div>

              {showRaw ? (
                <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                    <div className="text-xs font-medium text-secondary-700 mb-2">User schema</div>
                    <pre className="text-xs text-secondary-800 whitespace-pre-wrap break-words">{JSON.stringify(profile, null, 2)}</pre>
                  </div>
                  <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                    <div className="text-xs font-medium text-secondary-700 mb-2">Margin schema</div>
                    <pre className="text-xs text-secondary-800 whitespace-pre-wrap break-words">{JSON.stringify(margins, null, 2)}</pre>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="bg-white border border-secondary-200 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-secondary-900">Holdings</div>
            </div>
            {holdings.length ? (
              <div className="mt-4 overflow-x-auto border border-secondary-200 rounded-xl">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary-50 text-secondary-700">
                    <tr>
                      <th className="text-left px-4 py-3">Symbol</th>
                      <th className="text-left px-4 py-3">ISIN</th>
                      <th className="text-right px-4 py-3">Qty</th>
                      <th className="text-right px-4 py-3">Avg Price</th>
                      <th className="text-right px-4 py-3">Invested</th>
                      <th className="text-right px-4 py-3">LTP</th>
                      <th className="text-right px-4 py-3">Market Value</th>
                      <th className="text-right px-4 py-3">PnL</th>
                      <th className="text-right px-4 py-3">PnL %</th>
                      <th className="text-right px-4 py-3">Free Qty</th>
                      <th className="text-right px-4 py-3">T1 Qty</th>
                      <th className="text-right px-4 py-3">Pledged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => {
                      const qty = toNumber(h?.quantity) || 0;
                      const avg = toNumber(h?.average_price) || 0;
                      const invested = qty * avg;
                      const ltp = toNumber(
                        h?.last_price ??
                          h?.ltp ??
                          h?.last_traded_price ??
                          h?.current_price ??
                          h?.price ??
                          h?.close
                      );
                      const marketValue = ltp !== null ? qty * ltp : null;
                      const pnlFromApi = toNumber(h?.pnl ?? h?.pnl_amount ?? h?.unrealised_pnl ?? h?.unrealized_pnl);
                      const pnl = marketValue !== null ? (pnlFromApi !== null ? pnlFromApi : (marketValue - invested)) : null;
                      const pnlPct = invested > 0 && pnl !== null ? (100 * pnl) / invested : null;
                      const pnlClass = pnl === null ? 'text-secondary-900' : pnl > 0 ? 'text-emerald-700' : pnl < 0 ? 'text-rose-700' : 'text-secondary-900';
                      return (
                        <tr key={`${h?.trading_symbol || h?.isin}-${h?.isin}`} className="border-t border-secondary-200">
                          <td className="px-4 py-3 font-medium">
                            <button
                              type="button"
                              className="text-primary-700 hover:underline"
                              onClick={() => openHoldingDetails(h)}
                              disabled={!h?.trading_symbol || loadingHistory}
                            >
                              {h?.trading_symbol || '—'}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-secondary-700">{h?.isin || '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{qty}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(avg)}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(invested)}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(ltp)}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(marketValue)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${pnlClass}`}>{formatMoneyInr(pnl)}</td>
                          <td className={`px-4 py-3 text-right font-medium ${pnlClass}`}>
                            {pnlPct === null ? 'n/a' : `${pnlPct.toFixed(2)}%`}
                          </td>
                          <td className="px-4 py-3 text-right text-secondary-900">{toNumber(h?.demat_free_quantity) ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{toNumber(h?.t1_quantity) ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{toNumber(h?.pledge_quantity) ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3 text-sm text-secondary-600">No holdings returned.</div>
            )}
          </div>

          {selectedHolding ? (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setSelectedHolding(null)}
                aria-label="Close stock details"
              />
              <div className="relative w-full sm:max-w-3xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-secondary-200 max-h-[90vh] overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-secondary-200 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold text-secondary-900 truncate">
                      {selectedHolding?.trading_symbol || 'Stock'}
                    </div>
                    <div className="mt-1 text-sm text-secondary-600">
                      Qty {toNumber(selectedHolding?.quantity) ?? '—'} • Avg {formatMoneyInr(selectedHolding?.average_price)}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setSelectedHolding(null)}>
                    Close
                  </button>
                </div>
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-84px)]">
                  {historyError ? (
                    <div className="bg-danger-50 border border-danger-200 text-danger-700 rounded-lg px-4 py-3 text-sm">
                      {historyError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                      <div className="text-xs text-secondary-500">Invested</div>
                      <div className="mt-1 font-semibold text-secondary-900">
                        {formatMoneyInr((toNumber(selectedHolding?.quantity) || 0) * (toNumber(selectedHolding?.average_price) || 0))}
                      </div>
                    </div>
                    <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                      <div className="text-xs text-secondary-500">ISIN</div>
                      <div className="mt-1 font-semibold text-secondary-900">{selectedHolding?.isin || '—'}</div>
                    </div>
                    <div className="bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                      <div className="text-xs text-secondary-500">Range</div>
                      <div className="mt-1 font-semibold text-secondary-900">Last 180 days</div>
                    </div>
                  </div>

                  <div className="bg-white border border-secondary-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-secondary-900">Price (Close)</div>
                      {loadingHistory ? <div className="text-sm text-secondary-600">Loading…</div> : null}
                    </div>
                    <div className="mt-4 h-64">
                      {historySeries.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={historySeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              tickFormatter={(v) => {
                                const n = toNumber(v);
                                if (n === null) return '';
                                if (Math.abs(n) < 1000) return `${Math.round(n)}`;
                                return `${Math.round(n / 100) * 100}`;
                              }}
                            />
                            <Tooltip formatter={(v) => formatMoneyInr(v)} />
                            <Line type="monotone" dataKey="close" stroke="#2563eb" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-sm text-secondary-600">
                          {loadingHistory ? 'Loading history…' : 'No historical data returned.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Positions (CASH)</div>
              {positionsCash.length ? (
                <div className="mt-4 overflow-x-auto border border-secondary-200 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-secondary-50 text-secondary-700">
                      <tr>
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">Exchange</th>
                        <th className="text-left px-4 py-3">Product</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Realised PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionsCash.map((p, idx) => (
                        <tr key={`${p?.trading_symbol || 'pos'}-${idx}`} className="border-t border-secondary-200">
                          <td className="px-4 py-3 font-medium text-secondary-900">{p?.trading_symbol || '—'}</td>
                          <td className="px-4 py-3 text-secondary-700">{p?.exchange || '—'}</td>
                          <td className="px-4 py-3 text-secondary-700">{p?.product || '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{toNumber(p?.quantity) ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(p?.realised_pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 text-sm text-secondary-600">No CASH positions returned.</div>
              )}
              {showRaw ? (
                <div className="mt-4 bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-secondary-700 mb-2">Raw</div>
                  <pre className="text-xs text-secondary-800 whitespace-pre-wrap break-words">{JSON.stringify(positionsCash, null, 2)}</pre>
                </div>
              ) : null}
            </div>

            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Positions (FNO)</div>
              {positionsFno.length ? (
                <div className="mt-4 overflow-x-auto border border-secondary-200 rounded-xl">
                  <table className="min-w-full text-sm">
                    <thead className="bg-secondary-50 text-secondary-700">
                      <tr>
                        <th className="text-left px-4 py-3">Symbol</th>
                        <th className="text-left px-4 py-3">Exchange</th>
                        <th className="text-left px-4 py-3">Product</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Realised PnL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionsFno.map((p, idx) => (
                        <tr key={`${p?.trading_symbol || 'pos'}-${idx}`} className="border-t border-secondary-200">
                          <td className="px-4 py-3 font-medium text-secondary-900">{p?.trading_symbol || '—'}</td>
                          <td className="px-4 py-3 text-secondary-700">{p?.exchange || '—'}</td>
                          <td className="px-4 py-3 text-secondary-700">{p?.product || '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{toNumber(p?.quantity) ?? '—'}</td>
                          <td className="px-4 py-3 text-right text-secondary-900">{formatMoneyInr(p?.realised_pnl)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 text-sm text-secondary-600">No FNO positions returned.</div>
              )}
              {showRaw ? (
                <div className="mt-4 bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-secondary-700 mb-2">Raw</div>
                  <pre className="text-xs text-secondary-800 whitespace-pre-wrap break-words">{JSON.stringify(positionsFno, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          </div>

          {showRaw ? (
            <div className="bg-white border border-secondary-200 rounded-2xl p-6">
              <div className="text-sm font-semibold text-secondary-900">Full raw payload</div>
              <div className="mt-4 bg-secondary-50 border border-secondary-200 rounded-xl p-4">
                <pre className="text-xs text-secondary-800 whitespace-pre-wrap break-words">{JSON.stringify(portfolio, null, 2)}</pre>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
    </BrutalistScreen>
  );
};

export default Portfolio;
