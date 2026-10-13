import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { AccountSettingsModule } from './account-settings/account-settings.module.js';
import { LedgersModule } from './ledgers/ledgers.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { LedgerMembersModule } from './ledger-members/ledger-members.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { BudgetsModule } from './budgets/budgets.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { DebtsModule } from './debts/debts.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { VoiceModule } from './voice/voice.module.js';
import { PricingModule } from './pricing/pricing.module.js';
import { ReferenceModule } from './reference/reference.module.js';

@Module({
  imports: [PrismaModule, HealthModule, AuthModule, SubscriptionsModule, AccountSettingsModule, LedgersModule, CategoriesModule, LedgerMembersModule, TransactionsModule, BudgetsModule, ReportsModule, ContactsModule, DebtsModule, InventoryModule, VoiceModule, PricingModule, ReferenceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

