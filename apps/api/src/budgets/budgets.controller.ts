import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BudgetsService } from './budgets.service.js';
import { CreateBudgetDto } from './dto/create-budget.dto.js';
import { UpdateBudgetDto } from './dto/update-budget.dto.js';
import { CreatePeriodDto } from './dto/create-period.dto.js';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto.js';

/**
 * Budget routes mount under the ledger, as in `API_CONTRACTS.md` §10. The
 * alert-event feed and its acknowledge action sit on the ledger too, because
 * that is the scope the permission gate is evaluated against.
 */
@Controller('ledgers/:ledgerId')
@UseGuards(AuthGuard)
export class BudgetsController {
  constructor(private readonly svc: BudgetsService) {}

  @Get('budgets')
  list(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.list(ledgerId, user.id);
  }

  @Post('budgets')
  create(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }, @Body() dto: CreateBudgetDto) {
    return this.svc.create(ledgerId, user.id, dto);
  }

  @Get('budgets/:budgetId')
  get(@Param('ledgerId') ledgerId: string, @Param('budgetId') budgetId: string, @CurrentUser() user: { id: string }) {
    return this.svc.get(ledgerId, budgetId, user.id);
  }

  @Patch('budgets/:budgetId')
  update(
    @Param('ledgerId') ledgerId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.svc.update(ledgerId, budgetId, user.id, dto);
  }

  @Delete('budgets/:budgetId')
  archive(@Param('ledgerId') ledgerId: string, @Param('budgetId') budgetId: string, @CurrentUser() user: { id: string }) {
    return this.svc.archive(ledgerId, budgetId, user.id);
  }

  @Get('budgets/:budgetId/periods')
  listPeriods(@Param('ledgerId') ledgerId: string, @Param('budgetId') budgetId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listPeriods(ledgerId, budgetId, user.id);
  }

  @Post('budgets/:budgetId/periods')
  addPeriod(
    @Param('ledgerId') ledgerId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreatePeriodDto,
  ) {
    return this.svc.addPeriod(ledgerId, budgetId, user.id, dto);
  }

  @Get('budgets/:budgetId/progress')
  progress(@Param('ledgerId') ledgerId: string, @Param('budgetId') budgetId: string, @CurrentUser() user: { id: string }) {
    return this.svc.progress(ledgerId, budgetId, user.id);
  }

  @Get('budgets/:budgetId/alert-rules')
  listAlertRules(@Param('ledgerId') ledgerId: string, @Param('budgetId') budgetId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listAlertRules(ledgerId, budgetId, user.id);
  }

  @Post('budgets/:budgetId/alert-rules')
  addAlertRule(
    @Param('ledgerId') ledgerId: string,
    @Param('budgetId') budgetId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.svc.addAlertRule(ledgerId, budgetId, user.id, dto);
  }

  @Get('alert-events')
  listAlertEvents(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listAlertEvents(ledgerId, user.id);
  }

  @Post('alert-events/:eventId/acknowledge')
  acknowledge(
    @Param('ledgerId') ledgerId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.acknowledgeAlertEvent(ledgerId, eventId, user.id);
  }
}