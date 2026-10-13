import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { WarehousesController } from './warehouses.controller.js';
import { StockMovementsController } from './stock-movements.controller.js';
import { ProductsService } from './products.service.js';
import { WarehousesService } from './warehouses.service.js';
import { StockService } from './stock.service.js';

@Module({
  controllers: [ProductsController, WarehousesController, StockMovementsController],
  providers: [ProductsService, WarehousesService, StockService],
  exports: [ProductsService, WarehousesService, StockService],
})
export class InventoryModule {}
