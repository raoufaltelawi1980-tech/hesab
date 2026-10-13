import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ReportsService } from './reports.service.js';
import { ReportsQueryDto } from './dto/query.dto.js';

@Controller('ledgers/:ledgerId/reports')
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('summary')
  summary(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.summary(ledgerId, user.id, query);
  }

  @Get('timeseries')
  timeseries(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.timeseries(ledgerId, user.id, query);
  }

  @Get('categories')
  categories(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.categories(ledgerId, user.id, query);
  }

  @Get('accounts')
  accounts(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.accounts(ledgerId, user.id, query);
  }

  @Get('budget-comparison')
  budgetComparison(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.budgetComparison(ledgerId, user.id, query);
  }

  @Get('profit-loss')
  profitLoss(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.profitLoss(ledgerId, user.id, query);
  }

  @Get('gross-profit')
  grossProfit(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ReportsQueryDto,
  ) {
    return this.svc.grossProfit(ledgerId, user.id, query);
  }
}
