import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { WarehousesService } from './warehouses.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

@Controller('ledgers/:ledgerId/warehouses')
@UseGuards(AuthGuard)
export class WarehousesController {
  constructor(private readonly warehouses: WarehousesService) {}

  @Get()
  list(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.warehouses.list(ledgerId, user.id);
  }

  @Post()
  create(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.warehouses.create(ledgerId, user.id, dto);
  }

  @Get(':warehouseId')
  get(
    @Param('ledgerId') ledgerId: string,
    @Param('warehouseId') warehouseId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.warehouses.get(ledgerId, warehouseId, user.id);
  }

  @Patch(':warehouseId')
  update(
    @Param('ledgerId') ledgerId: string,
    @Param('warehouseId') warehouseId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateWarehouseDto,
  ) {
    return this.warehouses.update(ledgerId, warehouseId, user.id, dto);
  }

  @Post(':warehouseId/archive')
  archive(
    @Param('ledgerId') ledgerId: string,
    @Param('warehouseId') warehouseId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.warehouses.archive(ledgerId, warehouseId, user.id);
  }
}
