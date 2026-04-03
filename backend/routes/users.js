const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, sensitiveOperationLimit } = require('../middleware/auth');
const emailService = require('../utils/emailService');

const router = express.Router();
const emailNormalizationOptions = {
  all_lowercase: true,
  gmail_lowercase: true,
  gmail_remove_dots: false,
  gmail_remove_subaddress: false,
  gmail_convert_googlemaildotcom: false,
  outlookdotcom_lowercase: true,
  outlookdotcom_remove_subaddress: false,
  yahoo_lowercase: true,
  yahoo_remove_subaddress: false,
  icloud_lowercase: true,
  icloud_remove_subaddress: false,
};

const getIntegrationEncryptionKey = (() => {
  let cached = null;
  return () => {
    if (cached) return cached;
    const base = process.env.INTEGRATIONS_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!base) {
      throw new Error('Missing INTEGRATIONS_ENCRYPTION_KEY (or JWT_SECRET) for encrypting integrations.');
    }
    cached = crypto.createHash('sha256').update(String(base)).digest();
    return cached;
  };
})();

function encryptIntegrationValue(plaintext) {
  const key = getIntegrationEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptIntegrationValue(enc) {
  if (!enc) return '';
  const [ivB64, tagB64, dataB64] = String(enc).split('.');
  if (!ivB64 || !tagB64 || !dataB64) return '';
  const key = getIntegrationEncryptionKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString('utf8');
}

function normalizeGrowwAccounts(groww) {
  const raw = Array.isArray(groww?.accounts) ? groww.accounts : [];
  const accounts = raw
    .map((a) => {
      if (!a) return null;
      const id = a.id || a.accountId || a._id;
      if (!id) return null;
      const label = a.label || a.name || 'Account';
      return {
        id: String(id),
        label: String(label),
        apiKeyEnc: a.apiKeyEnc || '',
        apiSecretEnc: a.apiSecretEnc || '',
        createdAt: a.createdAt || null,
        updatedAt: a.updatedAt || null,
      };
    })
    .filter(Boolean);

  const hasAccounts = accounts.length > 0;
  if (hasAccounts) return accounts;
  if (groww?.apiKeyEnc && groww?.apiSecretEnc) {
    return [
      {
        id: 'legacy',
        label: 'Primary',
        apiKeyEnc: groww.apiKeyEnc,
        apiSecretEnc: groww.apiSecretEnc,
        updatedAt: groww.updatedAt || null,
        createdAt: groww.updatedAt || null,
      },
    ];
  }
  return [];
}

function getGrowwAccountFromUser({ user, accountId }) {
  const groww = user?.integrations?.groww;
  const accounts = normalizeGrowwAccounts(groww);
  if (!accounts.length) return null;
  if (accountId) {
    const found = accounts.find((a) => String(a?.id) === String(accountId));
    return found || null;
  }
  return accounts[0] || null;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function requestJson({ method, url, headers, body }) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = { raw: text };
  }

  if (!res.ok) {
    let message = '';
    if (typeof data === 'object' && data) {
      if (data.message) {
        message = String(data.message);
      } else if (data.error) {
        if (typeof data.error === 'string') {
          message = data.error;
        } else if (typeof data.error === 'object' && data.error) {
          message = String(data.error.message || data.error.msg || JSON.stringify(data.error));
        } else {
          message = String(data.error);
        }
      } else {
        message = JSON.stringify(data);
      }
    } else {
      message = String(data);
    }
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}: ${message}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function normalizeAllocationTo100(allocation) {
  const keys = ['largeCap', 'midCap', 'smallCap', 'bonds', 'liquidFund'];
  const cleaned = {};
  keys.forEach((k) => {
    cleaned[k] = clampInt(allocation?.[k] ?? 0, 0, 100, 0);
  });

  const sum = keys.reduce((acc, k) => acc + cleaned[k], 0);
  if (sum === 100) return cleaned;
  if (sum === 0) return cleaned;

  const remainder = 100 - sum;
  const adjustKey = keys.includes('largeCap') ? 'largeCap' : keys[0];
  cleaned[adjustKey] = clampInt(cleaned[adjustKey] + remainder, 0, 100, cleaned[adjustKey]);

  const sum2 = keys.reduce((acc, k) => acc + cleaned[k], 0);
  if (sum2 === 100) return cleaned;

  let diff = 100 - sum2;
  const fallbacks = ['bonds', 'largeCap', 'midCap', 'smallCap', 'liquidFund'];
  for (const k of fallbacks) {
    if (diff === 0) break;
    const next = clampInt(cleaned[k] + diff, 0, 100, cleaned[k]);
    diff -= (next - cleaned[k]);
    cleaned[k] = next;
  }
  return cleaned;
}

function buildInvestmentRecommendation(rawAnswers) {
  const goalsRaw = Array.isArray(rawAnswers?.financialGoals)
    ? rawAnswers.financialGoals
    : (rawAnswers?.financialGoals ? [rawAnswers.financialGoals] : null);

  const financialGoals = (goalsRaw || [])
    .map((v) => clampInt(v, 1, 4, null))
    .filter((v) => v !== null);

  const effectiveFinancialGoal =
    financialGoals.length > 0
      ? Math.min(...financialGoals)
      : clampInt(rawAnswers?.financialGoal, 1, 4, 1);

  const answers = {
    riskTolerance: clampInt(rawAnswers?.riskTolerance, 1, 4, 1),
    investmentDuration: clampInt(rawAnswers?.investmentDuration, 1, 4, 1),
    savingsCapacity: clampInt(rawAnswers?.savingsCapacity, 1, 4, 1),
    financialGoal: effectiveFinancialGoal,
    financialGoals: financialGoals.length ? financialGoals : undefined,
    age: clampInt(rawAnswers?.age, 0, 150, 0),
    hasEmergencyFund: Boolean(rawAnswers?.hasEmergencyFund),
    hasHighInterestDebt: Boolean(rawAnswers?.hasHighInterestDebt),
  };

  const scoreRaw =
    answers.riskTolerance * 0.35 +
    answers.investmentDuration * 0.30 +
    answers.savingsCapacity * 0.20 +
    answers.financialGoal * 0.15;

  const score = Math.round(scoreRaw * 100) / 100;

  let profile = 'Conservative';
  let allocation = { largeCap: 40, midCap: 10, smallCap: 0, bonds: 50, liquidFund: 0 };
  if (score <= 2.0) {
    profile = 'Conservative';
    allocation = { largeCap: 40, midCap: 10, smallCap: 0, bonds: 50, liquidFund: 0 };
  } else if (score <= 3.0) {
    profile = 'Moderate';
    allocation = { largeCap: 40, midCap: 25, smallCap: 10, bonds: 25, liquidFund: 0 };
  } else {
    profile = 'Aggressive';
    allocation = { largeCap: 35, midCap: 30, smallCap: 25, bonds: 10, liquidFund: 0 };
  }

  if (answers.age > 50) {
    const nextSmall = Math.min(allocation.smallCap, 15);
    const smallDiff = allocation.smallCap - nextSmall;
    allocation.smallCap = nextSmall;
    allocation.bonds += smallDiff;
    allocation.bonds = Math.max(allocation.bonds, 30);
  }

  if (answers.age > 0 && answers.age < 25) {
    const equity = allocation.largeCap + allocation.midCap + allocation.smallCap;
    if (equity < 70) {
      const needed = 70 - equity;
      const shift = Math.min(needed, allocation.bonds);
      allocation.bonds -= shift;
      allocation.largeCap += shift;
    }
  }

  if (!answers.hasEmergencyFund) {
    allocation.liquidFund = 20;
    ['largeCap', 'midCap', 'smallCap', 'bonds'].forEach((k) => {
      allocation[k] = Math.round(allocation[k] * 0.8);
    });
  }

  const explanationParts = [];
  if (answers.hasHighInterestDebt) {
    allocation = {
      largeCap: 0,
      midCap: 0,
      smallCap: 0,
      bonds: answers.hasEmergencyFund ? 40 : 30,
      liquidFund: answers.hasEmergencyFund ? 60 : 70,
    };
    profile = 'Conservative';
    explanationParts.push(
      'High-interest debt typically costs more than long-term investment returns. Pay it down first; these picks prioritize safety and liquidity.'
    );
  }

  allocation = normalizeAllocationTo100(allocation);

  explanationParts.push(`Score ${score} → ${profile}.`);
  if (answers.age > 50) explanationParts.push('Age > 50 adjustment increases stability.');
  if (answers.age > 0 && answers.age < 25) explanationParts.push('Age < 25 adjustment ensures enough equity for growth.');
  if (!answers.hasEmergencyFund) explanationParts.push('20% is reserved for liquid funds until an emergency fund is built.');

  return {
    status: answers.hasHighInterestDebt ? 'warning' : 'success',
    score,
    profile,
    allocation,
    explanation: explanationParts.join(' '),
    answers,
  };
}

const MFAPI_BASE_URL = process.env.MFAPI_BASE_URL || 'https://api.mfapi.in';
const mfApiCache = {
  search: new Map(),
  history: new Map(),
};

function parseMfApiDate(dateStr) {
  const s = String(dateStr || '');
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function scaleTo100(value, min, max) {
  const v = clampNumber(value, min, max);
  if (max === min) return 0;
  return ((v - min) / (max - min)) * 100;
}

function stddev(values) {
  const arr = Array.isArray(values) ? values.filter((v) => Number.isFinite(v)) : [];
  if (arr.length < 2) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

async function mfApiGetJson(path, params) {
  const u = new URL(path, MFAPI_BASE_URL);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      u.searchParams.set(key, String(value));
    });
  }
  return requestJson({ method: 'GET', url: u.toString(), headers: { Accept: 'application/json' } });
}

async function mfApiSearch(q) {
  const key = String(q || '').trim().toLowerCase();
  if (!key) return [];
  if (mfApiCache.search.has(key)) return mfApiCache.search.get(key);
  const res = await mfApiGetJson('/mf/search', { q: key });
  const list = Array.isArray(res) ? res : [];
  mfApiCache.search.set(key, list);
  return list;
}

async function mfApiNavHistory({ schemeCode }) {
  const code = Number(schemeCode);
  if (!Number.isFinite(code)) throw new Error('Invalid schemeCode');
  const cacheKey = String(code);
  if (mfApiCache.history.has(cacheKey)) return mfApiCache.history.get(cacheKey);
  const res = await mfApiGetJson(`/mf/${code}`);
  mfApiCache.history.set(cacheKey, res);
  return res;
}

function pickNavOnOrBefore(data, targetDate) {
  const t = targetDate?.getTime ? targetDate.getTime() : null;
  if (!t) return null;
  for (const row of data) {
    const dt = row?.dt instanceof Date ? row.dt : parseMfApiDate(row?.date);
    if (!dt) continue;
    if (dt.getTime() <= t) {
      const nav = Number.isFinite(row?.nav) ? row.nav : toNumber(row?.nav);
      if (nav !== null) return { date: dt, nav };
    }
  }
  return null;
}

function computeCagrPct({ navNow, navThen, years }) {
  if (!Number.isFinite(navNow) || !Number.isFinite(navThen) || navNow <= 0 || navThen <= 0 || years <= 0) return null;
  const cagr = Math.pow(navNow / navThen, 1 / years) - 1;
  return Math.round(cagr * 10000) / 100;
}

function computeReturnPct({ navNow, navThen }) {
  if (!Number.isFinite(navNow) || !Number.isFinite(navThen) || navThen === 0) return null;
  return Math.round(((navNow / navThen - 1) * 100) * 100) / 100;
}

function computeVolatilityPct1y(data) {
  const rows = Array.isArray(data) ? data : [];
  const parsed = rows
    .map((r) => {
      const dt = r?.dt instanceof Date ? r.dt : parseMfApiDate(r?.date);
      const nav = Number.isFinite(r?.nav) ? r.nav : toNumber(r?.nav);
      if (!dt || nav === null) return null;
      return { dt, nav };
    })
    .filter(Boolean)
    .sort((a, b) => a.dt.getTime() - b.dt.getTime());

  if (!parsed.length) return null;
  const latestDt = parsed[parsed.length - 1].dt;

  const oneYearAgo = new Date(latestDt.getTime());
  oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
  const filtered = parsed.filter((r) => r.dt.getTime() >= oneYearAgo.getTime());

  if (filtered.length < 50) return null;
  const logReturns = [];
  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1].nav;
    const cur = filtered[i].nav;
    if (prev > 0 && cur > 0) logReturns.push(Math.log(cur / prev));
  }
  const sd = stddev(logReturns);
  if (sd === null) return null;
  const annualized = sd * Math.sqrt(252) * 100;
  return Math.round(annualized * 100) / 100;
}

function buildFundFitScore({ profile, bucketKey, returns, vol1y }) {
  const isDebt = bucketKey === 'bonds' || bucketKey === 'liquidFund';
  const momentum = returns?.cagr3y ?? returns?.cagr5y ?? returns?.ret1y ?? null;
  const vol = Number.isFinite(vol1y) ? vol1y : null;

  const momentumScore = isDebt
    ? scaleTo100(momentum ?? 0, -2, 12)
    : scaleTo100(momentum ?? 0, -20, 30);

  const stabilityScore = vol === null
    ? 50
    : (100 - scaleTo100(vol, 5, isDebt ? 15 : 35));

  let score = 0;
  if (String(profile).toLowerCase() === 'aggressive') {
    score = 0.75 * momentumScore + 0.25 * stabilityScore;
  } else if (String(profile).toLowerCase() === 'moderate') {
    score = 0.6 * momentumScore + 0.4 * stabilityScore;
  } else {
    score = 0.45 * momentumScore + 0.55 * stabilityScore;
  }
  return Math.round(clampNumber(score, 0, 100) * 10) / 10;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const list = Array.isArray(items) ? items : [];
  const c = Math.max(1, Math.min(12, Number(concurrency) || 4));
  const results = new Array(list.length);
  let idx = 0;

  const runWorker = async () => {
    while (idx < list.length) {
      const cur = idx++;
      results[cur] = await mapper(list[cur], cur);
    }
  };
  await Promise.all(Array.from({ length: Math.min(c, list.length) }, () => runWorker()));
  return results;
}

function bucketConfig() {
  return [
    {
      key: 'largeCap',
      label: 'Large-cap',
      queries: [
        'Large Cap Fund Direct Plan Growth',
        'Large & Mid Cap Fund Direct Plan Growth',
        'Flexi Cap Fund Direct Plan Growth',
        'Focused Fund Direct Plan Growth',
      ],
      match: [/Large Cap Fund/i, /Large & Mid Cap Fund/i, /Flexi Cap Fund/i, /Focused Fund/i],
    },
    {
      key: 'midCap',
      label: 'Mid-cap',
      queries: ['Mid Cap Fund Direct Plan Growth', 'Midcap Fund Direct Plan Growth'],
      match: [/Mid Cap Fund/i],
    },
    {
      key: 'smallCap',
      label: 'Small-cap',
      queries: ['Small Cap Fund Direct Plan Growth', 'Smallcap Fund Direct Plan Growth'],
      match: [/Small Cap Fund/i],
    },
    {
      key: 'bonds',
      label: 'Bonds/Debt',
      queries: [
        'Corporate Bond Fund Direct Plan Growth',
        'Short Duration Fund Direct Plan Growth',
        'Banking and PSU Debt Fund Direct Plan Growth',
        'Gilt Fund Direct Plan Growth',
        'Money Market Fund Direct Plan Growth',
      ],
      match: [/Debt Scheme/i, /Bond Fund/i, /Liquid Fund/i, /Gilt Fund/i, /Money Market Fund/i, /Short Duration Fund/i],
    },
    {
      key: 'liquidFund',
      label: 'Liquid',
      queries: [
        'Liquid Fund Direct Plan Growth',
        'Overnight Fund Direct Plan Growth',
        'Money Market Fund Direct Plan Growth',
      ],
      match: [/Liquid Fund/i, /Overnight Fund/i, /Money Market Fund/i],
    },
  ];
}

function shouldKeepSchemeName(name) {
  const s = String(name || '').toLowerCase();
  if (!s) return false;
  if (!s.includes('direct')) return false;
  if (!s.includes('growth')) return false;
  if (s.includes('idcw') || s.includes('dividend')) return false;
  return true;
}

async function buildMutualFundRecommendations({ profile, allocation }) {
  const TOP_N = 10;

  const buckets = bucketConfig()
    .map((b) => ({
      ...b,
      weight: clampInt(allocation?.[b.key] ?? 0, 0, 100, 0),
    }));

  const bucketResults = await mapWithConcurrency(buckets, 3, async (bucket) => {
    const searchLists = await mapWithConcurrency(bucket.queries, 3, async (q) => mfApiSearch(q));
    const merged = [];
    for (const list of searchLists) {
      for (const row of Array.isArray(list) ? list : []) merged.push(row);
    }
    const deduped = [];
    const seen = new Set();
    for (const row of merged) {
      const schemeCode = Number(row?.schemeCode);
      const schemeName = String(row?.schemeName || '');
      if (!Number.isFinite(schemeCode) || !schemeName) continue;
      if (!shouldKeepSchemeName(schemeName)) continue;
      if (seen.has(schemeCode)) continue;
      seen.add(schemeCode);
      deduped.push({ schemeCode, schemeName });
      if (deduped.length >= 60) break;
    }

    const picksNeeded = TOP_N;
    const evaluated = [];
    for (let i = 0; i < deduped.length && evaluated.length < picksNeeded + 8; i += 10) {
      const batch = deduped.slice(i, i + 10);
      const batchEvaluated = await mapWithConcurrency(batch, 5, async (candidate) => {
      try {
        const history = await mfApiNavHistory({ schemeCode: candidate.schemeCode });
        const meta = history?.meta || null;
        const schemeCategory = String(meta?.scheme_category || '');
        if (!schemeCategory) return null;
        if (!bucket.match.some((re) => re.test(schemeCategory))) return null;

        const data = Array.isArray(history?.data) ? history.data : [];
        if (!data.length) return null;

        const parsedRows = data
          .map((r) => {
            const dt = parseMfApiDate(r?.date);
            const nav = toNumber(r?.nav);
            if (!dt || nav === null) return null;
            return { dt, nav, date: r?.date || null };
          })
          .filter(Boolean)
          .sort((a, b) => b.dt.getTime() - a.dt.getTime());

        if (!parsedRows.length) return null;
        const latestRow = parsedRows[0];
        const latestNav = latestRow.nav;
        const latestDt = latestRow.dt;
        const ageDays = (Date.now() - latestDt.getTime()) / (1000 * 60 * 60 * 24);
        if (Number.isFinite(ageDays) && ageDays > 45) return null;

        const oneYearAgo = new Date(latestDt.getTime());
        oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
        const threeYearsAgo = new Date(latestDt.getTime());
        threeYearsAgo.setUTCFullYear(threeYearsAgo.getUTCFullYear() - 3);
        const fiveYearsAgo = new Date(latestDt.getTime());
        fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);

        const nav1y = pickNavOnOrBefore(parsedRows, oneYearAgo);
        const nav3y = pickNavOnOrBefore(parsedRows, threeYearsAgo);
        const nav5y = pickNavOnOrBefore(parsedRows, fiveYearsAgo);

        const ret1y = nav1y ? computeReturnPct({ navNow: latestNav, navThen: nav1y.nav }) : null;
        const cagr3y = nav3y ? computeCagrPct({ navNow: latestNav, navThen: nav3y.nav, years: 3 }) : null;
        const cagr5y = nav5y ? computeCagrPct({ navNow: latestNav, navThen: nav5y.nav, years: 5 }) : null;

        const vol1y = computeVolatilityPct1y(parsedRows);
        const fitScore = buildFundFitScore({ profile, bucketKey: bucket.key, returns: { ret1y, cagr3y, cagr5y }, vol1y });

        const fundHouse = String(meta?.fund_house || '');
        const schemeType = String(meta?.scheme_type || '');

        const whyParts = [];
        if (cagr3y !== null) whyParts.push(`3Y CAGR ${cagr3y}%`);
        else if (ret1y !== null) whyParts.push(`1Y return ${ret1y}%`);
        if (vol1y !== null) whyParts.push(`1Y vol ${vol1y}%`);
        whyParts.push(`category ${schemeCategory}`);

        return {
          bucketKey: bucket.key,
          bucketLabel: bucket.label,
          schemeCode: candidate.schemeCode,
          schemeName: String(meta?.scheme_name || candidate.schemeName),
          fundHouse,
          schemeType,
          schemeCategory,
          nav: latestNav,
          navDate: latestRow?.date || null,
          returns: { ret1y, cagr3y, cagr5y },
          volatility1y: vol1y,
          fitScore,
          why: whyParts.join(' • '),
        };
      } catch (e) {
        return null;
      }
      });
      for (const row of batchEvaluated) {
        if (row) evaluated.push(row);
      }
    }

    const usable = evaluated.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0)).slice(0, picksNeeded);
    const perFundAllocation = usable.length && bucket.weight > 0 ? Math.round((bucket.weight / usable.length) * 10) / 10 : 0;
    return {
      bucket,
      items: usable.map((x) => ({ ...x, suggestedAllocationPct: perFundAllocation })),
    };
  });

  const items = bucketResults.flatMap((r) => r.items);
  const ranked = items
    .map((x) => {
      const alloc = Number(x.suggestedAllocationPct) || 0;
      const overallFit = Math.round(((Number(x.fitScore) || 0) * (alloc / 100)) * 100) / 100;
      return { ...x, overallFit };
    })
    .sort((a, b) => (b.overallFit ?? 0) - (a.overallFit ?? 0));

  const toOutputItem = (x, extra) => ({
    ...extra,
    bucketKey: x.bucketKey,
    bucket: x.bucketLabel,
    schemeName: x.schemeName,
    schemeCode: x.schemeCode,
    fundHouse: x.fundHouse,
    schemeCategory: x.schemeCategory,
    nav: x.nav,
    navDate: x.navDate,
    return1yPct: x.returns?.ret1y ?? null,
    cagr3yPct: x.returns?.cagr3y ?? null,
    cagr5yPct: x.returns?.cagr5y ?? null,
    volatility1yPct: x.volatility1y ?? null,
    fitScore: x.fitScore ?? null,
    suggestedAllocationPct: x.suggestedAllocationPct ?? null,
    why: x.why,
  });

  return {
    generatedAt: new Date().toISOString(),
    source: MFAPI_BASE_URL,
    buckets: bucketResults.map((r) => ({
      key: r.bucket.key,
      label: r.bucket.label,
      weight: r.bucket.weight,
      items: r.items
        .slice()
        .sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0))
        .slice(0, TOP_N)
        .map((x, idx) => toOutputItem(x, { rank: idx + 1 })),
    })),
    items: ranked.slice(0, TOP_N).map((x, idx) => toOutputItem(x, { rank: idx + 1 })),
  };
}

async function getGrowwAccessToken({ apiKey, apiSecret }) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const checksum = sha256Hex(`${apiSecret}${timestamp}`);
  const tokenRes = await requestJson({
    method: 'POST',
    url: 'https://api.groww.in/v1/token/api/access',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      key_type: 'approval',
      checksum,
      timestamp,
    },
  });
  return tokenRes?.payload?.token || tokenRes?.token;
}

async function fetchGrowwMargins({ headers }) {
  const urls = [
    'https://api.groww.in/v1/margins/detail/user',
    'https://api.groww.in/v1/api/apex/v1/margins/detail/user',
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      return await requestJson({ method: 'GET', url, headers });
    } catch (err) {
      lastErr = err;
      if (![401, 403, 404].includes(err?.status)) throw err;
    }
  }
  throw lastErr || new Error('Failed to fetch Groww margins.');
}

async function fetchGrowwPortfolio({ apiKey, apiSecret }) {
  const accessToken = await getGrowwAccessToken({ apiKey, apiSecret });
  if (!accessToken) throw new Error('Failed to obtain Groww access token.');

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'X-API-VERSION': '1.0',
  };

  const results = await Promise.allSettled([
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/user/detail', headers }),
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/holdings/user', headers }),
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/positions/user?segment=CASH', headers }),
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/positions/user?segment=FNO', headers }),
    fetchGrowwMargins({ headers }),
  ]);

  const unwrap = (r) => (r.status === 'fulfilled' ? r.value : { status: 'FAILURE', error: r.reason?.message || 'Request failed' });
  const [profile, holdings, positionsCash, positionsFno, margins] = results.map(unwrap);
  if (holdings?.payload?.holdings && Array.isArray(holdings.payload.holdings)) {
    holdings.payload.holdings = await addLiveQuotesToHoldings({ holdings: holdings.payload.holdings, headers });
  }
  return { profile, holdings, positions: { CASH: positionsCash, FNO: positionsFno }, margins };
}

async function fetchGrowwHoldings({ headers }) {
  return requestJson({ method: 'GET', url: 'https://api.groww.in/v1/holdings/user', headers });
}

async function fetchGrowwLiveQuote({ headers, exchange, segment, tradingSymbol }) {
  const params = new URLSearchParams({
    exchange,
    segment,
    trading_symbol: tradingSymbol,
  });
  return requestJson({ method: 'GET', url: `https://api.groww.in/v1/live-data/quote?${params.toString()}`, headers });
}

async function addLiveQuotesToHoldings({ holdings, headers }) {
  const list = Array.isArray(holdings) ? holdings : [];
  const targets = list.filter((h) => h?.trading_symbol && getHoldingLtp(h) === null);
  if (!targets.length) return list;

  const MAX_QUOTE_FETCH = 75;
  const limited = targets.slice(0, MAX_QUOTE_FETCH);
  const results = await Promise.allSettled(
    limited.map((h) =>
      fetchGrowwLiveQuote({
        headers,
        exchange: String(h?.exchange || 'NSE').toUpperCase(),
        segment: String(h?.segment || 'CASH').toUpperCase(),
        tradingSymbol: h?.trading_symbol,
      })
    )
  );

  const ltpBySymbol = new Map();
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled') return;
    const quote = r.value?.payload || r.value || null;
    const ltp = getHoldingLtp(quote);
    const symbol = limited[idx]?.trading_symbol;
    if (symbol && ltp !== null) ltpBySymbol.set(String(symbol), ltp);
  });

  return list.map((h) => {
    const symbol = String(h?.trading_symbol || '');
    if (!symbol || !ltpBySymbol.has(symbol)) return h;
    const ltp = ltpBySymbol.get(symbol);
    return {
      ...h,
      ltp: h?.ltp ?? ltp,
      last_price: h?.last_price ?? ltp,
      last_traded_price: h?.last_traded_price ?? ltp,
      current_price: h?.current_price ?? ltp,
      price: h?.price ?? ltp,
    };
  });
}

function getHoldingQty(h) {
  const q = toNumber(h?.quantity);
  return q === null ? 0 : q;
}

function getHoldingAvg(h) {
  const a = toNumber(h?.average_price);
  return a === null ? 0 : a;
}

function getHoldingLtp(h) {
  const candidates = [
    h?.last_price,
    h?.ltp,
    h?.last_traded_price,
    h?.current_price,
    h?.price,
    h?.close,
  ];
  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== null) return n;
  }
  return null;
}

function getHoldingPnl(h) {
  const candidates = [h?.pnl, h?.pnl_amount, h?.unrealised_pnl, h?.unrealized_pnl];
  for (const c of candidates) {
    const n = toNumber(c);
    if (n !== null) return n;
  }
  return null;
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : null;
}

function summarizeHoldings(holdingsArr) {
  const holdings = Array.isArray(holdingsArr) ? holdingsArr : [];
  let invested = 0;
  let marketValue = 0;
  let pnl = 0;
  let marketValueKnown = 0;
  let pnlKnown = 0;

  for (const h of holdings) {
    const qty = getHoldingQty(h);
    const avg = getHoldingAvg(h);
    invested += qty * avg;

    const ltp = getHoldingLtp(h);
    if (ltp !== null) {
      marketValue += qty * ltp;
      marketValueKnown += 1;
    }

    const hpnl = getHoldingPnl(h);
    if (hpnl !== null) {
      pnl += hpnl;
      pnlKnown += 1;
    }
  }

  if (pnlKnown === 0 && marketValueKnown > 0) {
    pnl = marketValue - invested;
  }
  if (marketValueKnown === 0) {
    marketValue = invested + pnl;
  }

  return { invested, marketValue, pnl };
}

function normalizeCandleInterval(val) {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return '1day';
  const canonical = v.replace(/\s+/g, '');
  return canonical;
}

function maxDaysForInterval(interval) {
  const i = normalizeCandleInterval(interval);
  const table = {
    '1minute': 30,
    '2minute': 30,
    '3minute': 30,
    '5minute': 30,
    '10minute': 90,
    '15minute': 90,
    '30minute': 90,
    '1hour': 180,
    '4hour': 180,
    '1day': 180,
    '1week': 180,
    '1month': 180,
  };
  return table[i] || 180;
}

function candleIntervalToMinutes(interval) {
  const i = normalizeCandleInterval(interval);
  const table = {
    '1minute': 1,
    '2minute': 2,
    '3minute': 3,
    '5minute': 5,
    '10minute': 10,
    '15minute': 15,
    '30minute': 30,
    '1hour': 60,
    '4hour': 240,
    '1day': 1440,
    '1week': 10080,
    '1month': 43200,
  };
  return table[i] || 1440;
}

async function fetchGrowwHistoricalCandles({
  apiKey,
  apiSecret,
  exchange,
  segment,
  growwSymbol,
  startTime,
  endTime,
  candleInterval,
}) {
  const accessToken = await getGrowwAccessToken({ apiKey, apiSecret });
  if (!accessToken) throw new Error('Failed to obtain Groww access token.');

  const params = new URLSearchParams({
    exchange,
    segment,
    groww_symbol: growwSymbol,
    start_time: String(startTime),
    end_time: String(endTime),
    candle_interval: candleInterval,
  });

  try {
    return await requestJson({
      method: 'GET',
      url: `https://api.groww.in/v1/historical/candles?${params.toString()}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'X-API-VERSION': '1.0',
      },
    });
  } catch (err) {
    if (err?.status !== 403) throw err;

    const intervalInMinutes = candleIntervalToMinutes(candleInterval);
    let tradingSymbol = String(growwSymbol || '');
    const prefix = `${exchange}-`;
    if (tradingSymbol.startsWith(prefix)) tradingSymbol = tradingSymbol.slice(prefix.length);
    if (!tradingSymbol) throw err;

    const fallbackParams = new URLSearchParams({
      exchange,
      segment,
      trading_symbol: tradingSymbol,
      start_time: String(startTime),
      end_time: String(endTime),
      interval_in_minutes: String(intervalInMinutes),
    });

    return requestJson({
      method: 'GET',
      url: `https://api.groww.in/v1/historical/candle/range?${fallbackParams.toString()}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'X-API-VERSION': '1.0',
      },
    });
  }
}

function summarizeCandles(candles) {
  const rows = Array.isArray(candles) ? candles : [];
  const closes = [];
  for (const c of rows) {
    if (!Array.isArray(c) || c.length < 5) continue;
    const close = toNumber(c[4]);
    if (close === null) continue;
    closes.push(close);
  }
  if (!closes.length) return null;
  const first = closes[0];
  const last = closes[closes.length - 1];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const change = last - first;
  const changePct = first !== 0 ? (100 * change) / first : null;
  return {
    points: closes.length,
    firstClose: first,
    lastClose: last,
    minClose: min,
    maxClose: max,
    change,
    changePct,
  };
}

router.get('/investment-profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let investmentProfile = user.investmentProfile || null;
    if (investmentProfile?.answers) {
      const next = buildInvestmentRecommendation(investmentProfile.answers);
      investmentProfile = {
        ...investmentProfile,
        answers: next.answers,
        score: next.score,
        profile: next.profile,
        status: next.status,
        allocation: next.allocation,
        explanation: next.explanation,
      };
    }
    let mutualFunds = null;
    if ((investmentProfile?.status === 'success' || investmentProfile?.status === 'warning') && investmentProfile?.profile && investmentProfile?.allocation) {
      try {
        mutualFunds = await buildMutualFundRecommendations({
          profile: investmentProfile.profile,
          allocation: investmentProfile.allocation,
        });
      } catch (e) {
        mutualFunds = {
          generatedAt: new Date().toISOString(),
          source: MFAPI_BASE_URL,
          items: [],
          error: e?.message || 'Failed to fetch mutual funds',
        };
      }
    }

    res.json({
      message: 'Investment profile retrieved',
      investmentProfile,
      mutualFunds,
      onboarding: user.onboarding,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        currency: user.currency,
        timezone: user.timezone,
        notifications: user.notifications,
        onboarding: user.onboarding,
        investmentProfile,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get investment profile error:', error);
    res.status(500).json({ message: 'Server error retrieving investment profile' });
  }
});

router.put(
  '/investment-profile',
  [
    body('riskTolerance')
      .isInt({ min: 1, max: 4 })
      .withMessage('riskTolerance must be an integer between 1 and 4'),
    body('investmentDuration')
      .isInt({ min: 1, max: 4 })
      .withMessage('investmentDuration must be an integer between 1 and 4'),
    body('savingsCapacity')
      .isInt({ min: 1, max: 4 })
      .withMessage('savingsCapacity must be an integer between 1 and 4'),
    body('financialGoal')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('financialGoal must be an integer between 1 and 4'),
    body('financialGoals')
      .optional()
      .isArray({ min: 1 })
      .withMessage('financialGoals must be an array'),
    body('financialGoals.*')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('financialGoals values must be integers between 1 and 4'),
    body('age')
      .isInt({ min: 0, max: 150 })
      .withMessage('age must be an integer between 0 and 150'),
    body('hasEmergencyFund')
      .isBoolean()
      .withMessage('hasEmergencyFund must be a boolean'),
    body('hasHighInterestDebt')
      .isBoolean()
      .withMessage('hasHighInterestDebt must be a boolean'),
  ],
  auth,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      if (!req.body.financialGoal && !req.body.financialGoals) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: [{ msg: 'financialGoals is required', path: 'financialGoals' }],
        });
      }

      const recommendation = buildInvestmentRecommendation(req.body);
      let mutualFunds = null;
      if ((recommendation.status === 'success' || recommendation.status === 'warning') && recommendation.profile && recommendation.allocation) {
        try {
          mutualFunds = await buildMutualFundRecommendations({
            profile: recommendation.profile,
            allocation: recommendation.allocation,
          });
        } catch (e) {
          mutualFunds = {
            generatedAt: new Date().toISOString(),
            source: MFAPI_BASE_URL,
            items: [],
            error: e?.message || 'Failed to fetch mutual funds',
          };
        }
      }

      const updates = {
        onboarding: {
          ...(req.user.onboarding || {}),
          investmentProfileCompleted: true,
          investmentProfileCompletedAt: new Date(),
        },
        investmentProfile: {
          answers: recommendation.answers,
          score: recommendation.score,
          profile: recommendation.profile,
          status: recommendation.status,
          allocation: recommendation.allocation,
          explanation: recommendation.explanation,
          updatedAt: new Date(),
        },
      };

      const user = await User.findByIdAndUpdate(req.user._id, updates, {
        new: true,
        runValidators: true,
      });

      res.json({
        message: 'Investment profile saved',
        investmentProfile: user.investmentProfile,
        mutualFunds,
        onboarding: user.onboarding,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          currency: user.currency,
          timezone: user.timezone,
          notifications: user.notifications,
          onboarding: user.onboarding,
          investmentProfile: user.investmentProfile,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (error) {
      console.error('Save investment profile error:', error);
      res.status(500).json({ message: 'Server error saving investment profile' });
    }
  }
);

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-()]+$/)
    .withMessage('Please provide a valid phone number'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Please provide a valid date'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD'])
    .withMessage('Invalid currency'),
  body('timezone')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid timezone'),
  // Notifications preferences
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Notifications must be an object'),
  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('notifications.email must be a boolean'),
  body('notifications.transactionAlerts')
    .optional()
    .isBoolean()
    .withMessage('notifications.transactionAlerts must be a boolean'),
  body('notifications.budgetAlerts')
    .optional()
    .isBoolean()
    .withMessage('notifications.budgetAlerts must be a boolean'),
  body('notifications.weeklyReports')
    .optional()
    .isBoolean()
    .withMessage('notifications.weeklyReports must be a boolean'),
  body('notifications.monthlyReports')
    .optional()
    .isBoolean()
    .withMessage('notifications.monthlyReports must be a boolean')
], auth, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const allowedUpdates = [
      'firstName', 
      'lastName', 
      'phone', 
      'dateOfBirth', 
      'currency', 
      'timezone',
      'notifications'
    ];
    
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        currency: user.currency,
        timezone: user.timezone,
        notifications: user.notifications,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Server error during profile update'
    });
  }
});

// @route   PUT /api/users/email
// @desc    Update user email
// @access  Private
router.put('/email', [
  body('email')
    .isEmail()
    .normalizeEmail(emailNormalizationOptions)
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required to change email')
], auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Check if email is already taken
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: req.user._id } 
    });
    
    if (existingUser) {
      return res.status(400).json({
        message: 'Email is already in use'
      });
    }

    // Get user with password for verification
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Incorrect password'
      });
    }

    // Update email and reset verification status
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    user.email = email;
    user.isEmailVerified = false;
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    await user.save();

    // Send verification email to new address
    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Continue with success response as email was updated
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      // Continue with success response as email was updated
    }

    res.json({
      message: 'Email updated successfully. Please check your new email address for verification.',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error('Email update error:', error);
    res.status(500).json({
      message: 'Server error during email update'
    });
  }
});

// @route   POST /api/users/resend-verification
// @desc    Resend email verification
// @access  Private
router.post('/resend-verification', auth, sensitiveOperationLimit(15 * 60 * 1000, 3), async (req, res) => {
  try {
    if (req.user.isEmailVerified) {
      return res.status(400).json({
        message: 'Email is already verified'
      });
    }

    const user = await User.findById(req.user._id);
    
    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();
    
    // Send verification email
    try {
      const emailResult = await emailService.sendVerificationEmail(user, verificationToken);
      
      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        return res.status(500).json({
          message: 'Failed to send verification email. Please try again later.'
        });
      }
    } catch (emailError) {
      console.error('Email service error:', emailError);
      return res.status(500).json({
        message: 'Failed to send verification email. Please try again later.'
      });
    }
    
    res.json({
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/users/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', [
  body('password')
    .notEmpty()
    .withMessage('Password is required to deactivate account'),
  body('confirmation')
    .equals('DELETE')
    .withMessage('Please type DELETE to confirm account deactivation')
], auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { password } = req.body;

    // Get user with password for verification
    const user = await User.findById(req.user._id).select('+password');

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        message: 'Incorrect password'
      });
    }

    // Deactivate account instead of deleting
    user.isActive = false;
    user.email = `deleted_${Date.now()}_${user.email}`;
    await user.save();

    res.json({
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Account deactivation error:', error);
    res.status(500).json({
      message: 'Server error during account deactivation'
    });
  }
});

// @route   GET /api/users/stats
// @desc    Get user account statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const Budget = require('../models/Budget');
    const Category = require('../models/Category');

    const [
      transactionCount,
      budgetCount,
      categoryCount,
      recentTransactions
    ] = await Promise.all([
      Transaction.countDocuments({ user: req.user._id }),
      Budget.countDocuments({ user: req.user._id, isActive: true }),
      Category.countDocuments({ user: req.user._id, isActive: true }),
      Transaction.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('category', 'name color icon')
    ]);

    // Calculate total income and expenses for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          date: { $gte: startOfMonth },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      totalTransactions: transactionCount,
      activeBudgets: budgetCount,
      totalCategories: categoryCount,
      accountAge: Math.floor((Date.now() - req.user.createdAt) / (1000 * 60 * 60 * 24)),
      monthlyStats: monthlyStats.reduce((acc, stat) => {
        acc[stat._id] = {
          total: stat.total,
          count: stat.count
        };
        return acc;
      }, {}),
      recentTransactions
    };

    res.json({
      message: 'User statistics retrieved successfully',
      stats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      message: 'Server error retrieving statistics'
    });
  }
});

// @route   GET /api/users/integrations/groww
// @desc    Get Groww integration status
// @access  Private
router.get('/integrations/groww', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('integrations.groww');
    const groww = user?.integrations?.groww;
    const accounts = normalizeGrowwAccounts(groww);
    res.json({
      message: 'Groww integration status retrieved successfully',
      integration: {
        connected: accounts.some((a) => Boolean(a?.apiKeyEnc && a?.apiSecretEnc)),
        updatedAt: groww?.updatedAt || null,
        defaultAccountId: accounts[0]?.id || null,
        accounts: accounts.map((a) => ({
          id: a?.id,
          label: a?.label,
          connected: Boolean(a?.apiKeyEnc && a?.apiSecretEnc),
          updatedAt: a?.updatedAt || null,
        })),
      },
    });
  } catch (error) {
    console.error('Get Groww integration status error:', error);
    res.status(500).json({ message: 'Server error retrieving Groww integration status' });
  }
});

// @route   PUT /api/users/integrations/groww
// @desc    Save Groww API credentials (encrypted)
// @access  Private
router.put(
  '/integrations/groww',
  [
    body('label').optional().isString().isLength({ min: 1, max: 50 }).withMessage('label must be 1-50 chars'),
    body('accountId').optional().isString().withMessage('accountId must be a string'),
    body('apiKey').isString().notEmpty().withMessage('apiKey is required'),
    body('apiSecret').isString().notEmpty().withMessage('apiSecret is required'),
  ],
  auth,
  sensitiveOperationLimit(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const apiKey = String(req.body.apiKey).trim();
      const apiSecret = String(req.body.apiSecret).trim();
      const label = String(req.body.label || 'Primary').trim();
      const accountId = req.body.accountId ? String(req.body.accountId).trim() : '';
      const newId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const now = new Date();

      const user = await User.findById(req.user._id).select('integrations.groww');
      if (!user) return res.status(404).json({ message: 'User not found' });

      const groww = user?.integrations?.groww;
      const accounts = normalizeGrowwAccounts(groww).filter((a) => a?.id);
      const encKey = encryptIntegrationValue(apiKey);
      const encSecret = encryptIntegrationValue(apiSecret);

      if (accountId) {
        const idx = accounts.findIndex((a) => String(a.id) === String(accountId));
        if (idx === -1) return res.status(404).json({ message: 'Groww account not found' });
        accounts[idx] = { ...accounts[idx], label, apiKeyEnc: encKey, apiSecretEnc: encSecret, updatedAt: now };
      } else {
        accounts.push({ id: newId, label, apiKeyEnc: encKey, apiSecretEnc: encSecret, createdAt: now, updatedAt: now });
      }

      user.integrations = user.integrations || {};
      user.integrations.groww = {
        ...(user.integrations.groww || {}),
        accounts,
        apiKeyEnc: '',
        apiSecretEnc: '',
        updatedAt: now,
      };
      await user.save();

      res.json({
        message: 'Groww integration saved successfully',
        accountId: accountId || newId,
      });
    } catch (error) {
      console.error('Save Groww integration error:', error);
      res.status(500).json({ message: 'Server error saving Groww integration' });
    }
  }
);

// @route   DELETE /api/users/integrations/groww
// @desc    Remove Groww integration credentials
// @access  Private
router.delete('/integrations/groww', auth, sensitiveOperationLimit(), async (req, res) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    const now = new Date();
    const user = await User.findById(req.user._id).select('integrations.groww');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const groww = user?.integrations?.groww;
    const accounts = normalizeGrowwAccounts(groww).filter((a) => a?.id);

    if (accountId) {
      const next = accounts.filter((a) => String(a.id) !== String(accountId));
      user.integrations = user.integrations || {};
      user.integrations.groww = {
        ...(user.integrations.groww || {}),
        accounts: next,
        updatedAt: now,
      };
    } else {
      user.integrations = user.integrations || {};
      user.integrations.groww = {
        ...(user.integrations.groww || {}),
        accounts: [],
        apiKeyEnc: '',
        apiSecretEnc: '',
        updatedAt: now,
      };
    }

    await user.save();

    res.json({ message: 'Groww integration removed successfully' });
  } catch (error) {
    console.error('Remove Groww integration error:', error);
    res.status(500).json({ message: 'Server error removing Groww integration' });
  }
});

// @route   GET /api/users/portfolio/groww
// @desc    Fetch Groww user profile and portfolio using saved credentials
// @access  Private
router.get('/portfolio/groww', auth, async (req, res) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    const user = await User.findById(req.user._id).select('integrations.groww');
    const account = getGrowwAccountFromUser({ user, accountId });
    if (!account?.apiKeyEnc || !account?.apiSecretEnc) {
      return res.status(400).json({ message: 'Groww integration not connected. Please add API keys first.' });
    }

    const apiKey = decryptIntegrationValue(account.apiKeyEnc);
    const apiSecret = decryptIntegrationValue(account.apiSecretEnc);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'Groww integration is invalid. Please re-add API keys.' });
    }

    const data = await fetchGrowwPortfolio({ apiKey, apiSecret });
    res.json({
      message: 'Groww portfolio retrieved successfully',
      data: { ...data, account: { id: account?.id, label: account?.label } },
    });
  } catch (error) {
    console.error('Fetch Groww portfolio error:', error);
    res.status(502).json({
      message: 'Failed to fetch Groww portfolio',
      details: {
        status: error?.status,
        error: error?.message,
        data: error?.data,
      },
    });
  }
});

// @route   GET /api/users/portfolio/groww/holdings-list
// @desc    Fetch Groww holdings list (compact) using saved credentials
// @access  Private
router.get('/portfolio/groww/holdings-list', auth, async (req, res) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    const user = await User.findById(req.user._id).select('integrations.groww');
    const account = getGrowwAccountFromUser({ user, accountId });
    if (!account?.apiKeyEnc || !account?.apiSecretEnc) {
      return res.status(400).json({ message: 'Groww integration not connected. Please add API keys first.' });
    }

    const apiKey = decryptIntegrationValue(account.apiKeyEnc);
    const apiSecret = decryptIntegrationValue(account.apiSecretEnc);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'Groww integration is invalid. Please re-add API keys.' });
    }

    const accessToken = await getGrowwAccessToken({ apiKey, apiSecret });
    if (!accessToken) throw new Error('Failed to obtain Groww access token.');

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'X-API-VERSION': '1.0',
    };

    const holdingsRes = await fetchGrowwHoldings({ headers });
    const holdingsRaw = holdingsRes?.payload?.holdings || [];
    const holdings = await addLiveQuotesToHoldings({ holdings: holdingsRaw, headers });
    const list = holdings
      .map((h) => {
        const qty = toNumber(h?.quantity) || 0;
        const avg = toNumber(h?.average_price) || 0;
        const invested = qty * avg;
        const ltp = getHoldingLtp(h);
        const marketValue = ltp !== null ? qty * ltp : null;
        const pnlFromApi = getHoldingPnl(h);
        const pnl = pnlFromApi !== null ? pnlFromApi : (marketValue !== null ? marketValue - invested : null);
        const pnlPct = invested > 0 && pnl !== null ? (100 * pnl) / invested : null;
        return {
          tradingSymbol: h?.trading_symbol || '',
          isin: h?.isin || '',
          quantity: qty,
          averagePrice: avg,
          invested,
          ltp,
          marketValue,
          pnl,
          pnlPct,
        };
      })
      .filter((r) => r.tradingSymbol)
      .sort((a, b) => b.invested - a.invested);

    res.json({
      message: 'Groww holdings retrieved successfully',
      data: {
        account: { id: account?.id, label: account?.label },
        holdings: list,
      },
    });
  } catch (error) {
    res.status(502).json({
      message: 'Failed to fetch Groww holdings',
      details: {
        status: error?.status,
        error: error?.message,
        data: error?.data,
      },
    });
  }
});

// @route   GET /api/users/portfolio/groww/holding
// @desc    Fetch one holding + quote + history for better AI context
// @access  Private
router.get('/portfolio/groww/holding', auth, async (req, res) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    const tradingSymbol = req.query.tradingSymbol ? String(req.query.tradingSymbol).toUpperCase() : '';
    const exchange = String(req.query.exchange || 'NSE').toUpperCase();
    const segment = String(req.query.segment || 'CASH').toUpperCase();
    const candleInterval = normalizeCandleInterval(req.query.candleInterval || '1day');
    const daysRaw = Number(req.query.days);
    const daysRequested = Number.isFinite(daysRaw) ? Math.max(1, daysRaw) : 180;
    const days = Math.min(daysRequested, maxDaysForInterval(candleInterval));

    if (!tradingSymbol) {
      return res.status(400).json({ message: 'Missing tradingSymbol' });
    }

    const user = await User.findById(req.user._id).select('integrations.groww');
    const account = getGrowwAccountFromUser({ user, accountId });
    if (!account?.apiKeyEnc || !account?.apiSecretEnc) {
      return res.status(400).json({ message: 'Groww integration not connected. Please add API keys first.' });
    }

    const apiKey = decryptIntegrationValue(account.apiKeyEnc);
    const apiSecret = decryptIntegrationValue(account.apiSecretEnc);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'Groww integration is invalid. Please re-add API keys.' });
    }

    const accessToken = await getGrowwAccessToken({ apiKey, apiSecret });
    if (!accessToken) throw new Error('Failed to obtain Groww access token.');

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'X-API-VERSION': '1.0',
    };

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;

    const [holdingsRes, quoteRes, historyRes] = await Promise.allSettled([
      fetchGrowwHoldings({ headers }),
      fetchGrowwLiveQuote({ headers, exchange, segment, tradingSymbol }),
      fetchGrowwHistoricalCandles({
        apiKey,
        apiSecret,
        exchange,
        segment,
        growwSymbol: `${exchange}-${tradingSymbol}`,
        startTime,
        endTime,
        candleInterval,
      }),
    ]);

    const holdingsPayload = holdingsRes.status === 'fulfilled' ? holdingsRes.value : null;
    const holdings = holdingsPayload?.payload?.holdings || [];
    const holding = holdings.find((h) => String(h?.trading_symbol || '').toUpperCase() === tradingSymbol) || null;
    if (!holding) {
      return res.status(404).json({ message: `Holding not found for ${tradingSymbol}` });
    }

    const quote = quoteRes.status === 'fulfilled' ? quoteRes.value : null;
    const history = historyRes.status === 'fulfilled' ? historyRes.value : null;
    const candles = history?.payload?.candles || history?.candles || [];

    res.json({
      message: 'Groww holding retrieved successfully',
      data: {
        account: { id: account?.id, label: account?.label },
        holding,
        quote: quote?.payload || quote || null,
        history: {
          exchange,
          segment,
          tradingSymbol,
          candleInterval,
          startTime,
          endTime,
          candles,
          summary: summarizeCandles(candles),
        },
      },
    });
  } catch (error) {
    res.status(502).json({
      message: 'Failed to fetch Groww holding',
      details: {
        status: error?.status,
        error: error?.message,
        data: error?.data,
      },
    });
  }
});

// @route   GET /api/users/portfolio/groww/all
// @desc    Fetch all connected Groww accounts and compute a cumulative view
// @access  Private
router.get('/portfolio/groww/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('integrations.groww');
    const groww = user?.integrations?.groww;
    const accounts = normalizeGrowwAccounts(groww).filter((a) => a?.id);
    const connectedAccounts = accounts.filter((a) => a?.apiKeyEnc && a?.apiSecretEnc);
    if (!connectedAccounts.length) {
      return res.status(400).json({ message: 'No Groww accounts connected.' });
    }

    const perAccount = await Promise.all(
      connectedAccounts.map(async (a) => {
        const apiKey = decryptIntegrationValue(a.apiKeyEnc);
        const apiSecret = decryptIntegrationValue(a.apiSecretEnc);
        if (!apiKey || !apiSecret) {
          return { account: { id: a.id, label: a.label }, ok: false, error: 'Invalid credentials' };
        }
        try {
          const data = await fetchGrowwPortfolio({ apiKey, apiSecret });
          const holdings = data?.holdings?.payload?.holdings || [];
          const summary = summarizeHoldings(holdings);
          return { account: { id: a.id, label: a.label }, ok: true, data, summary };
        } catch (e) {
          return { account: { id: a.id, label: a.label }, ok: false, error: e?.message || 'Failed to fetch portfolio', details: e?.data };
        }
      })
    );

    const totals = perAccount.reduce(
      (acc, r) => {
        if (!r.ok) return acc;
        acc.invested += r.summary?.invested || 0;
        acc.marketValue += r.summary?.marketValue || 0;
        acc.pnl += r.summary?.pnl || 0;
        return acc;
      },
      { invested: 0, marketValue: 0, pnl: 0 }
    );

    res.json({
      message: 'Groww portfolios retrieved successfully',
      data: {
        totals,
        accounts: perAccount,
      },
    });
  } catch (error) {
    res.status(502).json({
      message: 'Failed to fetch Groww portfolios',
      details: {
        status: error?.status,
        error: error?.message,
        data: error?.data,
      },
    });
  }
});

// @route   GET /api/users/market/groww/history
// @desc    Fetch Groww historical candle data for a stock/index using saved credentials
// @access  Private
router.get('/market/groww/history', auth, async (req, res) => {
  try {
    const accountId = req.query.accountId ? String(req.query.accountId) : '';
    const exchange = String(req.query.exchange || 'NSE').toUpperCase();
    const segment = String(req.query.segment || 'CASH').toUpperCase();
    const tradingSymbol = req.query.tradingSymbol ? String(req.query.tradingSymbol).toUpperCase() : '';
    const growwSymbolParam = req.query.growwSymbol ? String(req.query.growwSymbol) : '';
    const candleInterval = normalizeCandleInterval(req.query.candleInterval || '1day');
    const daysRaw = Number(req.query.days);
    const daysRequested = Number.isFinite(daysRaw) ? Math.max(1, daysRaw) : 180;
    const days = Math.min(daysRequested, maxDaysForInterval(candleInterval));

    const growwSymbol = growwSymbolParam || (tradingSymbol ? `${exchange}-${tradingSymbol}` : '');
    if (!growwSymbol) {
      return res.status(400).json({ message: 'Missing growwSymbol or tradingSymbol' });
    }

    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - days * 24 * 60 * 60;

    const user = await User.findById(req.user._id).select('integrations.groww');
    const account = getGrowwAccountFromUser({ user, accountId });
    if (!account?.apiKeyEnc || !account?.apiSecretEnc) {
      return res.status(400).json({ message: 'Groww integration not connected. Please add API keys first.' });
    }

    const apiKey = decryptIntegrationValue(account.apiKeyEnc);
    const apiSecret = decryptIntegrationValue(account.apiSecretEnc);
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'Groww integration is invalid. Please re-add API keys.' });
    }

    const data = await fetchGrowwHistoricalCandles({
      apiKey,
      apiSecret,
      exchange,
      segment,
      growwSymbol,
      startTime,
      endTime,
      candleInterval,
    });

    res.json({
      message: 'Groww historical candles retrieved successfully',
      data: {
        exchange,
        segment,
        growwSymbol,
        candleInterval,
        startTime,
        endTime,
        candles: data?.payload?.candles || data?.candles || [],
      },
    });
  } catch (error) {
    res.status(502).json({
      message: 'Failed to fetch historical candles',
      details: {
        status: error?.status,
        error: error?.message,
        data: error?.data,
      },
    });
  }
});

module.exports = router;
