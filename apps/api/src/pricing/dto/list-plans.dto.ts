import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PLAN_TIERS } from '../pricing.constants.js';

/**
 * عوامل تصفية عرض الأسعار. لا يوجد `ValidationPipe` عام في التطبيق،
 * فالتطبيع والتحقق يتمّان في `PricingService` أيضًا (رموز رفض واضحة).
 */
export class ListPlansDto {
  /** رمز الدولة ISO2 (حرفان) لاختيار مستواها الاقتصادي. */
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  /** نوع الباقة: `PERSONAL` أو `BUSINESS`. */
  @IsOptional()
  @IsIn(PLAN_TIERS)
  plan?: string;

  /** دورة الفوترة: `MONTHLY` أو `YEARLY`. */
  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  cycle?: string;
}
