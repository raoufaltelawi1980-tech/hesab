import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ContactsService } from './contacts.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';
import { ListContactsDto } from './dto/list-contacts.dto.js';

@Controller('ledgers/:ledgerId/contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  @Get()
  list(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Query() query: ListContactsDto,
  ) {
    return this.svc.list(ledgerId, user.id, query);
  }

  @Post()
  create(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateContactDto,
  ) {
    return this.svc.create(ledgerId, user.id, dto);
  }

  @Get(':contactId')
  get(
    @Param('ledgerId') ledgerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.get(ledgerId, contactId, user.id);
  }

  @Patch(':contactId')
  update(
    @Param('ledgerId') ledgerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateContactDto,
  ) {
    return this.svc.update(ledgerId, contactId, user.id, dto);
  }

  @Delete(':contactId')
  archive(
    @Param('ledgerId') ledgerId: string,
    @Param('contactId') contactId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.archive(ledgerId, contactId, user.id);
  }
}