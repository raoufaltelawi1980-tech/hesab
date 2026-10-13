import { Module } from '@nestjs/common';
import { AccountSettingsController } from './account-settings.controller.js';
import { AccountSettingsService } from './account-settings.service.js';

@Module({
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService],
  exports: [AccountSettingsService],
})
export class AccountSettingsModule {}
