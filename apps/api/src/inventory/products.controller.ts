import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ProductsService } from './products.service.js';
import { StockService } from './stock.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';

@Controller('ledgers/:ledgerId/products')
@UseGuards(AuthGuard)
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly stock: StockService,
  ) {}

  @Get()
  list(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ListProductsDto,
  ) {
    return this.products.list(ledgerId, user.id, query);
  }

  @Post()
  create(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(ledgerId, user.id, dto);
  }

  @Get(':productId')
  get(
    @Param('ledgerId') ledgerId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.products.get(ledgerId, productId, user.id);
  }

  @Patch(':productId')
  update(
    @Param('ledgerId') ledgerId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(ledgerId, productId, user.id, dto);
  }

  @Post(':productId/archive')
  archive(
    @Param('ledgerId') ledgerId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.products.archive(ledgerId, productId, user.id);
  }

  @Get(':productId/stock')
  stockForProduct(
    @Param('ledgerId') ledgerId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.stock.getStock(ledgerId, user.id, productId);
  }

  @Get(':productId/movements')
  movements(
    @Param('ledgerId') ledgerId: string,
    @Param('productId') productId: string,
    @CurrentUser() user: { id: string },
    @Query() query: StockQueryDto,
  ) {
    return this.stock.listMovements(ledgerId, user.id, productId, query);
  }
}
