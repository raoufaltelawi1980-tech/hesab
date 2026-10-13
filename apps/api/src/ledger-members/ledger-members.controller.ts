import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { LedgerMembersService } from './ledger-members.service.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdatePermissionsDto } from './dto/update-permissions.dto.js';

@Controller('ledgers/:ledgerId')
@UseGuards(AuthGuard)
export class LedgerMembersController {
  constructor(private readonly svc: LedgerMembersService) {}

  @Get('members')
  list(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.list(ledgerId, user.id);
  }

  @Post('members/invite')
  invite(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }, @Body() dto: InviteMemberDto) {
    return this.svc.invite(ledgerId, user.id, dto);
  }

  @Post('members/accept')
  accept(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.accept(ledgerId, user.id);
  }

  @Get('invitations')
  listInvitations(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.listInvitations(ledgerId, user.id);
  }

  @Post('invitations/:invitationId/revoke')
  revokeInvitation(
    @Param('ledgerId') ledgerId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.svc.revokeInvitation(ledgerId, invitationId, user.id);
  }

  @Get('members/:memberId')
  get(@Param('ledgerId') ledgerId: string, @Param('memberId') memberId: string, @CurrentUser() user: { id: string }) {
    return this.svc.get(ledgerId, memberId, user.id);
  }

  @Patch('members/:memberId/permissions')
  updatePermissions(
    @Param('ledgerId') ledgerId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePermissionsDto,
  ) {
    return this.svc.updatePermissions(ledgerId, memberId, user.id, dto);
  }

  @Post('members/:memberId/suspend')
  suspend(@Param('ledgerId') ledgerId: string, @Param('memberId') memberId: string, @CurrentUser() user: { id: string }) {
    return this.svc.suspend(ledgerId, memberId, user.id);
  }

  @Post('members/:memberId/remove')
  remove(@Param('ledgerId') ledgerId: string, @Param('memberId') memberId: string, @CurrentUser() user: { id: string }) {
    return this.svc.remove(ledgerId, memberId, user.id);
  }

  @Get('my-permissions')
  myPermissions(@Param('ledgerId') ledgerId: string, @CurrentUser() user: { id: string }) {
    return this.svc.myPermissions(ledgerId, user.id);
  }
}