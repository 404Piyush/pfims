const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function getArg(name, defaultVal) {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === prefix) {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) return next;
      return true;
    }
    if (arg.startsWith(prefix + '=')) {
      return arg.split('=')[1];
    }
  }
  return defaultVal;
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return null;
  const num = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(num) ? num : null;
}

function formatMoneyInr(val) {
  const num = toNumber(val);
  if (num === null) return 'n/a';
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num);
  } catch (e) {
    return `₹${num.toFixed(2)}`;
  }
}

function formatQty(val) {
  const num = toNumber(val);
  if (num === null) return 'n/a';
  return Number.isInteger(num) ? String(num) : String(num);
}

function pickPayload(res) {
  return res?.payload ?? res;
}

function getHoldingsList(holdingsRes) {
  const payload = pickPayload(holdingsRes);
  if (Array.isArray(payload?.holdings)) return payload.holdings;
  if (Array.isArray(payload)) return payload;
  return [];
}

function getPositionsList(positionsRes) {
  const payload = pickPayload(positionsRes);
  if (Array.isArray(payload?.positions)) return payload.positions;
  if (Array.isArray(payload)) return payload;
  return [];
}

function printDetailedReport({ profile, holdings, positionsCash, positionsFno, margins }) {
  const profilePayload = pickPayload(profile);
  const marginsPayload = pickPayload(margins);
  const holdingsList = getHoldingsList(holdings);
  const positionsCashList = getPositionsList(positionsCash);
  const positionsFnoList = getPositionsList(positionsFno);

  console.log('Groww portfolio (detailed)');
  console.log(`Generated at: ${new Date().toISOString()}`);

  console.log('\nUser profile');
  console.log(JSON.stringify(profilePayload ?? null, null, 2));

  console.log('\nMargin / balance');
  console.log(JSON.stringify(marginsPayload ?? null, null, 2));

  console.log('\nHoldings');
  if (!holdingsList.length) {
    console.log('(none)');
  } else {
    let totalInvested = 0;
    for (const h of holdingsList) {
      const tradingSymbol = h?.trading_symbol ?? h?.tradingSymbol ?? 'n/a';
      const isin = h?.isin ?? 'n/a';
      const quantity = toNumber(h?.quantity);
      const averagePrice = toNumber(h?.average_price ?? h?.averagePrice);
      const invested = quantity !== null && averagePrice !== null ? quantity * averagePrice : null;
      if (invested !== null) totalInvested += invested;

      console.log(`\n${tradingSymbol}`);
      console.log(`- isin: ${isin}`);
      console.log(`- quantity: ${formatQty(h?.quantity)}`);
      console.log(`- average_price: ${formatMoneyInr(averagePrice)}`);
      console.log(`- invested_amount (qty*avg): ${formatMoneyInr(invested)}`);
      console.log(`- pledge_quantity: ${formatQty(h?.pledge_quantity)}`);
      console.log(`- demat_locked_quantity: ${formatQty(h?.demat_locked_quantity)}`);
      console.log(`- groww_locked_quantity: ${formatQty(h?.groww_locked_quantity)}`);
      console.log(`- repledge_quantity: ${formatQty(h?.repledge_quantity)}`);
      console.log(`- t1_quantity: ${formatQty(h?.t1_quantity)}`);
      console.log(`- demat_free_quantity: ${formatQty(h?.demat_free_quantity)}`);
      console.log(`- corporate_action_additional_quantity: ${formatQty(h?.corporate_action_additional_quantity)}`);
      console.log(`- active_demat_transfer_quantity: ${formatQty(h?.active_demat_transfer_quantity)}`);
      const extraKeys = Object.keys(h || {}).filter(
        (k) =>
          ![
            'isin',
            'trading_symbol',
            'tradingSymbol',
            'quantity',
            'average_price',
            'averagePrice',
            'pledge_quantity',
            'demat_locked_quantity',
            'groww_locked_quantity',
            'repledge_quantity',
            't1_quantity',
            'demat_free_quantity',
            'corporate_action_additional_quantity',
            'active_demat_transfer_quantity',
          ].includes(k)
      );
      if (extraKeys.length) {
        console.log(`- extra: ${JSON.stringify(extraKeys.reduce((acc, k) => ({ ...acc, [k]: h[k] }), {}), null, 2)}`);
      }
    }
    console.log(`\nHoldings summary: count=${holdingsList.length} total_invested≈${formatMoneyInr(totalInvested)}`);
  }

  console.log('\nPositions (CASH)');
  console.log(JSON.stringify(positionsCashList, null, 2));

  console.log('\nPositions (FNO)');
  console.log(JSON.stringify(positionsFnoList, null, 2));
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
    const message = typeof data === 'object' && data ? (data.message || data.error || JSON.stringify(data)) : String(data);
    const err = new Error(`HTTP ${res.status} ${res.statusText} for ${method} ${url}: ${message}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function getAccessToken() {
  const existing = getArg('accessToken', process.env.GROWW_ACCESS_TOKEN);
  if (existing) return String(existing);

  const apiKey = process.env.GROWW_API_KEY;
  const apiSecret = process.env.GROWW_API_SECRET;

  if (!apiKey) {
    throw new Error('Missing GROWW_API_KEY (or pass --accessToken).');
  }

  const keyType = String(getArg('keyType', 'approval'));
  if (keyType === 'totp') {
    const totp = String(getArg('totp', ''));
    if (!totp) throw new Error('Missing --totp for keyType=totp.');
    const tokenRes = await requestJson({
      method: 'POST',
      url: 'https://api.groww.in/v1/token/api/access',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: { key_type: 'totp', totp },
    });
    return tokenRes?.payload?.token || tokenRes?.token;
  }

  if (!apiSecret) {
    throw new Error('Missing GROWW_API_SECRET (needed to generate access token).');
  }

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

async function fetchMargins({ accessToken, apiKey, apiVersion }) {
  const baseHeaders = {
    Accept: 'application/json',
  };

  const attempts = [
    {
      url: 'https://api.groww.in/v1/margins/detail/user',
      headers: { ...baseHeaders, Authorization: `Bearer ${accessToken}`, 'X-API-VERSION': apiVersion },
    },
    {
      url: 'https://api.groww.in/v1/api/apex/v1/margins/detail/user',
      headers: { ...baseHeaders, Authorization: `Bearer ${accessToken}`, 'X-API-VERSION': apiVersion },
    },
    apiKey
      ? { url: 'https://api.groww.in/v1/margins/detail/user', headers: { ...baseHeaders, Authorization: `Bearer ${apiKey}` } }
      : null,
    apiKey
      ? { url: 'https://api.groww.in/v1/api/apex/v1/margins/detail/user', headers: { ...baseHeaders, Authorization: `Bearer ${apiKey}` } }
      : null,
  ].filter(Boolean);

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      return await requestJson({ method: 'GET', url: attempt.url, headers: attempt.headers });
    } catch (err) {
      lastErr = err;
      if (![401, 403, 404].includes(err?.status)) throw err;
    }
  }
  throw lastErr || new Error('Failed to fetch margins.');
}

async function fetchPositions({ headers, segment }) {
  const urls = [
    `https://api.groww.in/v1/positions/user?segment=${encodeURIComponent(segment)}`,
    'https://api.groww.in/v1/positions/user',
  ];

  let lastErr = null;
  for (const url of urls) {
    try {
      return await requestJson({ method: 'GET', url, headers });
    } catch (err) {
      lastErr = err;
      if (![400, 404].includes(err?.status)) throw err;
    }
  }
  throw lastErr || new Error('Failed to fetch positions.');
}

async function run() {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Failed to obtain access token.');

  const summary = Boolean(getArg('summary', false));
  const rawOnly = Boolean(getArg('raw', false));
  const reportOnly = Boolean(getArg('report', false));
  const apiVersion = String(getArg('apiVersion', '1.0'));
  const apiKey = process.env.GROWW_API_KEY;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'X-API-VERSION': apiVersion,
  };

  const results = await Promise.allSettled([
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/user/detail', headers }),
    requestJson({ method: 'GET', url: 'https://api.groww.in/v1/holdings/user', headers }),
    fetchPositions({ headers, segment: 'CASH' }),
    fetchPositions({ headers, segment: 'FNO' }),
    fetchMargins({ accessToken, apiKey, apiVersion }),
  ]);

  const unwrap = (r) => (r.status === 'fulfilled' ? r.value : { status: 'FAILURE', error: r.reason?.message || 'Request failed' });
  const [profile, holdings, positionsCash, positionsFno, margins] = results.map(unwrap);

  const data = { profile, holdings, positions: { CASH: positionsCash, FNO: positionsFno }, margins };

  if (summary) {
    const holdingsList = getHoldingsList(holdings);
    const positionsCashList = getPositionsList(positionsCash);
    const positionsFnoList = getPositionsList(positionsFno);
    const marginPayload = pickPayload(margins);
    const profilePayload = pickPayload(profile);

    console.log('Groww snapshot');
    if (profilePayload && typeof profilePayload === 'object') {
      const vendorUserId = profilePayload.vendor_user_id ?? profilePayload.vendorUserId;
      const ucc = profilePayload.ucc;
      const segments = Array.isArray(profilePayload.active_segments) ? profilePayload.active_segments.join(',') : undefined;
      console.log(`- Profile: vendor_user_id=${vendorUserId ?? 'n/a'} ucc=${ucc ?? 'n/a'} segments=${segments ?? 'n/a'}`);
    } else {
      console.log('- Profile: n/a');
    }
    console.log(`- Holdings: ${holdingsList.length}`);
    console.log(`- Positions (CASH): ${positionsCashList.length}`);
    console.log(`- Positions (FNO): ${positionsFnoList.length}`);
    if (marginPayload && typeof marginPayload === 'object') {
      const clearCash = marginPayload.clear_cash ?? marginPayload.clearCash;
      const collateralAvailable = marginPayload.collateral_available ?? marginPayload.collateralAvailable;
      const netMarginUsed = marginPayload.net_margin_used ?? marginPayload.netMarginUsed;
      console.log(
        `- Margin: clear_cash=${clearCash ?? 'n/a'} collateral_available=${collateralAvailable ?? 'n/a'} net_margin_used=${netMarginUsed ?? 'n/a'}`
      );
    } else {
      console.log('- Margin: n/a');
    }
    console.log('\nTip: default run prints full details + raw. Use --raw for raw only, --report for report only.');
    return;
  }

  if (rawOnly) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  printDetailedReport({
    profile,
    holdings,
    positionsCash: positionsCash,
    positionsFno: positionsFno,
    margins,
  });

  if (!reportOnly) {
    console.log('\nRaw response');
    console.log(JSON.stringify(data, null, 2));
  }
}

run().catch((err) => {
  const status = err?.status;
  console.error(`❌ ${err?.message || 'Failed'}`);
  if (status) console.error(`Status: ${status}`);
  process.exitCode = 1;
});
