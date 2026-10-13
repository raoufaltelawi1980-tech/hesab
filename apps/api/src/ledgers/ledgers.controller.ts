import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LedgersService } from './ledgers.service.js';
import { CreateLedgerDto } from './dto/create-ledger.dto.js';
import { UpdateLedgerSettingsDto } from './dto/update-ledger-settings.dto.js';

@Controller('ledgers')
@UseGuards(AuthGuard)
export class LedgersController {
  constructor(private readonly svc: LedgersService) {}

  @Post()
  create(@Body() dto: CreateLedgerDto, @CurrentUser() user: { id: string }) {
    return this.svc.create(dto, user.id);
  }

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.svc.list(user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.svc.get(id, user.id);
  }

  @Get(':id/accounts')
  accounts(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.svc.listAccounts(id, user.id);
  }

  @Patch(':id/settings')
  settings(@Param('id') id: string, @CurrentUser() user: { id: string }, @Body() dto: UpdateLedgerSettingsDto) {
    return this.svc.updateSettings(id, user.id, dto);
  }
}
