import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';

@Controller('subscriptions')
@UseGuards(AuthGuard)
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.svc.me(user.id);
  }

  @Post('mock/activate')
  activate(@CurrentUser() user: { id: string }) {
    return this.svc.mockActivate(user.id);
  }

  @Post('mock/cancel')
  cancel(@CurrentUser() user: { id: string }) {
    return this.svc.mockCancel(user.id);
  }
}
