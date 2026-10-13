import { Module } from '@nestjs/common';
import { LedgersController } from './ledgers.controller.js';
import { LedgersService } from './ledgers.service.js';

@Module({
  controllers: [LedgersController],
  providers: [LedgersService],
  exports: [LedgersService],
})
export class LedgersModule {}
