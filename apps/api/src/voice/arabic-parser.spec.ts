import { describe, expect, it } from 'vitest';
import { normalizeArabic, parseVoiceText, toAsciiDigits } from './arabic-parser.js';

const TODAY = '2026-10-10';

function parse(text: string, baseCurrencyCode: string | null = 'KWD') {
  return parseVoiceText(text, { baseCurrencyCode, today: TODAY });
}

describe('toAsciiDigits', () => {
  it('يحوّل الأرقام العربية والهندية إلى لاتينية', () => {
    expect(toAsciiDigits('٥٠٠٠')).toBe('5000');
    expect(toAsciiDigits('۱۲۳')).toBe('123');
    expect(toAsciiDigits('١٥.٢٥')).toBe('15.25');
  });
});

describe('normalizeArabic', () => {
  it('يوحّد الهمزات والتاء المربوطة والأرقام والفواصل', () => {
    expect(normalizeArabic('إجمالي')).toBe('اجمالي');
    expect(normalizeArabic('فاتورة')).toBe('فاتوره');
    expect(normalizeArabic('١٢٣٫٥')).toBe('123.5');
  });
});

describe('parseVoiceText', () => {
  it('يحلّل واردًا بعملة الدفتر الافتراضية', () => {
    const result = parse('وارد 50000');
    expect(result.kind).toBe('INCOME');
    expect(result.amount).toBe('50000');
    expect(result.currencyCode).toBe('KWD');
    expect(result.missingFields).not.toContain('kind');
    expect(result.missingFields).not.toContain('amount');
  });

  it('يحوّل الأرقام الهندية في المبلغ', () => {
    const result = parse('وارد ٤٥٠٠ دينار');
    expect(result.amount).toBe('4500');
    expect(result.currencyCode).toBe('IQD');
  });

  it('يستخرج الحساب والتصنيف من النص', () => {
    const result = parse('بيع نقدي 300 دولار حساب الصندوق تصنيف المبيعات');
    expect(result.kind).toBe('SALE_CASH');
    expect(result.amount).toBe('300');
    expect(result.currencyCode).toBe('USD');
    expect(result.accountName).toBe('الصندوق');
    expect(result.categoryName).toBe('المبيعات');
  });

  it('يستخرج الكمية والمنتج عند ذكر عملة تميّز المبلغ', () => {
    const result = parse('بيع نقدي 100 دولار منتج قلم كميه 5');
    expect(result.kind).toBe('SALE_CASH');
    expect(result.amount).toBe('100');
    expect(result.productName).toBe('قلم');
    expect(result.quantity).toBe('5');
  });

  it('يرفض نوعًا ملتبسًا (بيع وشراء معًا)', () => {
    const result = parse('بيع وشراء 100');
    expect(result.kind).toBeNull();
    expect(result.missingFields).toContain('kind');
    expect(result.warnings.join(' ')).toContain('ملتبس');
  });

  it('لا يخمّن نقديًا أم آجلًا في البيع', () => {
    const result = parse('بيع 200');
    expect(result.kind).toBeNull();
    expect(result.missingFields).toContain('kind');
  });

  it('يميّز البيع الآجل عن النقدي', () => {
    const result = parse('بيع اجل 700');
    expect(result.kind).toBe('SALE_CREDIT');
  });

  it('يسجّل المبلغ المفقود', () => {
    const result = parse('وارد');
    expect(result.missingFields).toContain('amount');
    expect(result.amount).toBeNull();
  });

  it('يحلّ التواريخ النسبية الواضحة فقط', () => {
    expect(parse('وارد 100 اليوم').businessDate).toBe(TODAY);
    expect(parse('وارد 100 امس').businessDate).toBe('2026-10-09');
    expect(parse('وارد 100 اول امس').businessDate).toBe('2026-10-08');
    expect(parse('وارد 100 2026-09-01').businessDate).toBe('2026-09-01');
  });

  it('يحذّر من التاريخ الملتبس دون تخمينه', () => {
    const result = parse('وارد 100 3/5/2026');
    expect(result.businessDate).toBeNull();
    expect(result.warnings.some((w) => w.includes('تاريخ'))).toBe(true);
  });

  it('لا يخمّن النوع عند غيابه ويتركه null', () => {
    const result = parse('50000 دينار');
    expect(result.kind).toBeNull();
    expect(result.missingFields).toContain('kind');
    expect(result.amount).toBe('50000');
  });

  it('يحذّر عند وجود أكثر من رقم ويختار الأخير', () => {
    const result = parse('وارد 100 200');
    expect(result.amount).toBe('200');
    expect(result.warnings.some((w) => w.includes('رقم'))).toBe(true);
  });

  it('يرفع الثقة مع اكتمال الحقول', () => {
    const full = parse('بيع نقدي 300 دولار اليوم حساب الصندوق تصنيف المبيعات');
    const partial = parse('شيء ما');
    expect(full.confidence).toBeGreaterThan(partial.confidence);
  });
});
