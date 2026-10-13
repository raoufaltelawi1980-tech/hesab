import { Module } from '@nestjs/common';
import { EmailService } from './email.service.js';
import { EMAIL_PROVIDER, EnvEmailProvider } from './email.provider.js';

/**
 * وحدة البريد: تربط `EnvEmailProvider` بمفتاح الحقن. لا مزوّد مزيّف هنا؛
 * غياب الإعداد يعني رفضًا واضحًا بـ`EMAIL_PROVIDER_NOT_CONFIGURED`.
 */
@Module({
  providers: [EmailService, { provide: EMAIL_PROVIDER, useClass: EnvEmailProvider }],
  exports: [EmailService],
})
export class EmailModule {}
