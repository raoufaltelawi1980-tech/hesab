import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { TransactionsService } from './transactions.service.js';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { UpdateDraftDto } from './dto/update-draft.dto.js';
import { PostDraftDto } from './dto/post-draft.dto.js';

@Controller('ledgers/:ledgerId/transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  @Post('drafts')
  createDraft(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }, @Body() dto: CreateDraftDto) {
    return this.svc.createDraft(ledgerId, user.id, dto);
  }

  @Get('drafts')
  listDrafts(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listDrafts(ledgerId, user.id);
  }

  @Get('drafts/:draftId')
  getDraft(@Param('ledgerId') ledgerId: string, @Param('draftId') draftId: string, @CurrentUser() user: { id: string }) {
    return this.svc.getDraft(ledgerId, draftId, user.id);
  }

  @Patch('drafts/:draftId')
  updateDraft(@Param('ledgerId') ledgerId: string, @Param('draftId') draftId: string, @CurrentUser() user: { id: string }, @Body() dto: UpdateDraftDto) {
    return this.svc.updateDraft(ledgerId, draftId, user.id, dto);
  }

  @Post('drafts/:draftId/confirm')
  confirm(@Param('ledgerId') ledgerId: string, @Param('draftId') draftId: string, @CurrentUser() user: { id: string }) {
    return this.svc.confirmDraft(ledgerId, draftId, user.id);
  }

  @Post('drafts/:draftId/post')
  post(
    @Param('ledgerId') ledgerId: string,
    @Param('draftId') draftId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: PostDraftDto = {},
  ) {
    return this.svc.postDraft(ledgerId, draftId, user.id, dto.dueDate);
  }

  @Get()
  list(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listEntries(ledgerId, user.id);
  }
}
