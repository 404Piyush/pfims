const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const User = require('../models/User');
const { auth, checkOwnership } = require('../middleware/auth');
const { handleValidationErrors, apiRateLimit, expensiveOperationSlowDown } = require('../middleware/validation');
const QueryOptimizer = require('../utils/queryOptimizer');
const BudgetAlertService = require('../utils/budgetAlertService');
const emailService = require('../utils/emailService');
const ExcelJS = require('exceljs');
const multer = require('multer');
const officeCrypto = require('officecrypto-tool');
const path = require('path');
const { pathToFileURL } = require('url');
const fetch = global.fetch || require('node-fetch');

const router = express.Router();

let pdfjsModulePromise = null;
const getPdfJs = async () => {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/build/pdf.mjs');
  }
  return pdfjsModulePromise;
};

const extractPdfTextFromBuffer = async (buffer, { password } = {}) => {
  const pdfjs = await getPdfJs();
  const data = new Uint8Array(buffer);

  const pkgPath = require.resolve('pdfjs-dist/package.json');
  const pkgDir = path.dirname(pkgPath);
  const standardFontDataUrl = pathToFileURL(path.join(pkgDir, 'standard_fonts/')).toString();

  const loadingTask = pdfjs.getDocument({
    data,
    password: password ? String(password) : undefined,
    standardFontDataUrl,
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = (content?.items || [])
      .map((it) => (typeof it?.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(pageText);
  }

  return pages.join('\n');
};

const parseXlsxDateToIso = (value) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const d = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0));
    return d.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return null;
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
    return utc.toISOString();
  }
  if (typeof value === 'string') return parseDdMmYyyyToIso(value);
  return null;
};

const stringifyXlsxCell = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.result === 'string' || typeof value.result === 'number') return String(value.result);
    if (Array.isArray(value.richText)) return value.richText.map((x) => x.text).join('');
  }
  return String(value);
};

const parseBankStatementXlsxBuffer = async (buffer, { password } = {}) => {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const isEncrypted = officeCrypto.isEncrypted(input);
  if (isEncrypted && !password) {
    const err = new Error('XLSX password is required');
    err.code = 'PASSWORD_REQUIRED';
    throw err;
  }

  let decrypted = input;
  if (isEncrypted) {
    try {
      decrypted = await officeCrypto.decrypt(input, { password: String(password) });
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      const err = new Error(msg.includes('incorrect') ? 'Incorrect XLSX password' : 'Failed to decrypt XLSX');
      err.code = msg.includes('incorrect') ? 'PASSWORD_INCORRECT' : 'DECRYPT_FAILED';
      throw err;
    }
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(decrypted);
  const ws = workbook.worksheets?.[0];
  if (!ws) return [];

  let headerRowIndex = null;
  let colDate = null;
  let colDetails = null;
  let colDebit = null;
  let colCredit = null;

  const maxScan = Math.min(ws.rowCount || 0, 60);
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    const cells = [];
    for (let c = 1; c <= Math.min(row.cellCount || 0, 30); c++) {
      const s = stringifyXlsxCell(row.getCell(c).value).trim().toLowerCase();
      if (s) cells.push({ c, s });
    }
    const joined = cells.map((x) => x.s).join(' | ');
    if (!joined.includes('date')) continue;
    if (!(joined.includes('details') || joined.includes('description') || joined.includes('narration'))) continue;
    if (!(joined.includes('debit') || joined.includes('withdraw') || joined.includes('dr'))) continue;
    if (!(joined.includes('credit') || joined.includes('deposit') || joined.includes('cr'))) continue;

    headerRowIndex = r;
    for (const cell of cells) {
      if (cell.s === 'date' || cell.s.includes('date')) colDate = cell.c;
      else if (cell.s.includes('details') || cell.s.includes('description') || cell.s.includes('narration')) colDetails = cell.c;
      else if (cell.s.includes('debit') || cell.s.includes('withdraw') || cell.s === 'dr') colDebit = cell.c;
      else if (cell.s.includes('credit') || cell.s.includes('deposit') || cell.s === 'cr') colCredit = cell.c;
    }
    break;
  }

  if (!headerRowIndex) {
    headerRowIndex = 18;
    colDate = 1;
    colDetails = 2;
    colDebit = 4;
    colCredit = 5;
  }

  const out = [];
  let emptyStreak = 0;
  for (let r = headerRowIndex + 1; r <= (ws.rowCount || headerRowIndex); r++) {
    const row = ws.getRow(r);
    const rawDate = row.getCell(colDate).value;
    const rawDetails = stringifyXlsxCell(row.getCell(colDetails).value).replace(/\s+/g, ' ').trim();

    const dateIso = parseXlsxDateToIso(rawDate);
    if (!dateIso && !rawDetails) {
      emptyStreak += 1;
      if (emptyStreak >= 5) break;
      continue;
    }
    emptyStreak = 0;
    if (!dateIso) continue;

    const debit = toNumberFromAmount(stringifyXlsxCell(row.getCell(colDebit).value));
    const credit = toNumberFromAmount(stringifyXlsxCell(row.getCell(colCredit).value));

    const amount = typeof credit === 'number' && credit > 0 ? credit : typeof debit === 'number' && debit > 0 ? debit : null;
    if (!amount) continue;

    const type = typeof credit === 'number' && credit > 0 ? 'income' : 'expense';
    const title = (rawDetails || 'Bank transaction').slice(0, 100);

    out.push({
      date: dateIso,
      title,
      description: rawDetails.slice(0, 500),
      amount,
      type,
    });

    if (out.length >= 500) break;
  }

  return out;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = typeof file?.originalname === 'string' ? path.extname(file.originalname).toLowerCase() : '';
    const mt = file?.mimetype;
    if (mt === 'application/pdf' || ext === '.pdf') return cb(null, true);
    if (mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx') return cb(null, true);
    cb(new Error('Only PDF or XLSX files are allowed'));
  },
});

const toNumberFromAmount = (s) => {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  if (typeof s !== 'string') return null;
  const cleaned = s.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
};

const parseDdMmYyyyToIso = (s) => {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const parseBankStatementText = (text) => {
  const raw = typeof text === 'string' ? text : '';
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const out = [];
  for (const line of lines) {
    const dateMatch = line.match(/^(\d{2}[\/-]\d{2}[\/-]\d{4})\s+(.*)$/);
    if (!dateMatch) continue;

    const dateIso = parseDdMmYyyyToIso(dateMatch[1]);
    if (!dateIso) continue;

    const rest = dateMatch[2] || '';
    const amountMatches = rest.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g) || [];
    if (!amountMatches.length) continue;

    const nums = amountMatches
      .map(toNumberFromAmount)
      .filter((n) => typeof n === 'number' && Number.isFinite(n));
    if (!nums.length) continue;

    const txnAmount = nums.length >= 2 ? nums[nums.length - 2] : nums[nums.length - 1];
    if (!txnAmount || !Number.isFinite(txnAmount)) continue;

    const upper = rest.toUpperCase();
    let type = txnAmount < 0 ? 'expense' : 'income';
    if (/\bDR\b|\bDEBIT\b|\bWITHDRAW(AL)?\b/.test(upper)) type = 'expense';
    if (/\bCR\b|\bCREDIT\b|\bDEPOSIT\b|\bSALARY\b|\bNEFT\b/.test(upper)) type = 'income';

    const title = rest
      .replace(/-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100) || 'Bank transaction';

    out.push({
      date: dateIso,
      title,
      description: rest.slice(0, 500),
      amount: Math.abs(txnAmount),
      type,
    });
  }

  return out;
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const extractJsonArray = (text) => {
  const t = String(text || '').trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t);
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
  }

  const fenced = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      const parsed = JSON.parse(fenced[1].trim());
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
    }
  }

  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    const slice = t.slice(start, end + 1);
    try {
      const parsed = JSON.parse(slice);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
    }
  }

  return null;
};

const normalizeCategoryLabel = (value) => {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const formatCategoryName = (value) => {
  const cleaned = String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((w) => {
      if (!w) return '';
      if (w.length === 1) return w.toUpperCase();
      return w[0].toUpperCase() + w.slice(1);
    })
    .join(' ')
    .trim()
    .slice(0, 50);
};

const tokenSet = (value) => {
  const t = normalizeCategoryLabel(value)
    .split(' ')
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
  return new Set(t);
};

const scoreCategoryMatch = (label, categoryName) => {
  const a = normalizeCategoryLabel(label);
  const b = normalizeCategoryLabel(categoryName);
  if (!a || !b) return 0;
  if (a === b) return 2;
  let score = 0;
  if (b.includes(a)) score += 0.6;

  const ta = tokenSet(a);
  const tb = tokenSet(b);
  if (!ta.size || !tb.size) return score;

  let intersection = 0;
  for (const w of ta) {
    if (tb.has(w)) intersection += 1;
  }
  const union = ta.size + tb.size - intersection;
  if (union > 0) score += intersection / union;
  return score;
};

const buildTxnCategorizationPrompt = ({ transactions }) => {
  const listLines = transactions
    .map((t) => {
      const idx = Number(t.index);
      const type = String(t.type || '').toLowerCase();
      const amount = typeof t.amount === 'number' && Number.isFinite(t.amount) ? t.amount : null;
      const date = typeof t.date === 'string' ? t.date : '';
      const desc = typeof t.description === 'string' ? t.description : (typeof t.title === 'string' ? t.title : '');
      const compactDesc = String(desc || '').replace(/\s+/g, ' ').trim().slice(0, 160);
      return `${idx}\t${type}\t${amount ?? ''}\t${date}\t${compactDesc}`;
    })
    .join('\n');

  const prompt =
    `You are helping categorize bank transactions into user-defined categories.\n` +
    `Rules:\n` +
    `- Choose a concise category label (1-4 words). If unsure, return an empty category.\n` +
    `- Improve the title to be short, human-friendly, and specific (max 60 chars).\n` +
    `- Return ONLY valid JSON (no markdown, no prose).\n\n` +
    `Input transactions as TSV: index\\ttype\\tamount\\tdate\\tdescription\n` +
    `${listLines}\n\n` +
    `Return JSON array with same indexes:\n` +
    `[{"index":0,"title":"...","category":"..."}]`;

  return prompt;
};

// @route   GET /api/transactions
// @desc    Get user transactions with filtering and pagination
// @access  Private
router.get('/', [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('type')
    .optional()
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Invalid transaction type'),
  query('status')
    .optional()
    .isIn(['pending', 'completed', 'cancelled'])
    .withMessage('Invalid transaction status'),
  query('category')
    .optional()
    .isMongoId()
    .withMessage('Invalid category ID'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date'),
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be positive'),
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be positive'),
  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
  query('location')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Location must be between 1 and 100 characters')
], auth, apiRateLimit, handleValidationErrors, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      category,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      location,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build optimized query
    const filters = {
      type,
      status,
      category: QueryOptimizer.validateObjectId(category),
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      location
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === null) {
        delete filters[key];
      }
    });

    const query = QueryOptimizer.buildTransactionQuery(req.user._id, filters);
    const sortOptions = QueryOptimizer.buildSortOptions(sortBy, sortOrder);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute optimized queries in parallel
    const [transactions, total] = await Promise.all([
      QueryOptimizer.optimizeQuery(
        Transaction.find(query)
          .populate('category', 'name color icon type')
          .sort(sortOptions)
          .skip(skip)
          .limit(parseInt(limit)),
        { lean: true }
      ),
      Transaction.countDocuments(query)
    ]);

    // Calculate summary statistics
    const summaryPipeline = QueryOptimizer.buildTransactionAnalyticsPipeline(req.user._id, filters);
    summaryPipeline.push({
      $group: {
        _id: null,
        totalIncome: {
          $sum: {
            $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0]
          }
        },
        totalExpense: {
          $sum: {
            $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0]
          }
        },
        count: { $sum: 1 }
      }
    });

    const [summary] = await Transaction.aggregate(summaryPipeline);

    const response = {
      success: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: parseInt(page) < Math.ceil(total / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1
        },
        summary: summary || {
          totalIncome: 0,
          totalExpense: 0,
          count: 0
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/import/bank-statement/preview', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Statement file is required',
      });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const ext = typeof req.file?.originalname === 'string' ? path.extname(req.file.originalname).toLowerCase() : '';
    const isPdf = req.file?.mimetype === 'application/pdf' || ext === '.pdf';
    const isXlsx =
      req.file?.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || ext === '.xlsx';

    let text = '';
    let transactions = [];
    if (isPdf) {
      try {
        text = await extractPdfTextFromBuffer(req.file.buffer, { password });
      } catch (error) {
        if (error?.name === 'PasswordException') {
          const msg = String(error?.message || '').toLowerCase();
          if (msg.includes('invalid password')) {
            return res.status(400).json({ success: false, message: 'Incorrect PDF password' });
          }
          if (msg.includes('no password')) {
            return res.status(400).json({ success: false, message: 'PDF password is required' });
          }
          return res.status(400).json({ success: false, message: 'Failed to open password-protected PDF' });
        }
        throw error;
      }

      transactions = parseBankStatementText(text).slice(0, 500);
    } else if (isXlsx) {
      try {
        transactions = await parseBankStatementXlsxBuffer(req.file.buffer, { password });
      } catch (error) {
        if (error?.code === 'PASSWORD_REQUIRED') {
          return res.status(400).json({ success: false, message: 'XLSX password is required' });
        }
        if (error?.code === 'PASSWORD_INCORRECT') {
          return res.status(400).json({ success: false, message: 'Incorrect XLSX password' });
        }
        throw error;
      }
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    res.json({
      success: true,
      message: 'Bank statement parsed successfully',
      data: { transactions },
    });
  } catch (error) {
    console.error('Bank statement preview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error parsing bank statement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

router.post('/import/bank-statement/ai-categorize', [
  body('transactions')
    .isArray({ min: 1, max: 200 })
    .withMessage('Transactions must be an array with 1-200 items'),
  body('defaultIncomeCategory')
    .optional()
    .isMongoId()
    .withMessage('defaultIncomeCategory must be a valid category ID'),
  body('defaultExpenseCategory')
    .optional()
    .isMongoId()
    .withMessage('defaultExpenseCategory must be a valid category ID'),
], auth, expensiveOperationSlowDown, handleValidationErrors, async (req, res) => {
  try {
    const txns = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
    const defaultIncomeCategory = typeof req.body?.defaultIncomeCategory === 'string' ? req.body.defaultIncomeCategory : '';
    const defaultExpenseCategory = typeof req.body?.defaultExpenseCategory === 'string' ? req.body.defaultExpenseCategory : '';

    const normalized = txns
      .map((t, index) => {
        const title = typeof t?.title === 'string' ? t.title.trim() : '';
        const description = typeof t?.description === 'string' ? t.description.trim() : '';
        const type = String(t?.type || '').toLowerCase();
        const amount = toNumberFromAmount(t?.amount);
        const date = typeof t?.date === 'string' ? t.date : '';
        return {
          index,
          title: title.slice(0, 100),
          description: description.slice(0, 500),
          type: ['income', 'expense', 'transfer'].includes(type) ? type : 'expense',
          amount: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
          date: date.slice(0, 60),
        };
      })
      .slice(0, 200);

    let categories = await Category.find({
      user: req.user._id,
      isActive: true,
    }).select('name type').lean();

    let otherIncomeId = '';
    let otherExpenseId = '';
    const existingOtherIncome = categories.find((c) => String(c?.name || '').trim().toLowerCase() === 'other income' && (c.type === 'income' || c.type === 'both'));
    const existingOtherExpense = categories.find((c) => String(c?.name || '').trim().toLowerCase() === 'other expenses' && (c.type === 'expense' || c.type === 'both'));
    if (existingOtherIncome?._id) otherIncomeId = String(existingOtherIncome._id);
    if (existingOtherExpense?._id) otherExpenseId = String(existingOtherExpense._id);

    const toCreate = [];
    if (!otherIncomeId) toCreate.push({ user: req.user._id, name: 'Other Income', type: 'income' });
    if (!otherExpenseId) toCreate.push({ user: req.user._id, name: 'Other Expenses', type: 'expense' });
    if (toCreate.length) {
      try {
        const created = await Category.insertMany(toCreate, { ordered: false });
        const createdPlain = created.map((d) => (typeof d?.toObject === 'function' ? d.toObject() : d));
        categories = categories.concat(createdPlain);
        const createdIncome = createdPlain.find((c) => String(c?.name || '').trim().toLowerCase() === 'other income');
        const createdExpense = createdPlain.find((c) => String(c?.name || '').trim().toLowerCase() === 'other expenses');
        if (!otherIncomeId && createdIncome?._id) otherIncomeId = String(createdIncome._id);
        if (!otherExpenseId && createdExpense?._id) otherExpenseId = String(createdExpense._id);
      } catch (e) {
      }
    }

    const incomeNames = categories
      .filter((c) => c?.name && (c.type === 'income' || c.type === 'both'))
      .map((c) => String(c.name).trim())
      .filter(Boolean);
    const expenseNames = categories
      .filter((c) => c?.name && (c.type === 'expense' || c.type === 'both'))
      .map((c) => String(c.name).trim())
      .filter(Boolean);

    if (!incomeNames.length || !expenseNames.length) {
      return res.status(400).json({
        success: false,
        message: 'Please create categories before using auto-categorize',
      });
    }

    const openrouterUrl = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    const openrouterApiKey = process.env.OPENROUTER_API_KEY || process.env.ATLASCLOUD_API_KEY;
    const openrouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    const openrouterReferer = process.env.OPENROUTER_REFERER || process.env.CLIENT_URL;
    const openrouterAppName = process.env.OPENROUTER_APP_NAME || 'PFIMS';
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    const ollamaModel = process.env.OLLAMA_MODEL_LITE || process.env.OLLAMA_MODEL || 'meta-llama-3-8b-instruct-q4km';

    const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || process.env.ATLAS_TIMEOUT_MS || 55000);
    const chunkSizeRaw = Number(process.env.AI_CATEGORIZE_CHUNK_SIZE || 50);
    const chunkSize = Number.isFinite(chunkSizeRaw) ? Math.max(10, Math.min(50, chunkSizeRaw)) : 50;

    const callAi = async (prompt) => {
      const tryOpenRouter = async () => {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterApiKey}`,
        };
        if (openrouterReferer) headers['HTTP-Referer'] = String(openrouterReferer);
        if (openrouterAppName) headers['X-Title'] = String(openrouterAppName);

        const resp = await fetchWithTimeout(openrouterUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: openrouterModel,
            messages: [
              { role: 'system', content: 'Return only valid JSON.' },
              { role: 'user', content: prompt },
            ],
            max_tokens: 2048,
            temperature: 0.2,
            top_p: 0.9,
            stream: false,
          }),
        }, timeoutMs);

        if (!resp.ok) {
          const details = await resp.text();
          const err = new Error('AI service error');
          err.details = details;
          throw err;
        }
        const data = await resp.json();
        return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.content || '';
      };

      const tryOllama = async () => {
        const resp = await fetchWithTimeout(ollamaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: 'system', content: 'Return only valid JSON.' },
              { role: 'user', content: prompt },
            ],
            stream: false,
            options: { temperature: 0.2, num_ctx: 4096 },
          }),
        }, Number(process.env.OLLAMA_TIMEOUT_MS || 45000));

        if (!resp.ok) {
          const details = await resp.text();
          const err = new Error('AI service error');
          err.details = details;
          throw err;
        }
        const data = await resp.json();
        return data?.message?.content || data?.content || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || '';
      };

      if (openrouterApiKey) {
        try {
          return await tryOpenRouter();
        } catch (e) {
          return await tryOllama();
        }
      }
      return await tryOllama();
    };

    const nameToCategory = new Map(
      categories
        .filter((c) => c?.name)
        .map((c) => [String(c.name).trim().toLowerCase(), c])
    );

    const suggestionsByIndex = new Map();
    const resolveCategoryId = (label, txnType) => {
      const raw = typeof label === 'string' ? label.trim() : '';
      if (!raw) return '';

      const exact = nameToCategory.get(raw.toLowerCase());
      if (exact && (exact.type === 'both' || exact.type === txnType || (txnType === 'transfer' && exact.type === 'expense'))) {
        return String(exact._id);
      }

      let best = null;
      let bestScore = 0;
      for (const c of categories) {
        if (!c?.name) continue;
        if (!(c.type === 'both' || c.type === txnType || (txnType === 'transfer' && c.type === 'expense'))) continue;
        const score = scoreCategoryMatch(raw, c.name);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      if (best && bestScore >= 0.35) return String(best._id);
      return '';
    };

    const buildFallbackSuggestions = () => {
      const byType = (txnType) =>
        categories.filter(
          (c) =>
            c?.name &&
            (c.type === 'both' || c.type === txnType || (txnType === 'transfer' && c.type === 'expense'))
        );

      return normalized.map((t) => {
        const txnType = t.type;
        const fallback =
          txnType === 'income'
            ? (defaultIncomeCategory || otherIncomeId || '')
            : (defaultExpenseCategory || otherExpenseId || '');

        const text = `${t.title || ''} ${t.description || ''}`.replace(/\s+/g, ' ').trim();
        let best = null;
        let bestScore = 0;
        for (const c of byType(txnType)) {
          const score = scoreCategoryMatch(c.name, text);
          if (score > bestScore) {
            bestScore = score;
            best = c;
          }
        }

        return {
          index: t.index,
          title: t.title || 'Bank transaction',
          category: best && bestScore >= 0.12 ? String(best._id) : (fallback || ''),
        };
      });
    };

    try {
      for (let start = 0; start < normalized.length; start += chunkSize) {
        const chunk = normalized.slice(start, start + chunkSize);
        const prompt = buildTxnCategorizationPrompt({
          transactions: chunk.map((t) => ({
            index: t.index,
            type: t.type === 'transfer' ? 'expense' : t.type,
            amount: t.amount,
            date: t.date,
            description: t.description || t.title,
          })),
        });

        const aiText = await callAi(prompt);
        const parsed = extractJsonArray(aiText);
        if (!parsed) {
          const err = new Error('AI invalid response');
          err.details = String(aiText || '').slice(0, 2000);
          throw err;
        }

        const maxNewCategoriesRaw = Number(process.env.AI_CATEGORIZE_MAX_NEW_CATEGORIES || 20);
        const maxNewCategories = Number.isFinite(maxNewCategoriesRaw) ? Math.max(0, Math.min(50, maxNewCategoriesRaw)) : 20;
        const pendingCreates = new Map();
        const chunkItems = [];

        for (const item of parsed) {
          const index = Number(item?.index);
          if (!Number.isFinite(index) || index < 0 || index >= normalized.length) continue;

          const title = typeof item?.title === 'string' ? item.title.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
          const categoryLabel = typeof item?.category === 'string' ? item.category.trim() : '';
          const txnType = normalized[index].type;
          const resolvedId = resolveCategoryId(categoryLabel, txnType);

          chunkItems.push({ index, title, categoryLabel, txnType, resolvedId });

          if (!resolvedId && categoryLabel && pendingCreates.size < maxNewCategories) {
            const normalizedLabel = normalizeCategoryLabel(categoryLabel);
            if (normalizedLabel.length < 2 || normalizedLabel.length > 40) continue;
            const typeForCategory = txnType === 'income' ? 'income' : 'expense';
            const key = `${normalizedLabel}|${typeForCategory}`;
            if (pendingCreates.has(key)) continue;

            const name = formatCategoryName(categoryLabel);
            if (!name) continue;
            if (nameToCategory.has(name.toLowerCase())) continue;
            pendingCreates.set(key, { name, type: typeForCategory });
          }
        }

        if (pendingCreates.size) {
          const toInsert = Array.from(pendingCreates.values()).filter((c) => !nameToCategory.has(String(c.name).toLowerCase()));
          if (toInsert.length) {
            try {
              const created = await Category.insertMany(
                toInsert.map((c) => ({ user: req.user._id, name: c.name, type: c.type })),
                { ordered: false }
              );
              const createdPlain = created.map((d) => (typeof d?.toObject === 'function' ? d.toObject() : d));
              categories = categories.concat(createdPlain);
              for (const c of createdPlain) {
                if (c?.name) nameToCategory.set(String(c.name).trim().toLowerCase(), c);
              }
            } catch (e) {
            }
          }
        }

        for (const row of chunkItems) {
          const fallback = row.txnType === 'income'
            ? (defaultIncomeCategory || otherIncomeId || '')
            : (defaultExpenseCategory || otherExpenseId || '');
          const resolvedId = row.resolvedId || resolveCategoryId(row.categoryLabel, row.txnType);
          suggestionsByIndex.set(row.index, {
            index: row.index,
            title: row.title || normalized[row.index].title || 'Bank transaction',
            category: resolvedId || fallback || '',
          });
        }
      }
    } catch (aiError) {
      const isAiUnreachable =
        aiError?.message === 'fetch failed' ||
        aiError?.cause?.code === 'UND_ERR_SOCKET' ||
        aiError?.cause?.code === 'ECONNRESET' ||
        aiError?.cause?.code === 'ECONNREFUSED' ||
        aiError?.cause?.code === 'ENOTFOUND';
      const isAiServiceError = aiError?.message === 'AI service error' || aiError?.message === 'AI invalid response';
      if (isAiUnreachable || isAiServiceError) {
        const suggestions = buildFallbackSuggestions();
        return res.json({
          success: true,
          message: 'AI unavailable, used fallback categorization',
          data: { suggestions },
          meta: {
            aiUsed: false,
            aiError: aiError?.message,
            causeCode: aiError?.cause?.code,
          },
        });
      }
      throw aiError;
    }

    const suggestions = normalized.map((t) => {
      const s = suggestionsByIndex.get(t.index);
      return s || {
        index: t.index,
        title: t.title || 'Bank transaction',
        category: t.type === 'income'
          ? (defaultIncomeCategory || otherIncomeId || '')
          : (defaultExpenseCategory || otherExpenseId || ''),
      };
    });

    res.json({
      success: true,
      message: 'Suggestions generated',
      data: { suggestions },
    });
  } catch (error) {
    console.error('AI categorize error:', error);
    const isAiUnreachable =
      error?.message === 'fetch failed' ||
      error?.cause?.code === 'UND_ERR_SOCKET' ||
      error?.cause?.code === 'ECONNRESET' ||
      error?.cause?.code === 'ECONNREFUSED' ||
      error?.cause?.code === 'ENOTFOUND';
    const isAiServiceError = error?.message === 'AI service error';
    const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.ATLASCLOUD_API_KEY);
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
    const hint =
      !hasOpenRouterKey && String(ollamaUrl).includes('localhost:11434')
        ? 'Configure OPENROUTER_API_KEY or start Ollama at http://localhost:11434'
        : (!hasOpenRouterKey ? 'Configure OPENROUTER_API_KEY or OLLAMA_URL' : 'Check OPENROUTER_API_URL/OPENROUTER_API_KEY and connectivity');

    res.status(isAiUnreachable || isAiServiceError ? 502 : 500).json({
      success: false,
      message: isAiUnreachable ? 'AI service unreachable' : 'Server error generating suggestions',
      details: isAiServiceError && typeof error?.details === 'string' ? error.details : undefined,
      hint,
      causeCode: error?.cause?.code,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

router.post('/import/bank-statement/commit', [
  body('transactions')
    .isArray({ min: 1, max: 500 })
    .withMessage('Transactions must be an array with 1-500 items'),
], auth, handleValidationErrors, async (req, res) => {
  try {
    const txns = req.body?.transactions;
    if (!Array.isArray(txns) || txns.length === 0) {
      return res.status(400).json({ success: false, message: 'No transactions to import' });
    }

    const errors = [];
    const categoryIds = new Set();
    const normalized = txns.map((t, idx) => {
      const title = typeof t?.title === 'string' ? t.title.trim() : '';
      const amount = toNumberFromAmount(t?.amount);
      const type = t?.type;
      const category = typeof t?.category === 'string' ? t.category : '';
      const account = typeof t?.account === 'string' ? t.account.trim() : '';
      const date = typeof t?.date === 'string' ? t.date : null;
      const description = typeof t?.description === 'string' ? t.description.trim() : '';
      const location = typeof t?.location === 'string' ? t.location.trim() : '';

      if (!title || title.length > 100) errors.push({ index: idx, field: 'title', message: 'Title is required (max 100 chars)' });
      if (!amount || !Number.isFinite(amount) || amount <= 0) errors.push({ index: idx, field: 'amount', message: 'Amount must be > 0' });
      if (!['income', 'expense', 'transfer'].includes(type)) errors.push({ index: idx, field: 'type', message: 'Type must be income, expense, or transfer' });
      if (!category) errors.push({ index: idx, field: 'category', message: 'Category is required' });
      if (!account || account.length > 50) errors.push({ index: idx, field: 'account', message: 'Account is required (max 50 chars)' });
      if (date && Number.isNaN(new Date(date).getTime())) errors.push({ index: idx, field: 'date', message: 'Invalid date' });
      if (description && description.length > 500) errors.push({ index: idx, field: 'description', message: 'Description max 500 chars' });
      if (location && location.length > 100) errors.push({ index: idx, field: 'location', message: 'Location max 100 chars' });

      if (category) categoryIds.add(category);

      return { title, amount, type, category, account, date, description, location };
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation error', errors });
    }

    const categoryList = await Category.find({
      _id: { $in: Array.from(categoryIds) },
      user: req.user._id,
      isActive: true,
    }).lean();
    const categoryById = new Map(categoryList.map((c) => [String(c._id), c]));

    const missing = Array.from(categoryIds).filter((id) => !categoryById.has(String(id)));
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more categories are invalid',
      });
    }

    for (let i = 0; i < normalized.length; i++) {
      const cat = categoryById.get(String(normalized[i].category));
      if (cat && cat.type !== 'both' && cat.type !== normalized[i].type) {
        return res.status(400).json({
          success: false,
          message: `Category type mismatch for transaction at index ${i}`,
        });
      }
    }

    const docs = normalized.map((t) => ({
      user: req.user._id,
      currency: req.user.currency || 'USD',
      status: 'completed',
      title: t.title,
      amount: t.amount,
      type: t.type,
      category: t.category,
      account: t.account,
      date: t.date ? new Date(t.date) : new Date(),
      description: t.description || undefined,
      location: t.location || undefined,
    }));

    const inserted = await Transaction.insertMany(docs, { ordered: false });

    const activeBudgets = await Budget.find({
      user: req.user._id,
      isActive: true,
    });
    for (const budget of activeBudgets) {
      await budget.updateSpentAmounts();
    }

    res.status(201).json({
      success: true,
      message: 'Transactions imported successfully',
      data: {
        count: inserted.length,
      },
    });
  } catch (error) {
    console.error('Bank statement commit error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error importing transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', auth, checkOwnership(Transaction), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('category', 'name color icon type');

    res.json({
      message: 'Transaction retrieved successfully',
      transaction
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      message: 'Server error retrieving transaction'
    });
  }
});

// @route   POST /api/transactions
// @desc    Create new transaction
// @access  Private
router.post('/', [
  body('title')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('type')
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Type must be income, expense, or transfer'),
  body('category')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('account')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Account must be between 1 and 50 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters')
], auth, handleValidationErrors, async (req, res) => {
  try {
    // Verify category belongs to user and is active
    const category = await Category.findOne({
      _id: req.body.category,
      user: req.user._id,
      isActive: true
    }).lean();

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category or category does not belong to user'
      });
    }

    // Verify category type matches transaction type
    if (category.type !== 'both' && category.type !== req.body.type) {
      return res.status(400).json({
        success: false,
        message: `Category is for ${category.type} transactions only`
      });
    }

    // Create transaction with optimized data
    const transactionData = {
      ...req.body,
      user: req.user._id,
      currency: req.user.currency || 'USD',
      date: req.body.date ? new Date(req.body.date) : new Date()
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Update budget spent amounts if this is an expense (optimized)
    if (transaction.type === 'expense') {
      const activeBudgets = await Budget.find({
        user: req.user._id,
        isActive: true,
        startDate: { $lte: transaction.date },
        endDate: { $gte: transaction.date },
        'categories.category': transaction.category
      }).populate('categories.category');

      // Update budgets and check for alerts
      for (const budget of activeBudgets) {
        // Update spent amounts
        await budget.updateSpentAmounts();
        
        // Check and send budget alerts
        await BudgetAlertService.checkAndSendAlerts(budget, transaction);
      }
    }

    // Send transaction notification email if enabled
    try {
      const user = await User.findById(req.user._id);
      if (user && user.notifications && user.notifications.email && user.notifications.transactionAlerts) {
        await emailService.sendTransactionNotificationEmail(user, transaction, category);
      }
    } catch (emailError) {
      console.warn('Failed to send transaction notification email:', emailError.message);
      // Don't fail the transaction creation if email fails
    }

    // Populate category for response
    await transaction.populate('category', 'name color icon type');

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: {
        transaction
      }
    });

  } catch (error) {
    console.error('Create transaction error:', error);
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating transaction',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  body('type')
    .optional()
    .isIn(['income', 'expense', 'transfer'])
    .withMessage('Type must be income, expense, or transfer'),
  body('category')
    .optional()
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location cannot exceed 100 characters')
], auth, checkOwnership(Transaction), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // If category is being updated, verify it
    if (req.body.category) {
      const category = await Category.findOne({
        _id: req.body.category,
        user: req.user._id,
        isActive: true
      });

      if (!category) {
        return res.status(400).json({
          message: 'Invalid category or category does not belong to user'
        });
      }

      const transactionType = req.body.type || req.resource.type;
      if (category.type !== 'both' && category.type !== transactionType) {
        return res.status(400).json({
          message: `Category is for ${category.type} transactions only`
        });
      }
    }

    const allowedUpdates = [
      'title', 'description', 'amount', 'type', 'category', 
      'account', 'paymentMethod', 'date', 'location', 
      'tags', 'notes', 'status'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('category', 'name color icon type');

    // Update budget spent amounts if amount or date changed
    if (updates.amount || updates.date || updates.type) {
      const activeBudgets = await Budget.find({
        user: req.user._id,
        isActive: true
      }).populate('categories.category');

      for (const budget of activeBudgets) {
        await budget.updateSpentAmounts();
        
        // Check for budget alerts if this is an expense transaction
        if (transaction.type === 'expense') {
          await BudgetAlertService.checkAndSendAlerts(budget, transaction);
        }
      }
    }

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });

  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({
      message: 'Server error updating transaction'
    });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', auth, checkOwnership(Transaction), async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);

    // Update budget spent amounts
    const activeBudgets = await Budget.find({
      user: req.user._id,
      isActive: true
    });

    for (const budget of activeBudgets) {
      await budget.updateSpentAmounts();
    }

    res.json({
      message: 'Transaction deleted successfully'
    });

  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({
      message: 'Server error deleting transaction'
    });
  }
});

// @route   GET /api/transactions/analytics/summary
// @desc    Get transaction analytics summary
// @access  Private
router.get('/analytics/summary', [
  query('period')
    .optional()
    .isIn(['week', 'month', 'quarter', 'year', 'custom'])
    .withMessage('Invalid period'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date')
], auth, expensiveOperationSlowDown, handleValidationErrors, async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;

    let dateRange;
    if (period === 'custom' && startDate && endDate) {
      dateRange = QueryOptimizer.buildDateRange(startDate, endDate);
    } else {
      // Build date range based on period
      const now = new Date();
      switch (period) {
        case 'week':
          const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          dateRange = { $gte: weekStart, $lte: weekEnd };
          break;
        case 'month':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          dateRange = { $gte: monthStart, $lte: monthEnd };
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          const quarterStart = new Date(now.getFullYear(), quarter * 3, 1);
          const quarterEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
          dateRange = { $gte: quarterStart, $lte: quarterEnd };
          break;
        case 'year':
          const yearStart = new Date(now.getFullYear(), 0, 1);
          const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
          dateRange = { $gte: yearStart, $lte: yearEnd };
          break;
        default:
          const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          dateRange = { $gte: defaultStart, $lte: defaultEnd };
      }
    }

    // Build comprehensive analytics pipeline
    const pipeline = [
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          date: dateRange
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      {
        $unwind: '$categoryInfo'
      },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category',
            categoryName: '$categoryInfo.name',
            categoryColor: '$categoryInfo.color'
          },
          totalAmount: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          categories: {
            $push: {
              category: '$_id.category',
              name: '$_id.categoryName',
              color: '$_id.categoryColor',
              totalAmount: '$totalAmount',
              transactionCount: '$transactionCount',
              avgAmount: '$avgAmount',
              maxAmount: '$maxAmount',
              minAmount: '$minAmount',
              percentage: '$totalAmount'
            }
          },
          totalByType: { $sum: '$totalAmount' },
          transactionCountByType: { $sum: '$transactionCount' }
        }
      }
    ];

    // Execute analytics query
    const analyticsResult = await Transaction.aggregate(pipeline);

    // Calculate percentages and format data
    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      netIncome: 0,
      transactionCount: 0,
      categories: {
        income: [],
        expense: []
      },
      trends: {
        period,
        dateRange: {
          start: dateRange.$gte,
          end: dateRange.$lte
        }
      }
    };

    analyticsResult.forEach(typeGroup => {
      const type = typeGroup._id;
      summary[`total${type.charAt(0).toUpperCase() + type.slice(1)}`] = typeGroup.totalByType;
      summary.transactionCount += typeGroup.transactionCountByType;

      // Calculate percentages for categories
      typeGroup.categories.forEach(cat => {
        cat.percentage = ((cat.totalAmount / typeGroup.totalByType) * 100).toFixed(2);
      });

      // Sort categories by amount (descending)
      typeGroup.categories.sort((a, b) => b.totalAmount - a.totalAmount);
      summary.categories[type] = typeGroup.categories;
    });

    summary.netIncome = summary.totalIncome - summary.totalExpense;

    // Get monthly trend data for the period
    const trendPipeline = [
      {
        $match: {
          user: req.user._id,
          status: 'completed',
          date: dateRange
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ];

    const trendData = await Transaction.aggregate(trendPipeline);
    summary.trends.monthlyData = trendData;

    res.json({
      success: true,
      message: 'Transaction summary retrieved successfully',
      data: summary
    });

  } catch (error) {
    console.error('Transaction summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving transaction summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
