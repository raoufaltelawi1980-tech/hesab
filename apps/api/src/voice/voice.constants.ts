/**
 * حدود التسجيل الصوتي والقيم المسموح بها (القسمان 18 و20). لا يُخزَّن الصوت في
 * هذه المرحلة، فالحدود تحمي الذاكرة فقط.
 */

/** الحدّ المنطقي الذي تفرضه الخدمة برسالة عربية واضحة. */
export const VOICE_MAX_BYTES = 10 * 1024 * 1024;
/** حدّ صلب لمُعترِض الرفع، يصعب تجاوزه في الذاكرة حتى لو تجاوز المنطقي. */
export const VOICE_HARD_MAX_BYTES = 25 * 1024 * 1024;

/** الامتدادات المدعومة (بلا نقطة). */
export const VOICE_AUDIO_EXTENSIONS = [
  'm4a',
  'mp3',
  'ogg',
  'oga',
  'opus',
  'wav',
  'webm',
  'aac',
] as const;

/** أنواع MIME المدعومة. */
export const VOICE_AUDIO_MIMETYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/aacp',
] as const;

export const VOICE_LANGUAGES = ['ar', 'en'] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];

/** نوع العملية كما يفهمه المستخدم ثم يُترجم إلى `TransactionKind`. */
export const VOICE_KIND_LABEL_AR: Record<string, string> = {
  INCOME: 'وارد',
  EXPENSE: 'صادر',
  SALE_CASH: 'بيع نقدي',
  SALE_CREDIT: 'بيع آجل',
  PURCHASE_CASH: 'شراء نقدي',
  PURCHASE_CREDIT: 'شراء آجل',
  COLLECTION: 'تحصيل',
  PAYMENT: 'دفع',
};

/** الحقول التي يجب أن تكتمل قبل أن تصبح البطاقة قابلة للتأكيد. */
export const VOICE_CARD_FIELDS = [
  'kind',
  'amount',
  'currency',
  'account',
  'category',
] as const;
