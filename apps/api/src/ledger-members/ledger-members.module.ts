import { Module } from '@nestjs/common';
import { LedgerMembersController } from './ledger-members.controller.js';
import { LedgerMembersService } from './ledger-members.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [LedgerMembersController],
  providers: [LedgerMembersService],
})
export class LedgerMembersModule {}
