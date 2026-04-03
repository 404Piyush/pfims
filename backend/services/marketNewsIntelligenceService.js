const YahooFinance = require('yahoo-finance2').default;

const yahooFinance = new YahooFinance();

const MARKET_CONFIG = {
  SP500: {
    market: 'S&P 500',
    keywords: ['US market', 'S&P 500', 'US economy'],
  },
  NASDAQ: {
    market: 'NASDAQ',
    keywords: ['tech stocks', 'NASDAQ', 'US tech'],
  },
  BSE: {
    market: 'BSE',
    keywords: ['Bombay Stock Exchange', 'Sensex', 'Indian stocks', 'India market', 'RBI', 'Indian economy', 'Nifty'],
    yahooQueries: ['Bombay Stock Exchange', 'Sensex', 'Nifty 50', 'Indian stock market', 'RBI policy', 'India equities'],
    enforceIndianOnly: true,
  },
};

const MARKET_ALIASES = {
  'S&P': 'SP500',
  'S&P500': 'SP500',
  SP500: 'SP500',
  NASDAQ: 'NASDAQ',
  BSE: 'BSE',
};

const SECTOR_KEYWORD_GROUPS = {
  'Financial Services': ['financial services', 'nbfc', 'credit', 'loan growth'],
  Brokers: ['broker', 'brokerage', 'trading platform'],
  'Ceramic Products': ['ceramic', 'tiles', 'sanitaryware'],
  'Marine Port & Services': ['port', 'harbour', 'marine logistics'],
  Paper: ['paper', 'pulp', 'packaging board'],
  'Agro Chemicals': ['agro chemical', 'pesticide', 'crop protection'],
  Engineering: ['engineering', 'industrial project', 'manufacturing order'],
  Trading: ['trading company', 'wholesale', 'distribution channel'],
  'Edible Oil': ['edible oil', 'palm oil', 'soy oil'],
  Shipping: ['shipping', 'freight', 'container rates'],
  Fertilizers: ['fertilizer', 'urea', 'potash'],
  Railways: ['railway', 'rail infra', 'rolling stock'],
  'Hotels & Restaurants': ['hotel', 'restaurant', 'hospitality'],
  'Infra Developers & Operators': ['infra developer', 'toll road', 'airport operator'],
  Education: ['education', 'edtech', 'learning platform'],
  Leather: ['leather', 'footwear export', 'tannery'],
  'Non-Ferrous Metals': ['non-ferrous', 'aluminium', 'copper'],
  'Ferro Alloys': ['ferro alloy', 'manganese alloy', 'chromite'],
  Chemicals: ['chemical', 'specialty chemical', 'petrochemical'],
  Logistics: ['logistics', 'supply chain', 'warehousing'],
  'Capital Goods (Non Electrical)': ['capital goods', 'heavy equipment', 'industrial machinery'],
  'Auto parts': ['auto part', 'component maker', 'oem supply'],
  Apparel: ['apparel', 'garment', 'fashion export'],
  Finance: ['finance', 'lending', 'credit cycle'],
  'Capital Goods (Electrical)': ['electrical equipment', 'transformer', 'switchgear'],
  Textiles: ['textile', 'yarn', 'fabric'],
  Realty: ['real estate', 'realty', 'property sales'],
  'Paints/Varnish': ['paint', 'coatings', 'varnish'],
  Electronics: ['electronics', 'ems', 'consumer electronics'],
  Banks: ['bank', 'banking', 'npa', 'net interest margin'],
  Sugar: ['sugar', 'ethanol blending', 'cane'],
  'IT - Software': ['it software', 'software services', 'digital transformation', 'cloud deal'],
  Mining: ['mining', 'ore', 'mineral'],
  'Telecom-Infra': ['telecom infra', 'tower company', 'fiber roll-out'],
  'Gas Distribution': ['city gas', 'gas distribution', 'png', 'cng'],
  'Oil Drilling': ['oil drilling', 'offshore rig', 'exploration'],
  Steel: ['steel', 'hot rolled coil', 'steel demand'],
  'Quick Service Restaurant': ['quick service restaurant', 'qsr', 'fast food chain'],
  FMCG: ['fmcg', 'consumer staples', 'household products'],
  Automobile: ['automobile', 'auto sales', 'passenger vehicle'],
  'Plantation Products': ['tea export', 'coffee export', 'plantation'],
  Tobacco: ['tobacco', 'cigarette', 'nicotine'],
  Insurance: ['insurance', 'premium growth', 'policy sales'],
  Healthcare: ['healthcare', 'hospital chain', 'medical devices'],
  'Oil & Gas': ['oil & gas', 'upstream', 'downstream', 'refinery'],
  'Consumer Durables': ['consumer durable', 'appliance demand', 'white goods'],
  'Plastic Products': ['plastic products', 'polymer', 'injection moulding'],
  'Telecom-Service': ['telecom service', 'mobile tariff', 'subscriber addition'],
  REITs: ['reit', 'office leasing', 'rental yield'],
  Pharmaceuticals: ['pharma', 'pharmaceutical', 'drug approval', 'generic medicine'],
  'Infra Investment Trusts': ['invit', 'infrastructure trust', 'yield vehicle'],
  Economy: ['inflation', 'gdp', 'economy', 'rbi policy', 'fiscal deficit'],
  Technology: ['tech', 'ai', 'semiconductor', 'software', 'digital'],
  Energy: ['oil', 'crude', 'gas', 'renewable energy', 'power demand'],
  Banking: ['lender', 'credit growth', 'bank earnings'],
};

const normalizeMarket = (market) => {
  const key = String(market || '').trim().toUpperCase();
  return MARKET_ALIASES[key] || null;
};

const recommendationFromScore = (score) => {
  if (score > 0.2) return { label: 'Bullish', recommendation: 'BUY' };
  if (score < -0.2) return { label: 'Bearish', recommendation: 'SELL' };
  return { label: 'Neutral', recommendation: 'HOLD' };
};

const toPercentage = (value) => Math.round(value * 100) / 100;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const DISPLAY_HEADLINES_COUNT = 15;
const ANALYSIS_HEADLINES_COUNT = 100;
const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed', '#0ea5e9', '#84cc16', '#14b8a6', '#f97316', '#22c55e', '#8b5cf6', '#eab308', '#06b6d4', '#ec4899', '#64748b'];
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsKeyword = (text, keyword) => {
  const sourceText = String(text || '').toLowerCase();
  const term = String(keyword || '').trim().toLowerCase();
  if (!term) return false;

  if (['bse', 'nse', 'rbi', 'nasdaq'].includes(term)) {
    return new RegExp(`\\b${escapeRegex(term)}\\b`, 'i').test(sourceText);
  }

  return sourceText.includes(term);
};

const positiveSentimentWords = ['gain', 'rise', 'growth', 'rally', 'surge', 'beat', 'strong', 'upside', 'record high', 'expand'];
const negativeSentimentWords = ['fall', 'drop', 'loss', 'decline', 'slump', 'miss', 'downgrade', 'weak', 'cut guidance', 'slowdown'];

const isIndianHeadline = (headline) => {
  const text = String(headline || '').toLowerCase();
  const includePatterns = [
    /\bindia\b/i,
    /\bindian\b/i,
    /\bbombay stock exchange\b/i,
    /\bsensex\b/i,
    /\bnifty\b/i,
    /\bnse\b/i,
    /\brbi\b/i,
    /\brupee\b/i,
    /\bmumbai\b/i,
    /\breliance\b/i,
    /\btcs\b/i,
    /\btata\b/i,
    /\bhdfc\b/i,
    /\binfosys\b/i,
    /\bicici\b/i,
    /\bsbi\b/i,
    /\badani\b/i,
    /\blarsen\b/i,
    /\bmahindra\b/i,
    /\baxis\b/i,
    /\bkotak\b/i,
    /\bbajaj\b/i,
    /\bmaruti\b/i,
    /\btitan\b/i,
    /\bwipro\b/i,
    /\bcipla\b/i,
    /\bntpc\b/i,
    /\bpowergrid\b/i,
    /\bsun pharma\b/i,
    /\bhindustan unilever\b/i,
  ];
  const excludePatterns = [
    /\bnasdaq\b/i,
    /\bs&p\s?500\b/i,
    /\bdow jones\b/i,
    /\bwall street\b/i,
    /\bus market\b/i,
    /\bu\.s\.\smarket\b/i,
    /\betf\b/i,
  ];

  const hasIndianSignal = includePatterns.some((pattern) => pattern.test(text));
  const hasGlobalOnlySignal = excludePatterns.some((pattern) => pattern.test(text));
  return hasIndianSignal && !hasGlobalOnlySignal;
};

class MarketNewsIntelligenceService {
  constructor() {
    this.newsApiKey = process.env.NEWSAPI_KEY || '';
    this.finbertServiceUrl = process.env.FINBERT_SERVICE_URL || 'http://127.0.0.1:5005';
  }

  resolveMarket(marketInput) {
    const marketCode = normalizeMarket(marketInput);
    if (!marketCode || !MARKET_CONFIG[marketCode]) {
      throw new Error('Unsupported market. Use one of: SP500, NASDAQ, BSE');
    }
    return {
      marketCode,
      ...MARKET_CONFIG[marketCode],
    };
  }

  async getIntelligence(marketInput) {
    const marketInfo = this.resolveMarket(marketInput);
    const allNews = await this.fetchNews(marketInfo);
    const filteredNews = this.filterByKeywords(allNews, marketInfo);
    const analysisHeadlines = filteredNews.slice(0, ANALYSIS_HEADLINES_COUNT).map((item) => item.headline);
    const displayNews = filteredNews.slice(0, DISPLAY_HEADLINES_COUNT);
    const sentimentResult = await this.analyzeSentiment(analysisHeadlines);
    const sectorImpact = this.getSectorImpact(analysisHeadlines);
    const sentiment = this.buildSentiment(sentimentResult, sectorImpact);

    return {
      market: marketInfo.marketCode,
      marketName: marketInfo.market,
      keywords: marketInfo.keywords,
      news: displayNews,
      analysisHeadlinesCount: analysisHeadlines.length,
      sentiment,
      sectorImpact,
      chartColors: PIE_COLORS.slice(0, sectorImpact.length || PIE_COLORS.length),
      fetchedAt: new Date().toISOString(),
      source: this.newsApiKey ? 'newsapi' : 'yahoo-finance',
    };
  }

  async fetchNews(marketInfo) {
    if (this.newsApiKey) {
      return await this.fetchFromNewsApi(marketInfo);
    }
    return await this.fetchFromYahoo(marketInfo);
  }

  async fetchFromNewsApi(marketInfo) {
    const query = marketInfo.keywords.map((keyword) => `"${keyword}"`).join(' OR ');
    const params = new URLSearchParams({
      q: query,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: '100',
    });

    const response = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': this.newsApiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NewsAPI request failed (${response.status}): ${errorText}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.articles) ? payload.articles : [];

    const mapped = items
      .map((item) => ({
        headline: String(item?.title || '').trim(),
        url: item?.url || null,
        source: item?.source?.name || 'NewsAPI',
        publishedAt: item?.publishedAt || null,
      }))
      .filter((item) => item.headline.length > 0);

    if (marketInfo.enforceIndianOnly) {
      return mapped.filter((item) => isIndianHeadline(item.headline));
    }

    return mapped;
  }

  async fetchFromYahoo(marketInfo) {
    const queryTerms = Array.isArray(marketInfo.yahooQueries) && marketInfo.yahooQueries.length
      ? marketInfo.yahooQueries
      : marketInfo.keywords;
    const byKeyword = await Promise.all(
      queryTerms.map(async (keyword) => {
        const result = await yahooFinance.search(keyword, { newsCount: 50, quotesCount: 0 });
        const rows = Array.isArray(result?.news) ? result.news : [];
        return rows.map((item) => ({
          headline: String(item?.title || item?.summary || '').trim(),
          url: item?.link || item?.url || null,
          source: item?.publisher || 'Yahoo Finance',
          publishedAt: item?.providerPublishTime
            ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
            : null,
        }));
      })
    );

    const merged = byKeyword.flat().filter((item) => item.headline.length > 0);
    const dedupedMap = new Map();
    merged.forEach((item) => {
      const key = item.headline.toLowerCase();
      if (!dedupedMap.has(key)) {
        dedupedMap.set(key, item);
      }
    });

    const deduped = [...dedupedMap.values()];
    if (marketInfo.enforceIndianOnly) {
      const filtered = deduped.filter((item) => isIndianHeadline(item.headline));
      if (filtered.length >= ANALYSIS_HEADLINES_COUNT) return filtered;
      return await this.appendIndianStockHeadlines(filtered);
    }
    return deduped;
  }

  async appendIndianStockHeadlines(existingItems) {
    const base = Array.isArray(existingItems) ? existingItems.slice() : [];
    const additionalQueries = [
      'Reliance Industries stock',
      'TCS stock',
      'HDFC Bank stock',
      'Infosys stock',
      'ICICI Bank stock',
      'SBI stock',
      'Adani Enterprises stock',
      'Larsen & Toubro stock',
      'Mahindra stock',
      'Axis Bank stock',
      'Kotak Bank stock',
      'Bajaj Finance stock',
      'Maruti stock',
      'Wipro stock',
      'Cipla stock',
      'NTPC stock',
      'PowerGrid stock',
      'Titan stock',
      'Sun Pharma stock',
      'HUL stock',
      'UltraTech Cement stock',
      'Asian Paints stock',
      'Bajaj Auto stock',
      'Tata Motors stock',
      'JSW Steel stock',
      'Tata Steel stock',
      'Coal India stock',
      'ONGC stock',
      'BPCL stock',
      'Dr Reddy stock',
      'Tech Mahindra stock',
      'HCL Tech stock',
      'IndusInd Bank stock',
      'State Bank of India stock',
      'Kotak Mahindra Bank stock',
      'ICICI Bank stock',
      'Maruti Suzuki stock',
      'Mahindra and Mahindra stock',
      'Adani Ports stock',
      'Larsen and Toubro stock',
      'Avenue Supermarts stock',
      'Zomato stock',
      'Paytm stock',
      'Nykaa stock',
      'IRCTC stock',
      'Indian Railways infra stock',
      'Nifty Bank stocks news',
      'Sensex gainers today',
    ];

    for (const query of additionalQueries) {
      if (base.length >= ANALYSIS_HEADLINES_COUNT) break;
      try {
        const result = await yahooFinance.search(query, { newsCount: 25, quotesCount: 0 });
        const rows = Array.isArray(result?.news) ? result.news : [];
        rows.forEach((item) => {
          const headline = String(item?.title || item?.summary || '').trim();
          if (!headline || !isIndianHeadline(headline)) return;
          const exists = base.some((row) => row.headline.toLowerCase() === headline.toLowerCase());
          if (exists) return;
          base.push({
            headline,
            url: item?.link || item?.url || null,
            source: item?.publisher || 'Yahoo Finance',
            publishedAt: item?.providerPublishTime
              ? new Date(Number(item.providerPublishTime) * 1000).toISOString()
              : null,
          });
        });
      } catch (error) {
      }
    }

    return base;
  }

  filterByKeywords(newsItems, marketInfo) {
    const keywordList = marketInfo.keywords.map((keyword) => keyword.toLowerCase());
    const strictMatch = newsItems.filter((item) => {
      const text = `${item.headline}`.toLowerCase();
      return keywordList.some((keyword) => containsKeyword(text, keyword));
    });

    const strictFiltered = marketInfo.enforceIndianOnly
      ? strictMatch.filter((item) => isIndianHeadline(item.headline))
      : strictMatch;

    if (strictFiltered.length >= ANALYSIS_HEADLINES_COUNT) {
      return strictFiltered;
    }

    const sorted = newsItems
      .slice()
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bTime - aTime;
      });

    if (marketInfo.enforceIndianOnly) {
      return sorted.filter((item) => isIndianHeadline(item.headline));
    }

    return sorted;
  }

  async analyzeSentiment(headlines) {
    if (!headlines.length) {
      return { sentiment_score: 0, label: 'Neutral' };
    }

    try {
      const response = await fetch(`${this.finbertServiceUrl.replace(/\/$/, '')}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ headlines }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`FinBERT service failed (${response.status}): ${text}`);
      }

      const payload = await response.json();
      return {
        sentiment_score: Number(payload?.sentiment_score) || 0,
        label: payload?.label || 'Neutral',
      };
    } catch (error) {
      return this.fallbackSentiment(headlines);
    }
  }

  fallbackSentiment(headlines) {
    const positiveWords = ['gain', 'rise', 'growth', 'rally', 'beat', 'bull', 'surge'];
    const negativeWords = ['fall', 'drop', 'loss', 'bear', 'decline', 'miss', 'slump'];

    let score = 0;
    headlines.forEach((headline) => {
      const text = String(headline || '').toLowerCase();
      positiveWords.forEach((word) => {
        if (text.includes(word)) score += 1;
      });
      negativeWords.forEach((word) => {
        if (text.includes(word)) score -= 1;
      });
    });

    const normalized = headlines.length ? Math.max(-1, Math.min(1, score / headlines.length)) : 0;
    const sentiment = recommendationFromScore(normalized);
    return {
      sentiment_score: normalized,
      label: sentiment.label,
    };
  }

  buildSentiment(sentimentResult, sectorImpact = []) {
    const score = Number(sentimentResult?.sentiment_score) || 0;
    const rule = recommendationFromScore(score);
    const recommendedSectorsToBuy = this.getRecommendedSectorsToBuy(sectorImpact);
    const sectorAdvice =
      recommendedSectorsToBuy.length
        ? `Focus sectors: ${recommendedSectorsToBuy.map((item) => item.sector).join(', ')}`
        : 'No clear sector concentration from headlines';

    return {
      score: toPercentage(score),
      label: rule.label,
      recommendation: rule.recommendation,
      finbertLabel: sentimentResult?.label || rule.label,
      recommendedSectorsToBuy,
      sectorAdvice,
    };
  }

  getRecommendedSectorsToBuy(sectorImpact) {
    const list = Array.isArray(sectorImpact) ? sectorImpact : [];
    const positive = list
      .filter((item) => Number(item?.impact) > 0 && Number(item?.trendPercent) >= 0)
      .slice(0, 3);

    const fallback = list
      .filter((item) => Number(item?.impact) > 0)
      .slice(0, 3);

    return (positive.length ? positive : fallback).map((item) => ({
      sector: item.sector,
      impact: item.impact,
      trendPercent: item.trendPercent,
    }));
  }

  getSectorImpact(headlines) {
    const sectorStats = {};
    let totalMentions = 0;

    headlines.forEach((headline) => {
      const text = String(headline || '').toLowerCase();
      const headlineSentiment = this.getHeadlinePolarity(text);

      Object.entries(SECTOR_KEYWORD_GROUPS).forEach(([sector, keywords]) => {
        const matched = keywords.some((keyword) => containsKeyword(text, keyword));
        if (matched) {
          if (!sectorStats[sector]) {
            sectorStats[sector] = { mentions: 0, sentimentSum: 0 };
          }
          sectorStats[sector].mentions += 1;
          sectorStats[sector].sentimentSum += headlineSentiment;
          totalMentions += 1;
        }
      });
    });

    if (!totalMentions) return [];

    return Object.entries(sectorStats)
      .map(([sector, stats]) => {
        const impact = toPercentage((stats.mentions / totalMentions) * 100);
        const avgSentiment = stats.mentions ? stats.sentimentSum / stats.mentions : 0;
        const trendPercent = toPercentage(clamp(avgSentiment * 4.5, -5, 5));
        return {
          sector,
          impact,
          mentions: stats.mentions,
          trendPercent,
          trendLabel: trendPercent > 0.2 ? 'Positive' : trendPercent < -0.2 ? 'Negative' : 'Neutral',
        };
      })
      .sort((a, b) => {
        if (b.impact !== a.impact) return b.impact - a.impact;
        return b.trendPercent - a.trendPercent;
      });
  }

  getHeadlinePolarity(text) {
    let score = 0;
    positiveSentimentWords.forEach((word) => {
      if (text.includes(word)) score += 1;
    });
    negativeSentimentWords.forEach((word) => {
      if (text.includes(word)) score -= 1;
    });
    return clamp(score / 3, -1, 1);
  }
}

module.exports = new MarketNewsIntelligenceService();
