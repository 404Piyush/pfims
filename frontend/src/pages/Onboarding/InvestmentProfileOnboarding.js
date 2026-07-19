import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { RadioGroup } from '@headlessui/react';
import { clsx } from 'clsx';
import { toast } from 'react-hot-toast';
import { CheckIcon } from '@heroicons/react/24/outline';
import { saveInvestmentProfile } from '../../store/slices/authSlice';
import Modal from '../../components/ui/Modal';
import AuroraScreen from '../../components/layout/AuroraScreen';
import AuroraCard from '../../components/ui/AuroraCard';
import api from '../../services/api';

const steps = [
  {
    key: 'riskTolerance',
    title: 'Risk tolerance',
    subtitle: 'How do you feel if your investments go down temporarily?',
    options: [
      { value: 1, title: 'Very low', description: 'I can’t tolerate losses' },
      { value: 2, title: 'Low', description: 'Small losses are acceptable' },
      { value: 3, title: 'Medium', description: 'I can handle fluctuations' },
      { value: 4, title: 'High', description: 'I’m fine with volatility for higher returns' },
    ],
  },
  {
    key: 'investmentDuration',
    title: 'Investment horizon',
    subtitle: 'How long can you stay invested without needing the money?',
    options: [
      { value: 1, title: '< 1 year', description: 'I may need it soon' },
      { value: 2, title: '1–3 years', description: 'Short-term goal' },
      { value: 3, title: '3–5 years', description: 'Medium-term goal' },
      { value: 4, title: '5+ years', description: 'Long-term wealth creation' },
    ],
  },
  {
    key: 'savingsCapacity',
    title: 'Savings capacity',
    subtitle: 'How much can you invest regularly after expenses?',
    options: [
      { value: 1, title: '< 10%', description: 'Limited investable surplus' },
      { value: 2, title: '10–20%', description: 'Some surplus available' },
      { value: 3, title: '20–30%', description: 'Comfortable surplus' },
      { value: 4, title: '30%+', description: 'Strong savings rate' },
    ],
  },
  {
    key: 'financialGoal',
    title: 'Primary goal',
    subtitle: 'What is your main goal for investing? (Select all that apply)',
    options: [
      { value: 1, title: 'Emergency fund', description: 'Stability and liquidity first' },
      { value: 2, title: 'Near-term purchase', description: 'Need the money in the next few years' },
      { value: 3, title: 'Wealth creation', description: 'Balanced growth over time' },
      { value: 4, title: 'Retirement', description: 'Long-term compounding' },
    ],
  },
];

function allocationLabelMap() {
  return [
    { key: 'largeCap', label: 'Large-cap', color: 'bg-primary-600' },
    { key: 'midCap', label: 'Mid-cap', color: 'bg-indigo-600' },
    { key: 'smallCap', label: 'Small-cap', color: 'bg-fuchsia-600' },
    { key: 'bonds', label: 'Bonds/Debt', color: 'bg-emerald-600' },
    { key: 'liquidFund', label: 'Liquid', color: 'bg-amber-600' },
  ];
}

const InvestmentProfileOnboarding = ({ embedded = false, title = 'Investment questionnaire', subtitle = 'Tap to select. Primary goal supports multiple selections.', continueTo } = {}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState(() => ({
    riskTolerance: user?.investmentProfile?.answers?.riskTolerance ?? null,
    investmentDuration: user?.investmentProfile?.answers?.investmentDuration ?? null,
    savingsCapacity: user?.investmentProfile?.answers?.savingsCapacity ?? null,
    financialGoals:
      user?.investmentProfile?.answers?.financialGoals?.length
        ? user.investmentProfile.answers.financialGoals
        : (user?.investmentProfile?.answers?.financialGoal ? [user.investmentProfile.answers.financialGoal] : []),
    age: user?.investmentProfile?.answers?.age ?? '',
    hasEmergencyFund: typeof user?.investmentProfile?.answers?.hasEmergencyFund === 'boolean'
      ? user.investmentProfile.answers.hasEmergencyFund
      : true,
    hasHighInterestDebt: typeof user?.investmentProfile?.answers?.hasHighInterestDebt === 'boolean'
      ? user.investmentProfile.answers.hasHighInterestDebt
      : false,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(user?.investmentProfile || null);
  const [prefetched, setPrefetched] = useState(false);
  const [selectedBucketKey, setSelectedBucketKey] = useState(null);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorPrincipal, setCalculatorPrincipal] = useState('');
  const [calculatorPercents, setCalculatorPercents] = useState({});

  const bucketLists = useMemo(() => {
    const mf = result?.mutualFunds;
    if (Array.isArray(mf?.buckets) && mf.buckets.length) return mf.buckets;
    if (Array.isArray(mf?.items) && mf.items.length) return [{ key: 'all', label: 'All', weight: 0, items: mf.items }];
    return [];
  }, [result]);

  const selectedBucket = useMemo(() => {
    if (!bucketLists.length) return null;
    return bucketLists.find((b) => b.key === selectedBucketKey) || bucketLists[0] || null;
  }, [bucketLists, selectedBucketKey]);

  const openCalculator = () => {
    if (!result?.allocation) return;
    const nextPercents = {};
    for (const row of allocationLabelMap()) {
      nextPercents[row.key] = String(Number(result.allocation?.[row.key] ?? 0));
    }
    setCalculatorPercents(nextPercents);
    setCalculatorPrincipal('');
    setCalculatorOpen(true);
  };

  const formatInr = (v) => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  };

  const principalValue = useMemo(() => {
    const n = Number(String(calculatorPrincipal || '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : 0;
  }, [calculatorPrincipal]);

  const calculatorTotalPercent = useMemo(() => {
    return allocationLabelMap().reduce((sum, row) => sum + Number(calculatorPercents?.[row.key] ?? 0), 0);
  }, [calculatorPercents]);

  const calculatorPlan = useMemo(() => {
    return allocationLabelMap()
      .map((typeRow) => {
        const pct = Number(calculatorPercents?.[typeRow.key] ?? 0);
        const amount = principalValue > 0 ? (principalValue * pct) / 100 : 0;
        const matchingBucket =
          bucketLists.find((b) => b.key === typeRow.key) ||
          bucketLists.find((b) => String(b.label || '').toLowerCase() === String(typeRow.label || '').toLowerCase()) ||
          null;
        const picks = Array.isArray(matchingBucket?.items) ? matchingBucket.items.slice(0, 2) : [];
        const perPickAmount = picks.length ? amount / picks.length : 0;
        return { ...typeRow, pct, amount, picks, perPickAmount, bucketLabel: matchingBucket?.label || typeRow.label };
      });
  }, [bucketLists, calculatorPercents, principalValue]);

  useEffect(() => {
    if (!bucketLists.length) return;

    const preferred = allocationLabelMap()
      .map((row) => ({
        key: row.key,
        v: Number(result?.allocation?.[row.key] ?? 0),
      }))
      .sort((a, b) => b.v - a.v)[0]?.key;

    const nextKey = bucketLists.some((b) => b.key === preferred) ? preferred : bucketLists[0].key;
    setSelectedBucketKey((prev) => (prev && bucketLists.some((b) => b.key === prev) ? prev : nextKey));
  }, [bucketLists, result?.allocation]);

  useEffect(() => {
    const onboardingComplete = Boolean(user?.onboarding?.investmentProfileCompleted);
    if (!onboardingComplete) return;
    if (prefetched) return;

    let active = true;
    (async () => {
      try {
        const res = await api.get('/users/investment-profile', { skipErrorToast: true });
        const investmentProfile = res?.data?.investmentProfile || res?.data?.user?.investmentProfile || null;
        const mutualFunds = res?.data?.mutualFunds || null;
        if (!active) return;
        if (investmentProfile) {
          setResult({ ...investmentProfile, mutualFunds });
        } else {
          setResult(null);
        }
        setPrefetched(true);
      } catch (e) {
        if (!active) return;
        setPrefetched(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [prefetched, user?.onboarding?.investmentProfileCompleted]);

  const progress = useMemo(() => {
    if (result) return 100;
    const total = steps.length + 1;
    return Math.round(((currentStepIndex + 1) / total) * 100);
  }, [currentStepIndex, result]);

  const canGoNext = useMemo(() => {
    if (result) return true;
    if (currentStepIndex < steps.length) {
      const key = steps[currentStepIndex].key;
      if (key === 'financialGoal') {
        return Array.isArray(answers.financialGoals) && answers.financialGoals.length > 0;
      }
      return Number.isFinite(answers[key]) && answers[key] >= 1 && answers[key] <= 4;
    }
    const ageNum = Number(answers.age);
    return Number.isFinite(ageNum) && ageNum >= 0 && ageNum <= 150;
  }, [answers, currentStepIndex, result]);

  const handleNext = () => {
    if (!canGoNext) return;
    setCurrentStepIndex((i) => Math.min(i + 1, steps.length));
  };

  const handleBack = () => {
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async () => {
    const payload = {
      riskTolerance: Number(answers.riskTolerance),
      investmentDuration: Number(answers.investmentDuration),
      savingsCapacity: Number(answers.savingsCapacity),
      financialGoals: Array.isArray(answers.financialGoals) ? answers.financialGoals : [],
      age: Number(answers.age),
      hasEmergencyFund: Boolean(answers.hasEmergencyFund),
      hasHighInterestDebt: Boolean(answers.hasHighInterestDebt),
    };

    const requiredOk = ['riskTolerance', 'investmentDuration', 'savingsCapacity']
      .every((k) => Number.isFinite(payload[k]) && payload[k] >= 1 && payload[k] <= 4);
    const goalsOk =
      Array.isArray(payload.financialGoals) &&
      payload.financialGoals.length > 0 &&
      payload.financialGoals.every((g) => Number.isFinite(g) && g >= 1 && g <= 4);
    const ageOk = Number.isFinite(payload.age) && payload.age >= 0 && payload.age <= 150;
    if (!requiredOk || !goalsOk || !ageOk) {
      toast.error('Please answer all questions');
      return;
    }

    setSubmitting(true);
    try {
      const res = await dispatch(saveInvestmentProfile(payload)).unwrap();
      const investmentProfile = res?.investmentProfile || res?.user?.investmentProfile || null;
      const mutualFunds = res?.mutualFunds || null;
      setResult(investmentProfile ? { ...investmentProfile, mutualFunds } : null);
      setPrefetched(true);
    } catch (e) {
      toast.error(typeof e === 'string' ? e : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const finish = () => {
    if (embedded) {
      navigate(continueTo || '/', { replace: true });
      return;
    }
    if (continueTo) {
      navigate(continueTo, { replace: true });
      return;
    }
    const from = location.state?.from?.pathname || '/';
    navigate(from, { replace: true });
  };

  const header = (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={clsx('text-2xl font-bold', embedded ? 'text-secondary-900' : 'text-white')}>{title}</h1>
            {String(title || '').toLowerCase().includes('mutual funds') ? (
              <button
                type="button"
                onClick={openCalculator}
                disabled={!result?.allocation || !bucketLists.length}
                className={clsx(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition',
                  result?.allocation && bucketLists.length
                    ? 'border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100'
                    : 'border-white/20 bg-white/10 text-white/60 cursor-not-allowed'
                )}
              >
                Calculator
              </button>
            ) : null}
          </div>
          <p className={clsx('mt-1', embedded ? 'text-secondary-600' : 'text-white/75')}>{subtitle}</p>
        </div>
        <div className="text-right">
          <div className={clsx('text-xs', embedded ? 'text-secondary-500' : 'text-white/60')}>Progress</div>
          <div className={clsx('text-sm font-semibold tabular-nums', embedded ? 'text-secondary-900' : 'text-white')}>{progress}%</div>
        </div>
      </div>
      <div className={clsx('mt-4 h-2 w-full rounded-full overflow-hidden', embedded ? 'bg-secondary-200' : 'bg-white/15')}>
        <div className="h-full bg-gradient-to-r from-brand-indigo via-brand-cyan to-brand-pink rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );

  const content = (
    <div className={clsx(embedded ? 'py-4 text-ink-950' : 'px-4 sm:px-6 lg:px-8 py-10 text-white')}>
      <div className={clsx(embedded ? 'max-w-6xl mx-auto' : 'max-w-3xl mx-auto')}>
        {header}

        {result ? (
          <AuroraCard accent="cyan" className="p-6 sm:p-8 text-ink-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-secondary-900">
                  {result.status === 'blocked' ? 'Action required' : `Profile: ${result.profile || '—'}`}
                </h3>
                <p className="text-secondary-600 mt-1">{result.explanation || ''}</p>
              </div>
              {typeof result.score === 'number' ? (
                <div className="text-right">
                  <div className="text-xs text-secondary-500">Score</div>
                  <div className="text-lg font-bold text-secondary-900">{result.score}</div>
                </div>
              ) : null}
            </div>

            {result.status !== 'blocked' && result.allocation ? (
              <div className="mt-6 space-y-3">
                {allocationLabelMap().map((row) => {
                  const v = Number(result.allocation?.[row.key] ?? 0);
                  const active = row.key === selectedBucketKey;
                  return (
                    <div
                      key={row.key}
                      className={clsx('flex items-center gap-3 rounded-lg px-2 py-1', active && 'bg-secondary-50')}
                      onClick={() => setSelectedBucketKey(row.key)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="w-24 text-sm font-medium text-secondary-800">{row.label}</div>
                      <div className="flex-1 h-2 rounded-full bg-secondary-200 overflow-hidden">
                        <div className={clsx('h-full rounded-full', row.color)} style={{ width: `${v}%` }} />
                      </div>
                      <div className="w-12 text-right text-sm font-semibold text-secondary-900">{v}%</div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {result.status !== 'blocked' && result.mutualFunds?.error ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {String(result.mutualFunds.error)}
              </div>
            ) : null}

            {result.status !== 'blocked' && selectedBucket && Array.isArray(selectedBucket.items) && selectedBucket.items.length ? (
              <div className="mt-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-secondary-900">Top 10: {selectedBucket.label}</div>
                    <div className="text-xs text-secondary-500">
                      Ranked best fit → worst fit · Source: {String(result.mutualFunds.source || '')}
                    </div>
                  </div>
                  <div className="text-xs text-secondary-500">
                    Generated: {String(result.mutualFunds.generatedAt || '')}
                  </div>
                </div>

                {bucketLists.length > 1 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bucketLists.map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setSelectedBucketKey(b.key)}
                        className={clsx(
                          'rounded-full border px-3 py-1 text-xs font-semibold transition',
                          b.key === selectedBucket.key
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-secondary-200 bg-white text-secondary-700 hover:border-secondary-300'
                        )}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 rounded-2xl border border-secondary-200 bg-white overflow-hidden">
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-[900px] w-full text-sm">
                      <thead className="bg-secondary-50 text-secondary-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold w-12">#</th>
                          <th className="px-4 py-3 text-left font-semibold min-w-[320px]">Scheme</th>
                          <th className="px-4 py-3 text-left font-semibold min-w-[220px]">Category</th>
                          <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">1Y</th>
                          <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">3Y CAGR</th>
                          <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">5Y CAGR</th>
                          <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Fit</th>
                          <th className="px-4 py-3 text-left font-semibold min-w-[260px]">Why</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100">
                        {selectedBucket.items.slice(0, 10).map((row) => {
                          const numOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : '—');
                          const pctOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? `${v}%` : '—');
                          const schemeUrl = row?.schemeCode ? `https://www.mfapi.in/mf/${row.schemeCode}` : null;
                          const rank = Number(row.rank);
                          const rankTone = rank <= 3 ? 'bg-emerald-600 text-white' : rank <= 7 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white';
                          const rowBg =
                            rank <= 3 ? 'bg-emerald-50/40' : rank <= 7 ? 'bg-amber-50/40' : 'bg-rose-50/30';
                          return (
                            <tr key={`${row.schemeCode}-${row.rank}`} className={clsx('hover:bg-secondary-50', rowBg)}>
                              <td className="px-4 py-3">
                                <span className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums', rankTone)}>
                                  {row.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="min-w-0">
                                  {schemeUrl ? (
                                    <a
                                      className="block font-semibold text-secondary-900 hover:text-primary-700 truncate"
                                      href={schemeUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={row.schemeName}
                                    >
                                      {row.schemeName}
                                    </a>
                                  ) : (
                                    <div className="font-semibold text-secondary-900 truncate" title={row.schemeName}>
                                      {row.schemeName}
                                    </div>
                                  )}
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="inline-flex items-center rounded-full bg-secondary-100 px-2 py-0.5 font-medium text-secondary-700">
                                      {row.bucket || selectedBucket.label}
                                    </span>
                                    <span className="text-secondary-600 truncate" title={row.fundHouse || ''}>
                                      {row.fundHouse || '—'}
                                    </span>
                                    <span className="text-secondary-400">•</span>
                                    <span className="font-mono text-secondary-600">{row.schemeCode}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-secondary-700">
                                <div className="max-w-[320px] truncate" title={row.schemeCategory || ''}>
                                  {row.schemeCategory || '—'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-secondary-900 tabular-nums">{pctOrDash(row.return1yPct)}</td>
                              <td className="px-4 py-3 text-right text-secondary-900 tabular-nums">{pctOrDash(row.cagr3yPct)}</td>
                              <td className="px-4 py-3 text-right text-secondary-900 tabular-nums">{pctOrDash(row.cagr5yPct)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 font-semibold text-primary-700">
                                  {numOrDash(row.fitScore)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-secondary-700">
                                {row.why ? (
                                  <div className="max-w-[340px] whitespace-normal break-words text-xs leading-5" title={row.why}>
                                    <div className="space-y-1">
                                      {String(row.why)
                                        .split('•')
                                        .map((part) => part.trim())
                                        .filter(Boolean)
                                        .map((part, i) => (
                                          <div key={`${row.schemeCode || 'row'}-why-${i}`} className="flex gap-2">
                                            <span className="text-secondary-400">•</span>
                                            <span className="min-w-0">{part}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-secondary-500">—</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden divide-y divide-secondary-100">
                    {selectedBucket.items.slice(0, 10).map((row) => {
                      const numOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : '—');
                      const pctOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? `${v}%` : '—');
                      const schemeUrl = row?.schemeCode ? `https://www.mfapi.in/mf/${row.schemeCode}` : null;
                      const rank = Number(row.rank);
                      const rankTone = rank <= 3 ? 'bg-emerald-600 text-white' : rank <= 7 ? 'bg-amber-500 text-white' : 'bg-rose-600 text-white';
                      return (
                        <div
                          key={`${row.schemeCode}-${row.rank}`}
                          className={clsx('p-4', rank <= 3 ? 'bg-emerald-50/30' : rank <= 7 ? 'bg-amber-50/30' : 'bg-rose-50/20')}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={clsx('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold tabular-nums', rankTone)}>
                                  {row.rank}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-secondary-100 px-2 py-0.5 text-xs font-semibold text-secondary-700">
                                  {row.bucket || selectedBucket.label}
                                </span>
                              </div>
                              {schemeUrl ? (
                                <a
                                  className="mt-1 block font-semibold text-secondary-900 hover:text-primary-700"
                                  href={schemeUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {row.schemeName}
                                </a>
                              ) : (
                                <div className="mt-1 font-semibold text-secondary-900">{row.schemeName}</div>
                              )}
                              <div className="mt-1 text-xs text-secondary-600">
                                <span className="font-mono">{row.schemeCode}</span>
                                <span className="text-secondary-400"> · </span>
                                <span className="truncate">{row.fundHouse || '—'}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                                Fit {numOrDash(row.fitScore)}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-lg bg-secondary-50 px-3 py-2">
                              <div className="text-secondary-500">1Y</div>
                              <div className="mt-0.5 font-semibold text-secondary-900 tabular-nums">{pctOrDash(row.return1yPct)}</div>
                            </div>
                            <div className="rounded-lg bg-secondary-50 px-3 py-2">
                              <div className="text-secondary-500">3Y CAGR</div>
                              <div className="mt-0.5 font-semibold text-secondary-900 tabular-nums">{pctOrDash(row.cagr3yPct)}</div>
                            </div>
                            <div className="rounded-lg bg-secondary-50 px-3 py-2">
                              <div className="text-secondary-500">5Y CAGR</div>
                              <div className="mt-0.5 font-semibold text-secondary-900 tabular-nums">{pctOrDash(row.cagr5yPct)}</div>
                            </div>
                          </div>

                          <div className="mt-3 text-xs text-secondary-600">
                            <div className="font-semibold text-secondary-700">Category</div>
                            <div className="mt-0.5">{row.schemeCategory || '—'}</div>
                          </div>

                          {row.why ? (
                            <div className="mt-3 text-xs text-secondary-600">
                              <div className="font-semibold text-secondary-700">Why</div>
                              <div className="mt-0.5 space-y-1">
                                {String(row.why)
                                  .split('•')
                                  .map((part) => part.trim())
                                  .filter(Boolean)
                                  .map((part, i) => (
                                    <div key={`${row.schemeCode || 'row'}-why-mobile-${i}`} className="flex gap-2">
                                      <span className="text-secondary-400">•</span>
                                      <span className="min-w-0 break-words">{part}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            <Modal
              isOpen={calculatorOpen}
              onClose={() => setCalculatorOpen(false)}
              title="Mutual Funds Allocation Calculator"
              size="lg"
            >
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700">Principal amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={calculatorPrincipal}
                      onChange={(e) => setCalculatorPrincipal(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-secondary-200 bg-white px-3 py-2 text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="100000"
                    />
                    <div className="mt-1 text-xs text-secondary-500">Invested total: {formatInr(principalValue)}</div>
                  </div>
                  <div className="rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3">
                    <div className="text-sm font-semibold text-secondary-900">Allocation</div>
                    <div className={clsx('mt-1 text-xs font-semibold', Math.round(calculatorTotalPercent) === 100 ? 'text-emerald-700' : 'text-amber-700')}>
                      Total: {Math.round(calculatorTotalPercent * 10) / 10}%
                    </div>
                    <div className="mt-1 text-xs text-secondary-600">Uses the shown percentages; adjust if needed.</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-secondary-200 overflow-hidden">
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-[840px] w-full text-sm">
                      <thead className="bg-secondary-50 text-secondary-700">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Type</th>
                          <th className="px-4 py-3 text-right font-semibold w-36">Percent</th>
                          <th className="px-4 py-3 text-right font-semibold w-48">Amount</th>
                          <th className="px-4 py-3 text-left font-semibold min-w-[360px]">Top 2 funds</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-secondary-100 bg-white">
                        {calculatorPlan.map((row) => (
                          <tr key={row.key} className="hover:bg-secondary-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={clsx('h-2.5 w-2.5 rounded-full', row.color)} />
                                <span className="font-semibold text-secondary-900">{row.label}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={calculatorPercents?.[row.key] ?? ''}
                                  onChange={(e) => setCalculatorPercents((prev) => ({ ...(prev || {}), [row.key]: e.target.value }))}
                                  className="w-28 rounded-lg border border-secondary-200 bg-white px-3 py-1.5 text-right text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                                <span className="ml-2 mt-1 text-secondary-500">%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-secondary-900 tabular-nums">{formatInr(row.amount)}</td>
                            <td className="px-4 py-3 text-secondary-700">
                              {row.picks.length ? (
                                <div className="space-y-1">
                                  {row.picks.map((p) => (
                                    <div key={String(p.schemeCode || p.schemeName)} className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="truncate font-semibold text-secondary-900">{p.schemeName || '—'}</div>
                                        <div className="text-xs text-secondary-500 truncate">{p.fundHouse || ''}</div>
                                      </div>
                                      <div className="shrink-0 text-sm font-semibold text-secondary-900 tabular-nums">{formatInr(row.perPickAmount)}</div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-secondary-500">No fund recommendations available for this type.</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sm:hidden divide-y divide-secondary-100 bg-white">
                    {calculatorPlan.map((row) => (
                      <div key={row.key} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={clsx('h-2.5 w-2.5 rounded-full', row.color)} />
                              <div className="font-semibold text-secondary-900">{row.label}</div>
                            </div>
                            <div className="mt-1 text-xs text-secondary-600">Amount: {formatInr(row.amount)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={calculatorPercents?.[row.key] ?? ''}
                              onChange={(e) => setCalculatorPercents((prev) => ({ ...(prev || {}), [row.key]: e.target.value }))}
                              className="w-20 rounded-lg border border-secondary-200 bg-white px-2 py-1 text-right text-sm text-secondary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                            <span className="text-xs font-semibold text-secondary-500">%</span>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {row.picks.length ? (
                            row.picks.map((p) => (
                              <div key={String(p.schemeCode || p.schemeName)} className="rounded-xl border border-secondary-200 bg-secondary-50 px-3 py-2">
                                <div className="text-sm font-semibold text-secondary-900">{p.schemeName || '—'}</div>
                                <div className="mt-0.5 flex items-center justify-between gap-3 text-xs text-secondary-600">
                                  <div className="truncate">{p.fundHouse || ''}</div>
                                  <div className="shrink-0 font-semibold text-secondary-900 tabular-nums">{formatInr(row.perPickAmount)}</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-secondary-500">No fund recommendations available for this type.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setCalculatorOpen(false)}
                    className="rounded-xl border border-secondary-200 bg-white px-4 py-2 text-sm font-semibold text-secondary-700 hover:bg-secondary-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Modal>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setResult(null);
                  setCurrentStepIndex(0);
                }}
              >
                Edit answers
              </button>
              <button type="button" className="btn-primary" onClick={finish}>
                Continue
              </button>
            </div>
          </AuroraCard>
        ) : (
          <AuroraCard accent="indigo" className="overflow-hidden text-ink-950">
            {currentStepIndex < steps.length ? (
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <div className="text-sm font-semibold text-primary-700">
                    Question {currentStepIndex + 1} of {steps.length}
                  </div>
                  <h2 className="text-xl font-semibold text-secondary-900 mt-1">{steps[currentStepIndex].title}</h2>
                  <p className="text-secondary-600 mt-1">{steps[currentStepIndex].subtitle}</p>
                </div>

                {steps[currentStepIndex].key === 'financialGoal' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {steps[currentStepIndex].options.map((opt) => {
                      const selected = Array.isArray(answers.financialGoals) && answers.financialGoals.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setAnswers((prev) => {
                              const current = Array.isArray(prev.financialGoals) ? prev.financialGoals : [];
                              const next = current.includes(opt.value)
                                ? current.filter((v) => v !== opt.value)
                                : [...current, opt.value];
                              return { ...prev, financialGoals: next };
                            });
                          }}
                          className={clsx(
                            'text-left rounded-xl border p-4 transition',
                            selected
                              ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50'
                              : 'border-secondary-200 hover:border-secondary-300 bg-white'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={clsx(
                                'mt-0.5 h-5 w-5 rounded border flex items-center justify-center',
                                selected ? 'border-primary-600 bg-primary-600' : 'border-secondary-300 bg-white'
                              )}
                            >
                              {selected ? <CheckIcon className="h-4 w-4 text-white" /> : null}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-secondary-900">{opt.title}</div>
                              <div className="text-sm text-secondary-600 mt-0.5">{opt.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <RadioGroup
                    value={answers[steps[currentStepIndex].key]}
                    onChange={(v) => setAnswers((prev) => ({ ...prev, [steps[currentStepIndex].key]: v }))}
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {steps[currentStepIndex].options.map((opt) => (
                        <RadioGroup.Option
                          key={opt.value}
                          value={opt.value}
                          className={({ checked }) =>
                            clsx(
                              'relative cursor-pointer rounded-xl border p-4 transition',
                              checked
                                ? 'border-primary-500 ring-2 ring-primary-200 bg-primary-50'
                                : 'border-secondary-200 hover:border-secondary-300 bg-white'
                            )
                          }
                        >
                          {({ checked }) => (
                            <div className="flex items-start gap-3">
                              <div
                                className={clsx(
                                  'mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center',
                                  checked ? 'border-primary-600 bg-primary-600' : 'border-secondary-300 bg-white'
                                )}
                              >
                                {checked ? <CheckIcon className="h-4 w-4 text-white" /> : null}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-secondary-900">{opt.title}</div>
                                <div className="text-sm text-secondary-600 mt-0.5">{opt.description}</div>
                              </div>
                            </div>
                          )}
                        </RadioGroup.Option>
                      ))}
                    </div>
                  </RadioGroup>
                )}

                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleBack}
                    disabled={currentStepIndex === 0}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={!canGoNext}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8">
                <div className="mb-6">
                  <div className="text-sm font-semibold text-primary-700">Final step</div>
                  <h2 className="text-xl font-semibold text-secondary-900 mt-1">A few quick details</h2>
                  <p className="text-secondary-600 mt-1">These help fine-tune the allocation.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-secondary-700 mb-2">Age</label>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      className="input"
                      value={answers.age}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, age: e.target.value }))}
                      placeholder="e.g. 24"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border border-secondary-200 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold text-secondary-900">Emergency fund</div>
                        <div className="text-xs text-secondary-600">3–6 months expenses saved</div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={answers.hasEmergencyFund}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, hasEmergencyFund: e.target.checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border border-secondary-200 rounded-xl">
                      <div>
                        <div className="text-sm font-semibold text-secondary-900">High-interest debt</div>
                        <div className="text-xs text-secondary-600">Credit card / personal loan</div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={answers.hasHighInterestDebt}
                        onChange={(e) => setAnswers((prev) => ({ ...prev, hasHighInterestDebt: e.target.checked }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button type="button" className="btn-secondary" onClick={handleBack}>
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSubmit}
                    disabled={!canGoNext || submitting}
                  >
                    {submitting ? 'Saving…' : 'Get my recommendation'}
                  </button>
                </div>
              </div>
            )}
          </AuroraCard>
        )}
      </div>
    </div>
  );

  return embedded ? content : <AuroraScreen>{content}</AuroraScreen>;
};

export default InvestmentProfileOnboarding;
