import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UpdateAccountSettingsDto } from './dto/update-account-settings.dto.js';

@Controller('account-settings')
@UseGuards(AuthGuard)
export class AccountSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, locale: true, countryId: true },
    });
  }

  @Patch('me')
  async patchMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateAccountSettingsDto) {
    const data: any = {};
    if (dto.locale !== undefined) data.locale = dto.locale;
    if (dto.countryId !== undefined) data.countryId = dto.countryId;
    if (Object.keys(data).length === 0) return this.getMe(user);
    return this.prisma.user.update({ where: { id: user.id }, data });
  }
}
