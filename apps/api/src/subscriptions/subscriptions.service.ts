import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: { select: { code: true, nameEn: true, nameAr: true } } },
    });
  }

  async mockActivate(userId: string) {
    const active = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['TRIALING', 'ACTIVE'] } },
    });
    if (active) throw new BadRequestException('Active subscription exists');
    const plan = await this.prisma.plan.findFirst({ where: { isActive: true } });
    if (!plan) throw new BadRequestException('No active plan');
    const price = await this.prisma.planPrice.findFirst({ where: { planId: plan.id } });
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return this.prisma.subscription.create({
      data: {
        userId,
        planId: plan.id,
        planPriceId: price?.id ?? null,
        status: 'TRIALING',
        billingCycle: price?.billingCycle ?? 'MONTHLY',
        isPaymentSimulated: true,
        basePriceAmount: price?.basePriceAmount ?? 0,
        baseCurrencyId: price?.baseCurrencyId ?? '00000000-0000-0000-0000-000000000000',
        currentPeriodStart: now,
        currentPeriodEnd: end,
        startedAt: now,
      },
    });
  }

  async mockCancel(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: ['TRIALING', 'ACTIVE'] } },
    });
    if (!sub) return { success: true };
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    return { success: true };
  }
}
