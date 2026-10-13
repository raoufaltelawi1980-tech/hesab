import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DebtsService } from './debts.service.js';
import { StatementQueryDto } from './dto/statement-query.dto.js';

/**
 * The contact statement lives on the contacts path (per the contract) but is
 * served by the debts module, which owns the debt data it summarizes.
 */
@Controller('ledgers/:ledgerId/contacts')
@UseGuards(AuthGuard)
export class ContactStatementController {
  constructor(private readonly svc: DebtsService) {}

  @Get(':contactId/statement')
  statement(
    @Param('ledgerId') ledgerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: { id: string },
    @Query() query: StatementQueryDto,
  ) {
    return this.svc.statement(ledgerId, contactId, user.id, query);
  }
}
