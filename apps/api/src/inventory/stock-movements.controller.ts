import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { StockService } from './stock.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';

@Controller('ledgers/:ledgerId/stock-movements')
@UseGuards(AuthGuard)
export class StockMovementsController {
  constructor(private readonly stock: StockService) {}

  @Post()
  create(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stock.createManualMovement(ledgerId, user.id, dto);
  }
}
