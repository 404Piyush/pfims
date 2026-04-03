import { useEffect, useMemo, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import api from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';

ChartJS.register(ArcElement, Tooltip, Legend);

const MARKET_TABS = [
  { key: 'SP500', label: 'S&P 500' },
  { key: 'NASDAQ', label: 'NASDAQ' },
  { key: 'BSE', label: 'BSE' },
];

const sentimentClasses = (label) => {
  const value = String(label || '').toUpperCase();
  if (value === 'BULLISH') return 'bg-success-50 border-success-200 text-success-800';
  if (value === 'BEARISH') return 'bg-danger-50 border-danger-200 text-danger-800';
  return 'bg-warning-50 border-warning-200 text-warning-800';
};

const recommendationClasses = (recommendation) => {
  const value = String(recommendation || '').toUpperCase();
  if (value === 'BUY') return 'bg-success-100 text-success-800 border-success-200';
  if (value === 'SELL') return 'bg-danger-100 text-danger-800 border-danger-200';
  return 'bg-warning-100 text-warning-800 border-warning-200';
};

const recommendationLabel = (recommendation, sectors) => {
  const value = String(recommendation || '').toUpperCase();
  if (value === 'HOLD' && Array.isArray(sectors) && sectors.length) {
    return 'HOLD + BUY FOCUS';
  }
  return value || 'HOLD';
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

const trendClasses = (value) => {
  if (Number(value) > 0.2) return 'text-success-700';
  if (Number(value) < -0.2) return 'text-danger-700';
  return 'text-warning-700';
};

const formatTrend = (value) => {
  const amount = Number(value) || 0;
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${amount.toFixed(2)}%`;
};

const MarketNewsIntelligence = () => {
  const [market, setMarket] = useState('BSE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/market-news-intelligence', {
          params: { market },
          timeout: 45000,
        });
        setResult(response.data);
      } catch (requestError) {
        setResult(null);
        setError(requestError?.response?.data?.message || 'Failed to fetch market news intelligence');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [market]);

  const chartData = useMemo(() => {
    const series = Array.isArray(result?.sectorImpact) ? result.sectorImpact.slice(0, 15) : [];
    return {
      labels: series.map((item) => item.sector),
      datasets: [
        {
          label: 'Impact %',
          data: series.map((item) => Number(item.impact) || 0),
          backgroundColor: (result?.chartColors || ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed']).slice(0, series.length),
          borderWidth: 1,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [result]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 8,
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed}%`,
        },
      },
    },
    animation: {
      duration: 450,
    },
  }), []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
        <h1 className="text-xl font-semibold text-secondary-900">Market News Intelligence</h1>
        <p className="text-sm text-secondary-600 mt-1">
          Latest market headlines, FinBERT sentiment and sector impact intelligence
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {MARKET_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMarket(tab.key)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium ${
                market === tab.key
                  ? 'bg-primary-100 text-primary-700 border-primary-200'
                  : 'bg-white text-secondary-700 border-secondary-200 hover:bg-secondary-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
          <LoadingSpinner text="Loading market intelligence..." />
        </div>
      ) : null}

      {error ? (
        <div className="bg-danger-50 border border-danger-200 text-danger-800 rounded-xl p-4 text-sm">
          {error}
        </div>
      ) : null}

      {result && !loading ? (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`rounded-lg border p-4 ${sentimentClasses(result?.sentiment?.label)}`}>
                <div className="text-sm">Sentiment</div>
                <div className="text-xl font-semibold mt-1">{result?.sentiment?.label || 'Neutral'}</div>
                <div className="text-sm mt-1">Score: {result?.sentiment?.score ?? 0}</div>
              </div>
              <div className="rounded-lg border border-secondary-200 p-4">
                <div className="text-sm text-secondary-500">Recommendation</div>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full border text-sm font-semibold ${recommendationClasses(result?.sentiment?.recommendation)}`}>
                    {recommendationLabel(result?.sentiment?.recommendation, result?.sentiment?.recommendedSectorsToBuy)}
                  </span>
                </div>
                <div className="text-xs text-secondary-600 mt-2">{result?.sentiment?.sectorAdvice || '—'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(result?.sentiment?.recommendedSectorsToBuy || []).map((item) => (
                    <span
                      key={item.sector}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary-50 border border-primary-200 text-primary-700"
                    >
                      {item.sector} {item.impact}%
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-secondary-200 p-4">
                <div className="text-sm text-secondary-500">Last Updated</div>
                <div className="text-sm text-secondary-900 mt-1">{formatDate(result?.fetchedAt) || '—'}</div>
                <div className="text-xs text-secondary-500 mt-1">Source: {result?.source || '—'}</div>
                <div className="text-xs text-secondary-500 mt-1">Analyzed Headlines: {result?.analysisHeadlinesCount ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <h2 className="text-lg font-semibold text-secondary-900">Top Headlines</h2>
            <p className="text-sm text-secondary-600 mt-1">Showing top 15 headlines (analyzed from up to 100)</p>

            <div className="mt-4 space-y-3">
              {(result?.news || []).slice(0, 15).map((item, index) => (
                <a
                  key={`${item?.headline}-${index}`}
                  href={item?.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="block border border-secondary-200 rounded-lg p-4 hover:bg-secondary-50 transition-colors"
                >
                  <div className="font-medium text-secondary-900">{item?.headline || 'Untitled headline'}</div>
                  <div className="text-xs text-secondary-500 mt-1">
                    {item?.source || 'Unknown source'} {item?.publishedAt ? `· ${formatDate(item.publishedAt)}` : ''}
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-secondary-200 p-6">
            <h2 className="text-lg font-semibold text-secondary-900">Sector Allocation Insight</h2>
            <p className="text-sm text-secondary-600 mt-1">Top 15 sectors from keyword-driven analysis</p>
            <div className="mt-4" style={{ width: '100%', height: 320 }}>
              {Array.isArray(result?.sectorImpact) && result.sectorImpact.length ? (
                <Pie data={chartData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-secondary-600 border border-dashed border-secondary-300 rounded-lg">
                  No sector impact keywords found in current headlines
                </div>
              )}
            </div>

            {Array.isArray(result?.sectorImpact) && result.sectorImpact.length ? (
              <div className="mt-5 space-y-3">
                {result.sectorImpact.slice(0, 15).map((item) => (
                  <div key={item.sector} className="rounded-lg border border-secondary-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-secondary-900">{item.sector}</div>
                      <div className={`text-sm font-semibold ${trendClasses(item?.trendPercent)}`}>
                        {formatTrend(item?.trendPercent)}
                      </div>
                    </div>
                    <div className="mt-2 h-2.5 bg-secondary-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(4, Number(item?.impact) || 0))}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-secondary-600">
                      Impact {item.impact}% · Mentions {item.mentions ?? 0} · {item.trendLabel || 'Neutral'}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default MarketNewsIntelligence;
