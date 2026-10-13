import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { DebtsService } from './debts.service.js';
import { CreateAllocationDto } from './dto/create-allocation.dto.js';
import { ListDebtsDto } from './dto/list-debts.dto.js';

@Controller('ledgers/:ledgerId/debts')
@UseGuards(AuthGuard)
export class DebtsController {
  constructor(private readonly svc: DebtsService) {}

  @Get()
  list(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ListDebtsDto,
  ) {
    return this.svc.list(ledgerId, user.id, query);
  }

  @Get(':debtId')
  get(
    @Param('ledgerId') ledgerId: string,
    @Param('debtId') debtId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.get(ledgerId, debtId, user.id);
  }

  @Post(':debtId/allocations')
  allocate(
    @Param('ledgerId') ledgerId: string,
    @Param('debtId') debtId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAllocationDto,
  ) {
    return this.svc.allocate(ledgerId, debtId, user.id, dto);
  }
}
