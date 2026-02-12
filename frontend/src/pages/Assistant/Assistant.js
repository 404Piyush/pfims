import { useState, useRef, useEffect } from 'react';
import chatAPI from '../../services/chatAPI';
import ReactMarkdown from 'react-markdown';
import { PlusCircleIcon, PencilSquareIcon, TrashIcon, ArrowPathIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../store/slices/categorySlice';
import api from '../../services/api';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns';

const INITIAL_GREETING = "Hi! I'm your PFIMS budget assistant. How can I help today?";
const SESSIONS_PAGE_SIZE = 10;

const Assistant = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: INITIAL_GREETING }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingGroww, setLoadingGroww] = useState(false);
  const [showGrowwStockModal, setShowGrowwStockModal] = useState(false);
  const [growwIntegration, setGrowwIntegration] = useState(null);
  const [selectedGrowwAccountId, setSelectedGrowwAccountId] = useState('');
  const [growwHoldingsList, setGrowwHoldingsList] = useState([]);
  const [selectedGrowwTradingSymbol, setSelectedGrowwTradingSymbol] = useState('');
  const [growwStockDays, setGrowwStockDays] = useState(180);
  const [loadingGrowwHoldingsList, setLoadingGrowwHoldingsList] = useState(false);
  const [loadingGrowwStock, setLoadingGrowwStock] = useState(false);
  const [growwStockError, setGrowwStockError] = useState('');
  const [lastMeta, setLastMeta] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [lastUserText, setLastUserText] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [sessionsOffset, setSessionsOffset] = useState(0);
  const [renamingId, setRenamingId] = useState(null);
  const [renameText, setRenameText] = useState('');
  // Context selection state
  const dispatch = useDispatch();
  const { categories } = useSelector((state) => state.categories || { categories: [] });
  const [attachContext, setAttachContext] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [contextPreview, setContextPreview] = useState('');
  const [contextText, setContextText] = useState('');
  const chatRef = useRef(null);
  const sessionsRef = useRef(null);

  useEffect(() => {
    // Auto-scroll chat to bottom on new messages or when loading state changes
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Load sessions on mount
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingSessions(true);
      try {
        const res = await chatAPI.listSessions({ limit: SESSIONS_PAGE_SIZE, offset: 0 });
        const list = res.data?.data || [];
        const paging = res.data?.paging;
        if (mounted) {
          setSessions(list);
          setSessionsOffset(list.length);
          setHasMoreSessions(Boolean(paging?.hasMore));
        }
      } catch (e) {
        // silent; toasts handled globally
      } finally {
        if (mounted) setLoadingSessions(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  // Fetch categories for dropdown
  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Month options (last 12 months)
  const monthsOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') };
  });

  const findCategoryName = (id) => {
    if (!id || id === 'all') return 'All Categories';
    const c = Array.isArray(categories) ? categories.find((x) => String(x._id) === String(id)) : null;
    return c?.name || 'Unknown';
  };

  const getSelectedRangeDates = () => {
    // Parse selectedMonthKey in format yyyy-MM
    try {
      const base = new Date(`${selectedMonthKey}-01T00:00:00`);
      const s = startOfMonth(base);
      const e = endOfMonth(base);
      return { startDate: s, endDate: e };
    } catch (err) {
      const now = new Date();
      return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
    }
  };

  const buildContext = async () => {
    setContextLoading(true);
    try {
      const { startDate, endDate } = getSelectedRangeDates();
      const startIso = startOfDay(startDate).toISOString();
      const endIso = endOfDay(endDate).toISOString();

      const txParams = { limit: 100, startDate: startIso, endDate: endIso };
      if (selectedCategoryId !== 'all') txParams.category = selectedCategoryId;

      const summaryParams = { period: 'custom', startDate: startIso, endDate: endIso };
      if (selectedCategoryId !== 'all') summaryParams.category = selectedCategoryId;

      const [summaryRes, txRes] = await Promise.all([
        api.get('/transactions/analytics/summary', { params: summaryParams }),
        api.get('/transactions', { params: txParams }),
      ]);

      const summaryPayload = summaryRes.data?.data || summaryRes.data || {};
      const summary = summaryPayload;
      const txPayload = txRes.data?.data || txRes.data || {};
      const txs = Array.isArray(txPayload?.transactions)
        ? txPayload.transactions
        : Array.isArray(txRes.data?.transactions)
          ? txRes.data.transactions
          : Array.isArray(txRes.data)
            ? txRes.data
            : [];

      // Compute totals as fallback if summary not provided
      const totals = {
        income: Number(summary?.totalIncome ?? summary?.totals?.income ?? 0),
        expense: Number(summary?.totalExpense ?? summary?.totals?.expense ?? 0),
      };
      // If a specific category is selected, recompute totals from filtered transactions
      if (selectedCategoryId !== 'all' || !summary?.totals) {
        txs.forEach((t) => {
          const amt = Number(t?.amount ?? 0);
          const type = String(t?.type || '').toLowerCase();
          if (type === 'income') totals.income += amt;
          else totals.expense += amt;
        });
      }
      const net = totals.income - totals.expense;
      const savingsRate = totals.income > 0 ? (100 * (totals.income - totals.expense) / totals.income) : 0;

      // Top categories (expense side)
      const topExpenses = (summary?.categories?.expense || [])
        .slice(0, 5)
        .map((c) => `${c.name}: ₹${Number((c.totalAmount ?? c.amount) ?? 0).toFixed(2)}${c.percentage != null ? ` (${Number(c.percentage).toFixed(1)}%)` : ''}`);

      // Largest transactions by absolute amount
      const largestTxns = [...txs]
        .sort((a, b) => Math.abs(Number(b.amount ?? 0)) - Math.abs(Number(a.amount ?? 0)))
        .slice(0, 5)
        .map((t) => {
          const dt = t.date ? new Date(t.date) : null;
          const dateStr = dt ? format(dt, 'dd MMM') : 'Unknown date';
          const catName = t.categoryName || t.category?.name || 'Uncategorized';
          const amt = Number(t.amount ?? 0).toFixed(2);
          const tt = String(t.type || '').toLowerCase();
          return `${dateStr} · ${catName} · ${tt === 'income' ? '+' : '-'}₹${amt}`;
        });

      const monthLabel = monthsOptions.find((m) => m.key === selectedMonthKey)?.label || format(new Date(), 'MMM yyyy');
      const categoryLabel = findCategoryName(selectedCategoryId);

      const preview = `${monthLabel} · ${categoryLabel} · ${txs.length} txns · Income ₹${totals.income.toFixed(2)} · Expense ₹${totals.expense.toFixed(2)} · Net ₹${net.toFixed(2)}`;
      setContextPreview(preview);

      const lines = [
        `Period: ${monthLabel}`,
        `Category filter: ${categoryLabel}`,
        `Totals: Income ₹${totals.income.toFixed(2)}, Expenses ₹${totals.expense.toFixed(2)}, Net ₹${net.toFixed(2)}, Savings Rate ${savingsRate.toFixed(1)}%`,
        `Transaction Count: ${txs.length}`,
      ];
      if (topExpenses.length) {
        lines.push(`Top Expense Categories: ${topExpenses.join('; ')}`);
      }
      if (largestTxns.length) {
        lines.push(`Largest Transactions: ${largestTxns.join(' | ')}`);
      }
      setContextText(lines.join('\n'));
    } catch (err) {
      setContextPreview('Context unavailable');
      setContextText('');
    } finally {
      setContextLoading(false);
    }
  };

  // Rebuild context when selection changes and toggle is enabled
  useEffect(() => {
    if (attachContext) buildContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonthKey, selectedCategoryId, attachContext]);

  const loadSessions = async ({ append } = { append: false }) => {
    setLoadingSessions(true);
    try {
      const offset = append ? sessionsOffset : 0;
      const res = await chatAPI.listSessions({ limit: SESSIONS_PAGE_SIZE, offset });
      const list = res.data?.data || [];
      const paging = res.data?.paging;
      setSessions((prev) => {
        if (!append) return list;
        const seen = new Set(prev.map((s) => String(s.id)));
        const merged = [...prev];
        for (const s of list) {
          if (!seen.has(String(s.id))) merged.push(s);
        }
        return merged;
      });
      setSessionsOffset((prev) => (append ? prev + list.length : list.length));
      setHasMoreSessions(Boolean(paging?.hasMore));
    } catch (e) {
      // handled globally
    } finally {
      setLoadingSessions(false);
    }
  };

  const selectSession = async (id) => {
    try {
      const res = await chatAPI.getSession(id);
      const data = res.data?.data;
      setSelectedSessionId(id);
      const msgs = Array.isArray(data?.messages) ? data.messages : [];
      if (msgs.length === 0) {
        setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
      } else {
        setMessages(msgs.map(m => ({ role: m.role, content: m.content })));
      }
      setLastMeta(null);
      setLastError(null);
      setRenamingId(null);
    } catch (e) {}
  };

  const createSession = async () => {
    try {
      const res = await chatAPI.createSession();
      const id = res.data?.data?.id;
      if (id) {
        await loadSessions({ append: false });
        await selectSession(id);
      }
    } catch (e) {}
  };

  const startRenaming = (id) => {
    const s = sessions.find(x => x.id === id);
    setRenamingId(id);
    setRenameText(s?.title || '');
  };

  const applyRename = async () => {
    if (!renamingId) return;
    try {
      await chatAPI.renameSession(renamingId, renameText.trim() || 'New Chat');
      setSessions(prev => prev.map(s => s.id === renamingId ? { ...s, title: renameText.trim() || 'New Chat' } : s));
      setRenamingId(null);
      setRenameText('');
    } catch (e) {}
  };

  const beginRenameFor = async (id) => {
    if (!id) return;
    if (selectedSessionId !== id) {
      await selectSession(id);
    }
    startRenaming(id);
  };

  const beginDeleteFor = async (id) => {
    if (!id) return;
    await deleteSession(id);
  };

  const deleteSession = async (id) => {
    try {
      await chatAPI.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSessionId === id) {
        setSelectedSessionId(null);
        setMessages([{ role: 'assistant', content: INITIAL_GREETING }]);
        setLastMeta(null);
        setLastError(null);
      }
    } catch (e) {}
  };

  const deriveSessionTitle = (text) => {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'New Chat';
    const words = cleaned.split(' ').slice(0, 8).join(' ');
    return words.length > 60 ? `${words.slice(0, 57)}…` : words;
  };

  const autoTitleSessionIfNeeded = async ({ sessionId, userText }) => {
    if (!sessionId) return;
    const existing = sessions.find((s) => s.id === sessionId);
    const existingTitle = (existing?.title || '').trim();
    if (existingTitle && existingTitle !== 'Untitled' && existingTitle !== 'New Chat') return;
    const title = deriveSessionTitle(userText);
    try {
      await chatAPI.renameSession(sessionId, title);
      await loadSessions({ append: false });
    } catch (e) {}
  };

  const doSend = async (text, options = {}) => {
    const trimmed = String(text || '').trim();
    if (!trimmed) return;

    const addUserMessage = options?.addUserMessage !== false;
    const userDisplayText = options?.userDisplayText ? String(options.userDisplayText) : trimmed;
    const extraContext = options?.extraContext ? String(options.extraContext) : '';

    if (addUserMessage) {
      setMessages((prev) => [...prev, { role: 'user', content: userDisplayText }]);
      setInput('');
    }
    setLoading(true);
    setLastError(null);

    try {
      const history = messages
        .filter((m, idx) => {
          if (m.role !== 'user' && m.role !== 'assistant') return false;
          if (m.role === 'assistant') {
            const isInitial = idx === 0 && m.content.trim() === INITIAL_GREETING;
            const isDebugLine = m.content.trim().startsWith('Debug:');
            const isErrorPlaceholder = m.content.trim() === 'I hit an error. Please try again.';
            return !(isInitial || isDebugLine || isErrorPlaceholder);
          }
          return true;
        })
        .map((m) => ({ role: m.role, content: m.content }));

      const messageToSend = attachContext && contextText ? `Context:\n${contextText}\n\nQuestion:\n${trimmed}` : trimmed;

      const res = await chatAPI.sendMessage({
        sessionId: selectedSessionId,
        message: messageToSend,
        extraContext,
        history,
        includeContext: attachContext,
        debug: false,
        lite: false
      });
      const reply = res.data?.data?.reply || 'Sorry, I was unable to generate a response.';
      const meta = res.data?.data?.meta;
      const newSessionId = res.data?.data?.sessionId;
      if (!selectedSessionId && newSessionId) {
        setSelectedSessionId(newSessionId);
        loadSessions();
      }
      const effectiveSessionId = selectedSessionId || newSessionId;
      if (effectiveSessionId && trimmed) {
        autoTitleSessionIfNeeded({ sessionId: effectiveSessionId, userText: trimmed });
      }
      if (meta) setLastMeta(meta);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.message || 'Unknown error';
      const serverDetails = err?.response?.data?.details;
      const details = serverDetails || (typeof err === 'object' ? JSON.stringify({ name: err?.name, message: err?.message, stack: err?.stack }, null, 2) : String(err));
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const code = err?.code;
      setLastError({ status, message, details, url, baseURL, code });
      setMessages(prev => [...prev, { role: 'assistant', content: 'I hit an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setLastUserText(text);
    await doSend(text);
  };

  const selectedSessionTitle = (() => {
    const s = sessions.find((x) => x.id === selectedSessionId);
    return s?.title || 'New Chat';
  })();

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

  const loadGrowwHoldingsList = async (accountId) => {
    setLoadingGrowwHoldingsList(true);
    setGrowwStockError('');
    try {
      const params = accountId ? { accountId } : undefined;
      const res = await api.get('/users/portfolio/groww/holdings-list', params ? { params } : undefined);
      const list = res.data?.data?.holdings || [];
      setGrowwHoldingsList(Array.isArray(list) ? list : []);
      const first = Array.isArray(list) ? list[0]?.tradingSymbol : '';
      if (first && !selectedGrowwTradingSymbol) setSelectedGrowwTradingSymbol(first);
    } catch (e) {
      setGrowwHoldingsList([]);
      setSelectedGrowwTradingSymbol('');
      setGrowwStockError(e?.response?.data?.message || e?.message || 'Failed to load holdings');
    } finally {
      setLoadingGrowwHoldingsList(false);
    }
  };

  const buildGrowwSnapshotText = (data) => {
    const holdings = data?.holdings?.payload?.holdings || [];
    const margins = data?.margins?.payload || null;
    const account = data?.account || null;

    const investedRows = holdings
      .map((h) => {
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
        return { symbol: h?.trading_symbol || h?.isin || '—', qty, avg, invested, ltp, marketValue, pnl };
      })
      .filter((r) => r.invested > 0)
      .sort((a, b) => b.invested - a.invested);

    const investedTotal = investedRows.reduce((sum, r) => sum + r.invested, 0);
    const marketValueTotal = investedRows.reduce((sum, r) => sum + (toNumber(r.marketValue) || 0), 0);
    const pnlTotal = investedRows.reduce((sum, r) => sum + (toNumber(r.pnl) || 0), 0);
    const top = investedRows
      .slice(0, 5)
      .map(
        (r) =>
          `${r.symbol}: inv ${formatMoneyInr(r.invested)} · mv ${formatMoneyInr(r.marketValue)} · pnl ${formatMoneyInr(r.pnl)} (${r.qty} @ ${formatMoneyInr(r.avg)})`
      );

    const lines = [];
    if (account?.label || account?.id) lines.push(`Groww Account: ${account?.label || account?.id}`);
    lines.push(`Holdings: ${holdings.length}`);
    lines.push(`Invested (qty × avg): ${formatMoneyInr(investedTotal)}`);
    lines.push(`Market Value: ${formatMoneyInr(marketValueTotal)}`);
    lines.push(`Total PnL: ${formatMoneyInr(pnlTotal)}`);
    if (margins) {
      lines.push(`Clear Cash: ${formatMoneyInr(margins.clear_cash)}`);
      lines.push(`Collateral Available: ${formatMoneyInr(margins.collateral_available)}`);
      lines.push(`Net Margin Used: ${formatMoneyInr(margins.net_margin_used)}`);
    }
    if (top.length) lines.push(`Top Holdings: ${top.join('; ')}`);
    return lines.join('\n');
  };

  const openGrowwStockModal = async () => {
    if (loading || loadingGroww) return;
    setLoadingGroww(true);
    setGrowwStockError('');
    try {
      const res = await api.get('/users/integrations/groww');
      const integration = res.data?.integration;
      setGrowwIntegration(integration || null);
      const accounts = Array.isArray(integration?.accounts) ? integration.accounts : [];
      const defaultId = integration?.defaultAccountId || accounts[0]?.id || '';
      setSelectedGrowwAccountId(defaultId);
      setShowGrowwStockModal(true);
      if (defaultId) {
        await loadGrowwHoldingsList(defaultId);
      } else {
        setGrowwHoldingsList([]);
        setSelectedGrowwTradingSymbol('');
      }
    } catch (e) {
      setGrowwIntegration(null);
      setGrowwHoldingsList([]);
      setSelectedGrowwTradingSymbol('');
      setShowGrowwStockModal(false);
      setGrowwStockError(e?.response?.data?.message || e?.message || 'Failed to load Groww accounts');
      setMessages(prev => [...prev, { role: 'assistant', content: 'I could not load your Groww integration. Please connect it in Portfolio first.' }]);
    } finally {
      setLoadingGroww(false);
    }
  };

  const buildGrowwHoldingContextText = (data) => {
    const account = data?.account || null;
    const holding = data?.holding || null;
    const quote = data?.quote || null;
    const history = data?.history || null;
    const summary = history?.summary || null;

    const qty = toNumber(holding?.quantity) || 0;
    const avg = toNumber(holding?.average_price) || 0;
    const invested = qty * avg;
    const ltp = toNumber(quote?.last_price ?? quote?.ltp ?? quote?.close ?? holding?.last_price ?? holding?.ltp) || null;
    const marketValue = ltp !== null ? qty * ltp : null;
    const pnl = marketValue !== null ? marketValue - invested : null;

    const lines = [];
    if (account?.label || account?.id) lines.push(`Groww Account: ${account?.label || account?.id}`);
    lines.push(`Symbol: ${holding?.trading_symbol || history?.tradingSymbol || '—'}`);
    if (holding?.isin) lines.push(`ISIN: ${holding.isin}`);
    lines.push(`Holding: qty ${qty}, avg ${formatMoneyInr(avg)}, invested ${formatMoneyInr(invested)}`);
    if (ltp !== null) lines.push(`LTP: ${formatMoneyInr(ltp)} · Market Value: ${formatMoneyInr(marketValue)} · PnL: ${formatMoneyInr(pnl)}`);
    const freeQty = toNumber(holding?.demat_free_quantity);
    const t1Qty = toNumber(holding?.t1_quantity);
    const pledgedQty = toNumber(holding?.pledge_quantity);
    if (freeQty !== null || t1Qty !== null || pledgedQty !== null) {
      lines.push(`Qty breakdown: free ${freeQty ?? 'n/a'} · T1 ${t1Qty ?? 'n/a'} · pledged ${pledgedQty ?? 'n/a'}`);
    }
    if (summary) {
      const pct = summary.changePct !== null && summary.changePct !== undefined ? `${Number(summary.changePct).toFixed(2)}%` : 'n/a';
      lines.push(
        `Price Range (${history?.candleInterval || 'n/a'}, ${summary.points} pts): ` +
          `start ${formatMoneyInr(summary.firstClose)}, end ${formatMoneyInr(summary.lastClose)}, ` +
          `min ${formatMoneyInr(summary.minClose)}, max ${formatMoneyInr(summary.maxClose)}, change ${pct}`
      );
    }
    return lines.join('\n');
  };

  const askAiAboutGrowwStock = async () => {
    if (loading || loadingGroww || loadingGrowwStock) return;
    if (!selectedGrowwTradingSymbol) {
      setGrowwStockError('Please select a stock first.');
      return;
    }
    setLoadingGrowwStock(true);
    setGrowwStockError('');
    try {
      const params = {
        accountId: selectedGrowwAccountId,
        tradingSymbol: selectedGrowwTradingSymbol,
        exchange: 'NSE',
        segment: 'CASH',
        candleInterval: '1day',
        days: growwStockDays,
      };
      const res = await api.get('/users/portfolio/groww/holding', { params });
      const data = res.data?.data || null;
      const visibleCtx = buildGrowwHoldingContextText(data);

      const candles = Array.isArray(data?.history?.candles) ? data.history.candles : [];
      const candleLines = candles
        .map((c) => (Array.isArray(c) ? c.join(',') : String(c)))
        .join('\n');

      const holding = data?.holding || null;
      const quote = data?.quote || null;
      const account = data?.account || null;
      const qty = toNumber(holding?.quantity) || 0;
      const avg = toNumber(holding?.average_price) || 0;
      const invested = qty * avg;
      const ltp = toNumber(quote?.last_price ?? quote?.ltp ?? quote?.close ?? holding?.last_price ?? holding?.ltp);
      const marketValue = ltp !== null ? qty * ltp : null;
      const pnl = marketValue !== null ? marketValue - invested : null;
      const freeQty = toNumber(holding?.demat_free_quantity);
      const t1Qty = toNumber(holding?.t1_quantity);
      const pledgedQty = toNumber(holding?.pledge_quantity);
      const safeJson = (obj, maxChars) => {
        try {
          const s = JSON.stringify(obj || {}, null, 2);
          return s.length > maxChars ? `${s.slice(0, maxChars)}\n...` : s;
        } catch (e) {
          return '{}';
        }
      };
      const extraContext =
        `Historical candles CSV (timestamp,open,high,low,close,volume)\n` +
        `Requested days: ${growwStockDays}\n` +
        `Returned points: ${candles.length}\n` +
        `${candleLines}\n\n` +
        `Account: ${account?.label || account?.id || '—'}\n` +
        `Holding: ${holding?.trading_symbol || '—'}\n` +
        `Derived: qty ${qty}, avg ${avg}, invested ${invested}, ltp ${ltp ?? 'n/a'}, marketValue ${marketValue ?? 'n/a'}, pnl ${pnl ?? 'n/a'}\n` +
        `Qty breakdown: free ${freeQty ?? 'n/a'}, T1 ${t1Qty ?? 'n/a'}, pledged ${pledgedQty ?? 'n/a'}\n` +
        `Holding details (JSON, truncated):\n${safeJson(holding || {}, 8000)}\n\n` +
        `Live quote (JSON, truncated):\n${safeJson(quote || {}, 4000)}`;

      setMessages((prev) => [
        ...prev,
        {
          role: 'event',
          title: `Sent ${selectedGrowwTradingSymbol} to AI`,
          content: visibleCtx,
        },
      ]);

      const prompt =
        `Analyze my Groww holding ${selectedGrowwTradingSymbol} using the attached data.\n\n` +
        `Return all sections fully:\n` +
        `1) Clear Summary\n` +
        `2) Risks / Opportunities (3 each)\n` +
        `3) Actionable Next Steps (3)\n` +
        `4) Technical Read (trend/support/resistance)\n\n` +
        `Do not ask me to fetch more data.`;

      setLastUserText(`Groww stock: ${selectedGrowwTradingSymbol}`);
      setShowGrowwStockModal(false);
      await doSend(prompt, { addUserMessage: false, extraContext });
    } catch (e) {
      setGrowwStockError(e?.response?.data?.message || e?.message || 'Failed to fetch stock data');
    } finally {
      setLoadingGrowwStock(false);
    }
  };

  const sendGrowwSnapshot = async () => {
    if (loading || loadingGroww) return;
    setLoadingGroww(true);
    setLastError(null);
    try {
      const res = await api.get('/users/portfolio/groww');
      const data = res.data?.data;
      const snapshot = buildGrowwSnapshotText(data);
      const prompt = `Here is my Groww portfolio snapshot:\n${snapshot}\n\nGive me:\n1) a clear summary\n2) 3 insights (risks/opportunities)\n3) 3 actionable next steps`;
      setLastUserText('Groww portfolio snapshot');
      await doSend(prompt);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.message || err?.message || 'Unknown error';
      const serverDetails = err?.response?.data?.details;
      const details = serverDetails || (typeof err === 'object' ? JSON.stringify({ name: err?.name, message: err?.message, stack: err?.stack }, null, 2) : String(err));
      const url = err?.config?.url;
      const baseURL = err?.config?.baseURL;
      const code = err?.code;
      setLastError({ status, message, details, url, baseURL, code });
      setMessages(prev => [...prev, { role: 'assistant', content: 'I hit an error fetching your Groww portfolio. Please try again.' }]);
    } finally {
      setLoadingGroww(false);
    }
  };

  const quickActions = [
    { label: 'Monthly summary', prompt: 'Give me a clear summary of my spending and income for the selected period.' },
    { label: 'Top categories', prompt: 'What are my top expense categories and biggest transactions for the selected period?' },
    { label: 'Cut expenses', prompt: 'Based on my spending, suggest 3 practical ways to cut expenses for the selected period.' },
    { label: 'Budget next month', prompt: 'Suggest realistic budgets for next month based on my recent spending patterns.' },
    { label: 'Groww portfolio', onClick: sendGrowwSnapshot },
    { label: 'Groww stock', onClick: openGrowwStockModal },
  ];

  const onSessionsScroll = async (e) => {
    if (loadingSessions || !hasMoreSessions) return;
    const el = e.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining > 80) return;
    await loadSessions({ append: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Assistant</h1>
          <p className="text-secondary-600">Ask questions about your money and get fast, contextual answers.</p>
        </div>
        <div className="flex items-center gap-2">
          {lastMeta && (
            <span className="text-xs bg-secondary-100 text-secondary-700 px-2 py-1 rounded-md border border-secondary-200">
              {lastMeta.provider ? `${lastMeta.provider}` : 'atlas'}{lastMeta.model ? ` · ${lastMeta.model}` : ''}
            </span>
          )}
          <button
            type="button"
            onClick={createSession}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 xl:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
            <div className="p-4 border-b border-secondary-200 flex items-center justify-between">
              <div className="font-semibold text-secondary-900">Chats</div>
              <button
                type="button"
                onClick={createSession}
                className="btn-secondary inline-flex items-center gap-2"
                disabled={loadingSessions}
              >
                <PlusCircleIcon className="h-4 w-4" />
                <span>New</span>
              </button>
            </div>
            <div ref={sessionsRef} onScroll={onSessionsScroll} className="p-2 h-[184px] overflow-y-auto">
              {loadingSessions ? (
                <div className="p-3 text-sm text-secondary-600">Loading chats…</div>
              ) : sessions.length === 0 ? (
                <div className="p-3 text-sm text-secondary-600">No chats yet. Create one to start.</div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((s) => {
                    const isSelected = s.id === selectedSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => selectSession(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectSession(s.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-current={isSelected ? 'true' : 'false'}
                        className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${
                          isSelected
                            ? 'bg-primary-50 border-primary-200'
                            : 'bg-white border-transparent hover:bg-secondary-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-secondary-900 truncate">
                              {s.title || 'Untitled'}
                            </div>
                            <div className="text-xs text-secondary-500 truncate">
                              {isSelected ? 'Active' : 'Chat'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                beginRenameFor(s.id);
                              }}
                              className="p-1 rounded-md text-secondary-500 hover:text-secondary-900 hover:bg-white border border-transparent hover:border-secondary-200"
                              title="Rename"
                            >
                              <PencilSquareIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                beginDeleteFor(s.id);
                              }}
                              className="p-1 rounded-md text-danger-600 hover:text-danger-700 hover:bg-white border border-transparent hover:border-danger-200"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-secondary-200">
            <div className="p-4 border-b border-secondary-200 flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-secondary-900">Context</div>
                <div className="text-xs text-secondary-600">Attach your data summary to every question.</div>
              </div>
              <label className="flex items-center gap-2 text-sm text-secondary-700">
                <input
                  type="checkbox"
                  checked={attachContext}
                  onChange={(e) => setAttachContext(e.target.checked)}
                  className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                />
                <span>On</span>
              </label>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <select
                  className="input"
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                >
                  {monthsOptions.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <select
                  className="input"
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {(Array.isArray(categories) ? categories : []).map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-secondary-600 truncate" title={contextPreview || 'Context preview'}>
                  {contextLoading ? 'Loading…' : (contextPreview || 'Context not ready')}
                </div>
                <button
                  type="button"
                  onClick={buildContext}
                  className="btn-secondary inline-flex items-center gap-2"
                  disabled={!attachContext || contextLoading}
                >
                  <ArrowPathIcon className={`h-4 w-4 ${contextLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 xl:col-span-9">
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 flex flex-col h-[70vh] min-h-0">
            <div className="p-4 border-b border-secondary-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-secondary-900 truncate">{selectedSessionTitle}</div>
                <div className="text-xs text-secondary-600 truncate">
                  {attachContext ? (contextPreview || 'Context not ready') : 'Context off'}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-secondary-200 bg-white">
              <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                {quickActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    className="btn-secondary btn-sm whitespace-nowrap"
                    disabled={loading || loadingGroww}
                    onClick={() => {
                      if (typeof a.onClick === 'function') {
                        a.onClick();
                        return;
                      }
                      setLastUserText(a.prompt);
                      doSend(a.prompt);
                    }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {renamingId === selectedSessionId && (
              <div className="p-4 border-b border-secondary-200">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="input"
                    value={renameText}
                    onChange={(e) => setRenameText(e.target.value)}
                    placeholder="Enter new title"
                  />
                  <button
                    type="button"
                    onClick={applyRename}
                    className="btn-primary"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRenamingId(null); setRenameText(''); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={chatRef} className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 bg-secondary-50/40">
              {messages.map((m, idx) => {
                if (m.role === 'event') {
                  return (
                    <div key={idx} className="flex justify-center">
                      <div className="w-full max-w-[85%] rounded-xl border border-secondary-200 bg-secondary-100/70 px-4 py-3 text-xs text-secondary-800">
                        <div className="font-semibold text-secondary-900">{m.title || 'Event'}</div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-secondary-700">View data sent to AI</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-xs text-secondary-800">{m.content}</pre>
                        </details>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      m.role === 'user'
                        ? 'bg-primary-600 text-white rounded-br-none'
                        : 'bg-white text-secondary-900 border border-secondary-200 rounded-bl-none'
                    }`}
                    >
                      {m.role === 'assistant' ? (
                        <ReactMarkdown allowedElements={['p','strong','em','ul','li','br']}>
                          {m.content}
                        </ReactMarkdown>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-2 rounded-2xl bg-white border border-secondary-200 text-secondary-600 text-sm animate-pulse">
                    Thinking…
                  </div>
                </div>
              )}

              {!loading && lastError && lastUserText && (
                <div className="flex justify-start">
                  <button
                    type="button"
                    onClick={() => doSend(lastUserText)}
                    className="btn-secondary"
                  >
                    Retry last message
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-secondary-200 bg-white">
              <form
                onSubmit={sendMessage}
                className="flex items-end gap-3"
              >
                <textarea
                  rows={2}
                  className="flex-1 input resize-none"
                  placeholder="Ask about budgets, spending, or categories…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (loading) return;
                      const text = input.trim();
                      if (!text) return;
                      setLastUserText(text);
                      doSend(text);
                    }
                  }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  title="Send"
                >
                  {loading ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <PaperAirplaneIcon className="h-5 w-5" />
                  )}
                  <span>{loading ? 'Sending' : 'Send'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {showGrowwStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-secondary-900/50">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-secondary-200">
            <div className="p-4 border-b border-secondary-200 flex items-center justify-between gap-3">
              <div className="font-semibold text-secondary-900">Ask about a Groww stock</div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowGrowwStockModal(false)}
                disabled={loadingGrowwHoldingsList || loadingGrowwStock}
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-4">
              {growwStockError && (
                <div className="text-sm text-red-600">{growwStockError}</div>
              )}
              {Array.isArray(growwIntegration?.accounts) && growwIntegration.accounts.length > 1 && (
                <div className="space-y-1">
                  <div className="text-sm font-medium text-secondary-800">Account</div>
                  <select
                    className="input"
                    value={selectedGrowwAccountId}
                    onChange={async (e) => {
                      const id = e.target.value;
                      setSelectedGrowwAccountId(id);
                      setSelectedGrowwTradingSymbol('');
                      await loadGrowwHoldingsList(id);
                    }}
                    disabled={loadingGrowwHoldingsList || loadingGrowwStock}
                  >
                    {growwIntegration.accounts
                      .filter((a) => a?.connected)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label || a.id}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-sm font-medium text-secondary-800">Stock</div>
                <select
                  className="input"
                  value={selectedGrowwTradingSymbol}
                  onChange={(e) => setSelectedGrowwTradingSymbol(e.target.value)}
                  disabled={loadingGrowwHoldingsList || loadingGrowwStock}
                >
                  {loadingGrowwHoldingsList ? (
                    <option value="">Loading holdings…</option>
                  ) : growwHoldingsList.length === 0 ? (
                    <option value="">No holdings found</option>
                  ) : (
                    growwHoldingsList.map((h) => (
                      <option key={h.tradingSymbol} value={h.tradingSymbol}>
                        {h.tradingSymbol} · PnL {formatMoneyInr(h.pnl)} · Inv {formatMoneyInr(h.invested)}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium text-secondary-800">Range</div>
                <select
                  className="input"
                  value={String(growwStockDays)}
                  onChange={(e) => setGrowwStockDays(Number(e.target.value))}
                  disabled={loadingGrowwHoldingsList || loadingGrowwStock}
                >
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="180">Last 180 days</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-secondary-200 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowGrowwStockModal(false)}
                disabled={loadingGrowwHoldingsList || loadingGrowwStock}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={askAiAboutGrowwStock}
                disabled={!selectedGrowwTradingSymbol || loadingGrowwHoldingsList || loadingGrowwStock}
              >
                {loadingGrowwStock ? 'Fetching…' : 'Ask AI'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assistant;
