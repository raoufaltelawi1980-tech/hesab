import type { VoiceLanguage } from './voice.constants.js';

/**
 * محلّل نصّي عربي/إنجليزي خالص: يستقبل النص المُفرَّغ ويُعيد حقولًا مُطَّبَّعة،
 * بلا قاعدة بيانات وبلا تخمين. أي قيمة غير واضحة تبقى `null` ويُسجَّل تحذير.
 * المال يبقى نصًّا — لا يمرّ عبر `Number` أبدًا.
 */

export type VoiceKind =
  | 'INCOME'
  | 'EXPENSE'
  | 'SALE_CASH'
  | 'SALE_CREDIT'
  | 'PURCHASE_CASH'
  | 'PURCHASE_CREDIT'
  | 'COLLECTION'
  | 'PAYMENT';

export type RawVoiceParse = {
  kind: VoiceKind | null;
  amount: string | null;
  currencyCode: string | null;
  businessDate: string | null;
  accountName: string | null;
  categoryName: string | null;
  itemName: string | null;
  contactName: string | null;
  productName: string | null;
  quantity: string | null;
  description: string | null;
  language: VoiceLanguage;
  confidence: number;
  missingFields: string[];
  warnings: string[];
};

export type VoiceParserOptions = {
  /** عملة الدفتر الأساسية، تُستخدم إن لم يُذكر غيره. */
  baseCurrencyCode: string | null;
  /** تاريخ اليوم `YYYY-MM-DD`، يُمرَّر للاختبارات الحتمية. */
  today?: string;
};

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXT_ARABIC_INDIC = /[\u06F0-\u06F9]/g;
const DEVANAGARI = /[\u0966-\u096F]/g;

/** يُطبّع الأرقام العربية والفارسية والهندية إلى أرقام لاتينية. */
export function toAsciiDigits(text: string): string {
  return text
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(DEVANAGARI, (d) => String(d.charCodeAt(0) - 0x0966));
}

/**
 * يُطبّع العربية لمقارنة الكلمات: يزيل الحركات والتطويل، ويوحّد الهمزات
 * والألف والياء والتاء المربوطة، ويحوّل الأرقام والفواصل العشرية.
 */
export function normalizeArabic(text: string): string {
  return toAsciiDigits(text)
    .replace(ARABIC_DIACRITICS, '')
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, '')
    .replace(/\u060C/g, ',')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SALE_WORDS = ['بيع', 'بعت', 'بعنا', 'مبيعات', 'sale', 'sales', 'sold'];
const PURCHASE_WORDS = ['شراء', 'اشتريت', 'اشتري', 'شريت', 'مشتريات', 'purchase', 'bought', 'buy'];
const COLLECTION_WORDS = ['تحصيل', 'قبض', 'قبضت', 'استلمت', 'حصلت', 'collection', 'receipt'];
const PAYMENT_WORDS = ['دفع', 'دفعت', 'سددت', 'سداد', 'payment', 'paid', 'pay'];
const INCOME_WORDS = ['وارد', 'دخل', 'راتب', 'ايراد', 'ايرادات', 'income', 'salary', 'revenue'];
const EXPENSE_WORDS = ['صادر', 'مصروف', 'مصروفات', 'صرف', 'نفقه', 'فاتوره', 'expense', 'expenses'];
const CASH_WORDS = ['نقدي', 'نقدا', 'كاش', 'نقد', 'cash'];
const CREDIT_WORDS = ['اجل', 'بالاجل', 'دين', 'علي الحساب', 'credit', 'on account'];
const QUANTITY_WORDS = ['كميه', 'كمية', 'quantity'];

const CURRENCY_WORDS: { code: string; words: string[] }[] = [
  { code: 'KWD', words: ['دينار كويتي'] },
  { code: 'JOD', words: ['دينار اردني'] },
  { code: 'BHD', words: ['دينار بحريني'] },
  { code: 'IQD', words: ['دينار', 'دينار عراقي', 'iqd'] },
  { code: 'USD', words: ['دولار', 'دولار امريكي', 'usd', 'dollar'] },
  { code: 'EUR', words: ['يورو', 'eur', 'euro'] },
  { code: 'SAR', words: ['ريال', 'ريال سعودي', 'sar'] },
  { code: 'AED', words: ['درهم', 'aed', 'dirham'] },
  { code: 'EGP', words: ['جنيه', 'egp'] },
  { code: 'TRY', words: ['ليره', 'try', 'lira'] },
];

const ENTITY_KEYWORDS: { field: keyof RawVoiceParse; words: string[] }[] = [
  { field: 'accountName', words: ['حساب', 'account'] },
  { field: 'categoryName', words: ['تصنيف', 'فئه', 'category'] },
  { field: 'itemName', words: ['بند فرعي', 'بند', 'item', 'sub'] },
  { field: 'contactName', words: ['عميل', 'مورد', 'جهه', 'customer', 'supplier', 'contact'] },
  { field: 'productName', words: ['منتج', 'product'] },
  { field: 'description', words: ['وصف', 'بيان', 'ملاحظه', 'note', 'description'] },
];

const AMOUNT_MARKERS = ['بمبلغ', 'مبلغ', 'قيمته', 'قيمت', 'amount', 'بـ', 'ب '];

/**
 * يحذف كلمات الأسماء (الحساب/التصنيف/المنتج…) وما يليها من الكلمات قبل استنتاج
 * نوع العملية، حتى لا تُقرأ أسماء مثل «المبيعات» كفعل بيع.
 */
function stripEntityNames(normalized: string): string {
  const entityWords = new Set<string>(ENTITY_KEYWORDS.flatMap((e) => e.words));
  const tokens = normalized.split(' ');
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    if (entityWords.has(tokens[i])) {
      i += 1;
      continue;
    }
    out.push(tokens[i]);
  }
  return out.join(' ');
}

function findKind(normalized: string): { kind: VoiceKind | null; warnings: string[] } {  const has = (words: string[]) => words.some((w) => normalized.includes(w));

  const sale = has(SALE_WORDS);
  const purchase = has(PURCHASE_WORDS);
  if (sale && purchase) {
    return { kind: null, warnings: ['نوع العملية ملتبس (بيع وشراء معًا)'] };
  }

  const cash = has(CASH_WORDS);
  const credit = has(CREDIT_WORDS);

  if (sale) {
    if (cash && !credit) return { kind: 'SALE_CASH', warnings: [] };
    if (credit && !cash) return { kind: 'SALE_CREDIT', warnings: [] };
    return { kind: null, warnings: ['نوع البيع غير محدد (نقدي أم آجل)'] };
  }
  if (purchase) {
    if (cash && !credit) return { kind: 'PURCHASE_CASH', warnings: [] };
    if (credit && !cash) return { kind: 'PURCHASE_CREDIT', warnings: [] };
    return { kind: null, warnings: ['نوع الشراء غير محدد (نقدي أم آجل)'] };
  }
  if (has(COLLECTION_WORDS)) return { kind: 'COLLECTION', warnings: [] };
  if (has(PAYMENT_WORDS)) return { kind: 'PAYMENT', warnings: [] };
  if (has(INCOME_WORDS)) return { kind: 'INCOME', warnings: [] };
  if (has(EXPENSE_WORDS)) return { kind: 'EXPENSE', warnings: [] };
  return { kind: null, warnings: [] };
}

function detectLanguage(raw: string): VoiceLanguage {
  if (/[\u0600-\u06FF]/.test(raw)) return 'ar';
  if (/[a-zA-Z]/.test(raw)) return 'en';
  return 'ar';
}

function pickCurrency(normalized: string): string | null {
  for (const entry of CURRENCY_WORDS) {
    if (entry.words.some((w) => normalized.includes(w))) return entry.code;
  }
  return null;
}

function detectDate(normalized: string, today: string): { date: string | null; warning: string | null } {
  const iso = normalized.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { date: `${iso[1]}-${iso[2]}-${iso[3]}`, warning: null };

  const [ty, tm, td] = today.split('-').map((part) => Number(part));
  const shift = (days: number): string => {
    const base = new Date(Date.UTC(ty, tm - 1, td));
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
  };
  if (/اول امس|اول امس|the day before yesterday/.test(normalized)) return { date: shift(-2), warning: null };
  if (/(^|\s)امس(\s|$)|yesterday/.test(normalized)) return { date: shift(-1), warning: null };
  if (/(^|\s)اليوم(\s|$)|today/.test(normalized)) return { date: today, warning: null };

  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(normalized)) {
    return { date: null, warning: 'تاريخ غير واضح (استخدم YYYY-MM-DD)' };
  }
  return { date: null, warning: null };
}

function captureAfter(normalized: string, keyword: string, stops: string[]): string | null {
  const idx = normalized.indexOf(keyword);
  if (idx < 0) return null;
  const rest = normalized.slice(idx + keyword.length);
  let end = rest.length;
  for (const stop of stops) {
    const found = rest.indexOf(stop);
    if (found >= 0 && found < end) end = found;
  }
  const punct = rest.search(/[\d,.;\n]/);
  if (punct >= 0 && punct < end) end = punct;
  const value = rest.slice(0, end).replace(/^[\s:-]+/, '').trim();
  return value.length > 0 ? value : null;
}

function extractAmount(withoutDate: string): { amount: string | null; warning: string | null } {
  const tokens = withoutDate.match(/\d+(?:\.\d+)?/g);
  if (!tokens || tokens.length === 0) return { amount: null, warning: null };
  if (tokens.length === 1) return { amount: tokens[0], warning: null };

  const afterMarker = new RegExp(`(?:${AMOUNT_MARKERS.join('|')})\\s*(\\d+(?:\\.\\d+)?)`).exec(withoutDate);
  if (afterMarker) return { amount: afterMarker[1], warning: null };
  const beforeCurrency = /(\d+(?:\.\d+)?)\s*(?:دينار|دولار|يورو|ريال|درهم|جنيه|ليره|iqd|usd|eur|sar|aed|egp|try)/.exec(
    withoutDate,
  );
  if (beforeCurrency) return { amount: beforeCurrency[1], warning: null };
  return { amount: tokens[tokens.length - 1], warning: 'أكثر من رقم في النص؛ اعتُمد الأخير' };
}

/** يمحو الأجزاء المطابقة من النص حتى لا تُقرأ أرقام التاريخ كمبلغ. */
function stripDates(normalized: string): string {
  return normalized
    .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
    .replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, ' ');
}

export function parseVoiceText(text: string, options: VoiceParserOptions): RawVoiceParse {
  const raw = text.trim();
  const normalized = normalizeArabic(raw);
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const warnings: string[] = [];
  const missingFields: string[] = [];

  const kindResult = findKind(stripEntityNames(normalized));
  if (kindResult.warnings.length > 0) warnings.push(...kindResult.warnings);
  if (!kindResult.kind) missingFields.push('kind');

  const dateResult = detectDate(normalized, today);
  if (dateResult.warning) warnings.push(dateResult.warning);

  const withoutDate = stripDates(normalized);
  const amountResult = extractAmount(withoutDate);
  if (amountResult.warning) warnings.push(amountResult.warning);
  if (!amountResult.amount) missingFields.push('amount');

  const currencyInText = pickCurrency(normalized);
  const currencyCode = currencyInText ?? options.baseCurrencyCode;
  if (!currencyCode) missingFields.push('currency');

  const entityStops = [
    ...ENTITY_KEYWORDS.flatMap((e) => e.words),
    ...AMOUNT_MARKERS,
    ...CURRENCY_WORDS.flatMap((c) => c.words),
    ...QUANTITY_WORDS,
  ];
  const accountName = captureAfter(normalized, 'حساب', entityStops) ?? captureAfter(normalized, 'account', entityStops);
  const categoryName =
    captureAfter(normalized, 'تصنيف', entityStops) ??
    captureAfter(normalized, 'فئه', entityStops) ??
    captureAfter(normalized, 'category', entityStops);
  const itemName =
    captureAfter(normalized, 'بند فرعي', entityStops) ?? captureAfter(normalized, 'بند', entityStops);
  const contactName =
    captureAfter(normalized, 'عميل', entityStops) ??
    captureAfter(normalized, 'مورد', entityStops) ??
    captureAfter(normalized, 'جهه', entityStops);
  const productName = captureAfter(normalized, 'منتج', entityStops) ?? captureAfter(normalized, 'product', entityStops);
  const description =
    captureAfter(normalized, 'وصف', entityStops) ??
    captureAfter(normalized, 'بيان', entityStops) ??
    captureAfter(normalized, 'ملاحظه', entityStops);

  let score = 0.4;
  if (kindResult.kind) score += 0.2;
  if (amountResult.amount) score += 0.2;
  if (currencyCode) score += 0.1;
  if (dateResult.date) score += 0.1;
  const confidence = Math.min(1, Math.round(score * 100) / 100);

  return {
    kind: kindResult.kind,
    amount: amountResult.amount,
    currencyCode,
    businessDate: dateResult.date,
    accountName,
    categoryName,
    itemName,
    contactName,
    productName,
    quantity: /(?:كميه|كمية|quantity)\s*:?\s*(\d+(?:\.\d+)?)/.exec(normalized)?.[1] ?? null,
    description,
    language: detectLanguage(raw),
    confidence,
    missingFields,
    warnings,
  };
}
