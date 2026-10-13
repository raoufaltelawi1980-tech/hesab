import { Controller, Get, Query } from '@nestjs/common';
import { PricingService } from './pricing.service.js';
import { ListPlansDto } from './dto/list-plans.dto.js';

/**
 * كتالوج أسعار باقات المنصة. مسار قراءة عام (Reference) بلا مصادقة: لا بيانات
 * مستخدم ولا أسرار، والكتالوج ثابت من الكود. لا يوجد دفع ولا تغيير اشتراك هنا.
 */
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('plans')
  listPlans(@Query() query: ListPlansDto) {
    return this.pricing.listPlans(query);
  }
}
