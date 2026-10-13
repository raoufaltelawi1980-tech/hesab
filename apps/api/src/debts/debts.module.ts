import { Module } from '@nestjs/common';
import { DebtsController } from './debts.controller.js';
import { ContactStatementController } from './contact-statement.controller.js';
import { DebtsService } from './debts.service.js';

@Module({
  controllers: [DebtsController, ContactStatementController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
