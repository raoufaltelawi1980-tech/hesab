import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CategoriesService } from './categories.service.js';

@Controller('ledgers/:ledgerId/categories')
@UseGuards(AuthGuard)
export class CategoriesController {
  constructor(private readonly svc: CategoriesService) {}

  @Get()
  list(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.list(ledgerId, user.id);
  }

  @Post()
  create(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.svc.createCategory(ledgerId, user.id, dto);
  }

  @Patch(':categoryId')
  patch(@Param('ledgerId') ledgerId: string, @Param('categoryId') categoryId: string, @CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.svc.patchCategory(ledgerId, categoryId, user.id, dto);
  }

  @Post(':categoryId/archive')
  archive(@Param('ledgerId') ledgerId: string, @Param('categoryId') categoryId: string, @CurrentUser() user: { id: string }) {
    return this.svc.archiveCategory(ledgerId, categoryId, user.id);
  }

  @Post(':categoryId/items')
  createItem(@Param('ledgerId') ledgerId: string, @Param('categoryId') categoryId: string, @CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.svc.createItem(ledgerId, categoryId, user.id, dto);
  }

  @Patch(':categoryId/items/:itemId')
  patchItem(@Param('ledgerId') ledgerId: string, @Param('categoryId') categoryId: string, @Param('itemId') itemId: string, @CurrentUser() user: { id: string }, @Body() dto: any) {
    return this.svc.patchItem(ledgerId, categoryId, itemId, user.id, dto);
  }

  @Post(':categoryId/items/:itemId/archive')
  archiveItem(@Param('ledgerId') ledgerId: string, @Param('categoryId') categoryId: string, @Param('itemId') itemId: string, @CurrentUser() user: { id: string }) {
    return this.svc.archiveItem(ledgerId, categoryId, itemId, user.id);
  }
}
