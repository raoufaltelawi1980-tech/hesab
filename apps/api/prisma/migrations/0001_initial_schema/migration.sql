-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LineDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('HOUSEHOLD', 'BUSINESS');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('LEDGER_VIEW', 'LEDGER_MANAGE', 'ENTRY_VIEW', 'ENTRY_CREATE', 'ENTRY_CONFIRM', 'ENTRY_POST', 'ENTRY_REVERSE', 'BUDGET_VIEW', 'BUDGET_MANAGE', 'CONTACT_VIEW', 'CONTACT_MANAGE', 'REPORT_VIEW', 'REPORT_SHARE', 'MEMBER_INVITE', 'MEMBER_MANAGE');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'E_WALLET', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('MAIN', 'SUB');

-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('CUSTOMER', 'SUPPLER');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('OPEN', 'PARTIALLY_SETTLED', 'SETTLED', 'WRITTEN_OFF', 'REVERSED');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'SALE_CASH', 'SALE_CREDIT', 'PURCHASE_CASH', 'PURCHASE_CREDIT', 'COLLECTION', 'PAYMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransferTreatment" AS ENUM ('NONE', 'EXPLICIT_FX', 'IMPLICIT_FX', 'SEPARATE_FX');

-- CreateEnum
CREATE TYPE "InputSource" AS ENUM ('MANUAL', 'VOICE');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CONFIRMED', 'POSTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'REVERSE', 'CONFIRM', 'POST', 'DELETE_ATTEMPT_BLOCKED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BudgetFlow" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BudgetLimitType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BudgetPeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AlertThresholdType" AS ENUM ('NUMERIC', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "AlertTrigger" AS ENUM ('REACH', 'EXCEED');

-- CreateEnum
CREATE TYPE "AlertEventStatus" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BudgetPercentBasis" AS ENUM ('OF_TOTAL_INCOME', 'OF_TOTAL_EXPENSE');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('GOOD', 'SERVICE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('UPLOADED', 'TRANSCRIBING', 'TRANSCRIBED', 'PARSED', 'FAILED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('HOUSEHOLD_DETAILED', 'BUSINESS_DETAILED', 'PROFIT_AND_LOSS', 'BUDGET_USAGE', 'BUDGET_REMAINING', 'BUDGET_ALERTS', 'BUDGET_CARRY_FORWARD', 'DEBT_AGING', 'STOCK_REPORT');

-- CreateEnum
CREATE TYPE "ReportRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ShareTokenStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BUDGET_ALERT', 'SUBSCRIPTION_EXPIRING', 'INVITATION', 'REPORT_READY', 'STOCK_LOW', 'DEBT_DUE');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExchangeRateSource" AS ENUM ('MANUAL', 'PROVIDER_API', 'LEDGER_DEFAULT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'EXTRACTED', 'LINKED', 'FAILED');

-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "iso2" CHAR(2) NOT NULL,
    "iso3" CHAR(3) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "nameAr" VARCHAR(120) NOT NULL,
    "defaultCurrencyId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" UUID NOT NULL,
    "code" CHAR(3) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "nameAr" VARCHAR(120) NOT NULL,
    "minorUnit" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "displayName" VARCHAR(160),
    "passwordHash" VARCHAR(255),
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "countryId" UUID,
    "isTopOwner" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "userAgent" VARCHAR(400),
    "ipAddress" VARCHAR(45),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "nameEn" VARCHAR(120) NOT NULL,
    "nameAr" VARCHAR(120) NOT NULL,
    "descriptionEn" VARCHAR(500),
    "descriptionAr" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "basePriceAmount" DECIMAL(20,4) NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "displayAmount" DECIMAL(20,4),
    "displayCurrencyId" UUID,
    "displayRate" DECIMAL(24,12),
    "displayRateSource" "ExchangeRateSource",
    "displayRateFetchedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "planPriceId" UUID,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingCycle" "BillingCycle" NOT NULL,
    "isPaymentSimulated" BOOLEAN NOT NULL DEFAULT true,
    "basePriceAmount" DECIMAL(20,4) NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "displayAmount" DECIMAL(20,4),
    "displayCurrencyId" UUID,
    "displayRate" DECIMAL(24,12),
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "currentPeriodStart" TIMESTAMPTZ(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(3) NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledgers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "LedgerType" NOT NULL,
    "status" "LedgerStatus" NOT NULL DEFAULT 'ACTIVE',
    "ownerId" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "budgetsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultTransferTreatment" "TransferTreatment" NOT NULL DEFAULT 'NONE',
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_members" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "invitedAt" TIMESTAMPTZ(3),
    "joinedAt" TIMESTAMPTZ(3),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ledger_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_member_permissions" (
    "id" UUID NOT NULL,
    "memberId" UUID NOT NULL,
    "permission" "Permission" NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedById" UUID,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ledger_member_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "inviterId" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "permissions" "Permission"[],
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_invitations" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "suggestedPermission" "Permission",
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "ttlSeconds" INTEGER NOT NULL DEFAULT 300,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "qr_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "type" "AccountType" NOT NULL,
    "currencyId" UUID NOT NULL,
    "isTransferCounterpart" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "kind" "CategoryKind" NOT NULL DEFAULT 'MAIN',
    "parentId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "colorHex" CHAR(7),
    "iconKey" VARCHAR(60),
    "systemKey" VARCHAR(60),
    "isBudgetable" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_items" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "systemKey" VARCHAR(60),
    "isBudgetable" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "flow" "BudgetFlow" NOT NULL,
    "periodType" "BudgetPeriodType" NOT NULL,
    "limitType" "BudgetLimitType" NOT NULL,
    "fixedAmount" DECIMAL(20,4),
    "percentValue" DECIMAL(9,4),
    "percentBasis" "BudgetPercentBasis",
    "currencyId" UUID,
    "categoryId" UUID,
    "categoryItemId" UUID,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "carryForwardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_periods" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "periodType" "BudgetPeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "effectiveLimit" DECIMAL(20,4) NOT NULL,
    "carriedInAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "amountSpent" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "BudgetPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "thresholdType" "AlertThresholdType" NOT NULL,
    "numericThreshold" DECIMAL(20,4),
    "percentThreshold" DECIMAL(9,4),
    "triggerOn" "AlertTrigger" NOT NULL DEFAULT 'REACH',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_events" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "budgetPeriodId" UUID NOT NULL,
    "observedAmount" DECIMAL(20,4) NOT NULL,
    "thresholdAmount" DECIMAL(20,4) NOT NULL,
    "status" "AlertEventStatus" NOT NULL DEFAULT 'TRIGGERED',
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(3),
    "dismissedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_transactions" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "kind" "TransactionKind" NOT NULL,
    "source" "InputSource" NOT NULL DEFAULT 'MANUAL',
    "description" VARCHAR(500),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "originalCurrencyId" UUID NOT NULL,
    "originalAmount" DECIMAL(20,4) NOT NULL,
    "originalAmountIsNegative" BOOLEAN NOT NULL DEFAULT false,
    "baseCurrencyId" UUID NOT NULL,
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "exchangeRate" DECIMAL(24,12),
    "exchangeRateSource" "ExchangeRateSource",
    "exchangeRateFetchedAt" TIMESTAMPTZ(3),
    "fxDriftWarning" BOOLEAN NOT NULL DEFAULT false,
    "fxDriftPercent" DECIMAL(9,4),
    "transferTreatment" "TransferTreatment" NOT NULL DEFAULT 'NONE',
    "counterpartyAccountId" UUID,
    "idempotencyKey" VARCHAR(120),
    "clientId" VARCHAR(120),
    "audioRecordingId" UUID,
    "contactId" UUID,
    "productId" UUID,
    "quantity" DECIMAL(18,6),
    "taxRateId" UUID,
    "taxAmount" DECIMAL(20,4),
    "createdById" UUID NOT NULL,
    "submittedAt" TIMESTAMPTZ(3),
    "confirmedAt" TIMESTAMPTZ(3),
    "rejectedAt" TIMESTAMPTZ(3),
    "postedEntryId" UUID,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "draft_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_lines" (
    "id" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "direction" "LineDirection" NOT NULL,
    "accountId" UUID,
    "categoryId" UUID,
    "categoryItemId" UUID,
    "amount" DECIMAL(20,4) NOT NULL,
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "memo" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'POSTED',
    "kind" "TransactionKind" NOT NULL,
    "description" VARCHAR(500),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "originalCurrencyId" UUID,
    "originalAmount" DECIMAL(20,4),
    "exchangeRate" DECIMAL(24,12),
    "exchangeRateSource" "ExchangeRateSource",
    "exchangeRateFetchedAt" TIMESTAMPTZ(3),
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "transferTreatment" "TransferTreatment" NOT NULL DEFAULT 'NONE',
    "reversalOfId" UUID,
    "contactId" UUID,
    "idempotencyKey" VARCHAR(120),
    "clientId" VARCHAR(120),
    "postedById" UUID NOT NULL,
    "postedAt" TIMESTAMPTZ(3) NOT NULL,
    "reversedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "direction" "LineDirection" NOT NULL,
    "accountId" UUID NOT NULL,
    "categoryId" UUID,
    "categoryItemId" UUID,
    "amount" DECIMAL(20,4) NOT NULL,
    "currencyId" UUID NOT NULL,
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "baseCurrencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(24,12),
    "taxRateId" UUID,
    "memo" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_audit_logs" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "entryId" UUID,
    "draftId" UUID,
    "action" "AuditAction" NOT NULL,
    "field" VARCHAR(80),
    "payload" JSONB,
    "actorId" UUID,
    "reviewerId" UUID,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "kind" "ContactKind" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "taxNumber" VARCHAR(60),
    "currencyId" UUID,
    "creditLimit" DECIMAL(20,4),
    "notes" VARCHAR(1000),
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'OPEN',
    "sourceEntryId" UUID NOT NULL,
    "description" VARCHAR(500),
    "businessDate" DATE NOT NULL,
    "originalAmount" DECIMAL(20,4) NOT NULL,
    "settledAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "currencyId" UUID NOT NULL,
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "baseSettledAmount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "baseCurrencyId" UUID NOT NULL,
    "exchangeRate" DECIMAL(24,12),
    "exchangeRateSource" "ExchangeRateSource",
    "dueDate" DATE,
    "settledAt" TIMESTAMPTZ(3),
    "writtenOffAt" TIMESTAMPTZ(3),
    "reversalOfId" UUID,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_allocations" (
    "id" UUID NOT NULL,
    "debtId" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "baseAmount" DECIMAL(20,4) NOT NULL,
    "allocatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversalOfId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "kind" "ProductKind" NOT NULL,
    "sku" VARCHAR(80),
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "variants" JSONB,
    "unitPrice" DECIMAL(20,4) NOT NULL,
    "costPrice" DECIMAL(20,4),
    "currencyId" UUID NOT NULL,
    "taxRateId" UUID,
    "trackStock" BOOLEAN NOT NULL DEFAULT false,
    "defaultWarehouseId" UUID,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currencyId" UUID NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "warehouseId" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(20,4),
    "entryId" UUID,
    "businessDate" DATE NOT NULL,
    "note" VARCHAR(300),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "countryId" UUID,
    "code" VARCHAR(40) NOT NULL,
    "nameEn" VARCHAR(160) NOT NULL,
    "nameAr" VARCHAR(160) NOT NULL,
    "percent" DECIMAL(9,4) NOT NULL,
    "currencyId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_consents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consentText" VARCHAR(1000) NOT NULL,
    "policyVersion" VARCHAR(40) NOT NULL,
    "providerId" VARCHAR(80) NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(400),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_recordings" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "consentId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "status" "AudioStatus" NOT NULL DEFAULT 'UPLOADED',
    "providerId" VARCHAR(80),
    "language" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "durationMs" INTEGER,
    "retentionPolicy" VARCHAR(60) NOT NULL,
    "retentionExpiresAt" TIMESTAMPTZ(3),
    "discardedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audio_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcription_jobs" (
    "id" UUID NOT NULL,
    "recordingId" UUID NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" VARCHAR(80),
    "transcript" TEXT,
    "confidence" DECIMAL(5,4),
    "extractedFields" JSONB,
    "errorCode" VARCHAR(80),
    "errorMessage" VARCHAR(1000),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transcription_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_requests" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "type" "ReportType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReportRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "fileId" UUID,
    "filters" JSONB,
    "errorMessage" VARCHAR(1000),
    "generatedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_tokens" (
    "id" UUID NOT NULL,
    "reportRequestId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "status" "ShareTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "maxUses" INTEGER,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMPTZ(3),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "report_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revoked_report_tokens" (
    "id" UUID NOT NULL,
    "tokenId" UUID NOT NULL,
    "revokedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedById" UUID,
    "reason" VARCHAR(500),
    "tokenHashAtRevocation" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_report_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "ledgerId" UUID,
    "storageKey" VARCHAR(400) NOT NULL,
    "originalName" VARCHAR(255),
    "mimeType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" CHAR(64) NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" UUID,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "ledgerId" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "uploadedById" UUID,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'UPLOADED',
    "extractedFields" JSONB,
    "entryId" UUID,
    "businessDate" DATE,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID,
    "payload" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(400),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ledgerId" UUID,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000),
    "entityRef" VARCHAR(120),
    "alertEventId" UUID,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "ledgerId" UUID,
    "endpoint" VARCHAR(500) NOT NULL,
    "p256dh" VARCHAR(200) NOT NULL,
    "auth" VARCHAR(200) NOT NULL,
    "userAgent" VARCHAR(400),
    "expiresAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- CreateIndex
CREATE INDEX "countries_isActive_idx" ON "countries"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE INDEX "currencies_isActive_idx" ON "currencies"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_countryId_idx" ON "users"("countryId");

-- CreateIndex
CREATE INDEX "users_status_archivedAt_idx" ON "users"("status", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_tokenHash_key" ON "user_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_revokedAt_idx" ON "user_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "plans_isActive_idx" ON "plans"("isActive");

-- CreateIndex
CREATE INDEX "plan_prices_baseCurrencyId_idx" ON "plan_prices"("baseCurrencyId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_prices_planId_billingCycle_displayCurrencyId_key" ON "plan_prices"("planId", "billingCycle", "displayCurrencyId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_currentPeriodEnd_idx" ON "subscriptions"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "ledgers_ownerId_status_idx" ON "ledgers"("ownerId", "status");

-- CreateIndex
CREATE INDEX "ledgers_type_status_archivedAt_idx" ON "ledgers"("type", "status", "archivedAt");

-- CreateIndex
CREATE INDEX "ledger_members_userId_status_idx" ON "ledger_members"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_members_ledgerId_userId_key" ON "ledger_members"("ledgerId", "userId");

-- CreateIndex
CREATE INDEX "ledger_member_permissions_permission_idx" ON "ledger_member_permissions"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_member_permissions_memberId_permission_key" ON "ledger_member_permissions"("memberId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_ledgerId_status_idx" ON "invitations"("ledgerId", "status");

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "qr_invitations_tokenHash_key" ON "qr_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "qr_invitations_ledgerId_status_idx" ON "qr_invitations"("ledgerId", "status");

-- CreateIndex
CREATE INDEX "qr_invitations_expiresAt_idx" ON "qr_invitations"("expiresAt");

-- CreateIndex
CREATE INDEX "financial_accounts_ledgerId_archivedAt_idx" ON "financial_accounts"("ledgerId", "archivedAt");

-- CreateIndex
CREATE INDEX "financial_accounts_ledgerId_type_idx" ON "financial_accounts"("ledgerId", "type");

-- CreateIndex
CREATE INDEX "categories_ledgerId_kind_archivedAt_idx" ON "categories"("ledgerId", "kind", "archivedAt");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_ledgerId_systemKey_key" ON "categories"("ledgerId", "systemKey");

-- CreateIndex
CREATE INDEX "category_items_categoryId_archivedAt_idx" ON "category_items"("categoryId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "category_items_categoryId_systemKey_key" ON "category_items"("categoryId", "systemKey");

-- CreateIndex
CREATE INDEX "budgets_ledgerId_isActive_archivedAt_idx" ON "budgets"("ledgerId", "isActive", "archivedAt");

-- CreateIndex
CREATE INDEX "budgets_ledgerId_flow_periodType_idx" ON "budgets"("ledgerId", "flow", "periodType");

-- CreateIndex
CREATE INDEX "budgets_categoryId_idx" ON "budgets"("categoryId");

-- CreateIndex
CREATE INDEX "budgets_categoryItemId_idx" ON "budgets"("categoryItemId");

-- CreateIndex
CREATE INDEX "budget_periods_periodStart_periodEnd_status_idx" ON "budget_periods"("periodStart", "periodEnd", "status");

-- CreateIndex
CREATE UNIQUE INDEX "budget_periods_budgetId_periodStart_periodEnd_key" ON "budget_periods"("budgetId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "alert_rules_budgetId_enabled_idx" ON "alert_rules"("budgetId", "enabled");

-- CreateIndex
CREATE INDEX "alert_events_ruleId_triggeredAt_idx" ON "alert_events"("ruleId", "triggeredAt");

-- CreateIndex
CREATE INDEX "alert_events_budgetPeriodId_status_idx" ON "alert_events"("budgetPeriodId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "draft_transactions_postedEntryId_key" ON "draft_transactions"("postedEntryId");

-- CreateIndex
CREATE INDEX "draft_transactions_ledgerId_status_businessDate_idx" ON "draft_transactions"("ledgerId", "status", "businessDate");

-- CreateIndex
CREATE INDEX "draft_transactions_ledgerId_kind_businessDate_idx" ON "draft_transactions"("ledgerId", "kind", "businessDate");

-- CreateIndex
CREATE INDEX "draft_transactions_businessDate_idx" ON "draft_transactions"("businessDate");

-- CreateIndex
CREATE INDEX "draft_transactions_contactId_idx" ON "draft_transactions"("contactId");

-- CreateIndex
CREATE INDEX "draft_transactions_createdById_createdAt_idx" ON "draft_transactions"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "draft_transactions_audioRecordingId_idx" ON "draft_transactions"("audioRecordingId");

-- CreateIndex
CREATE UNIQUE INDEX "draft_transactions_ledgerId_idempotencyKey_key" ON "draft_transactions"("ledgerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "draft_transactions_ledgerId_clientId_key" ON "draft_transactions"("ledgerId", "clientId");

-- CreateIndex
CREATE INDEX "draft_lines_draftId_idx" ON "draft_lines"("draftId");

-- CreateIndex
CREATE INDEX "draft_lines_categoryId_idx" ON "draft_lines"("categoryId");

-- CreateIndex
CREATE INDEX "draft_lines_categoryItemId_idx" ON "draft_lines"("categoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_reversalOfId_key" ON "journal_entries"("reversalOfId");

-- CreateIndex
CREATE INDEX "journal_entries_ledgerId_status_businessDate_idx" ON "journal_entries"("ledgerId", "status", "businessDate");

-- CreateIndex
CREATE INDEX "journal_entries_ledgerId_kind_businessDate_idx" ON "journal_entries"("ledgerId", "kind", "businessDate");

-- CreateIndex
CREATE INDEX "journal_entries_businessDate_idx" ON "journal_entries"("businessDate");

-- CreateIndex
CREATE INDEX "journal_entries_occurredAt_idx" ON "journal_entries"("occurredAt");

-- CreateIndex
CREATE INDEX "journal_entries_contactId_idx" ON "journal_entries"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_ledgerId_sequenceNumber_key" ON "journal_entries"("ledgerId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_ledgerId_idempotencyKey_key" ON "journal_entries"("ledgerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_ledgerId_clientId_key" ON "journal_entries"("ledgerId", "clientId");

-- CreateIndex
CREATE INDEX "journal_lines_entryId_idx" ON "journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "journal_lines_ledgerId_createdAt_idx" ON "journal_lines"("ledgerId", "createdAt");

-- CreateIndex
CREATE INDEX "journal_lines_accountId_createdAt_idx" ON "journal_lines"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "journal_lines_categoryId_idx" ON "journal_lines"("categoryId");

-- CreateIndex
CREATE INDEX "journal_lines_categoryItemId_idx" ON "journal_lines"("categoryItemId");

-- CreateIndex
CREATE INDEX "transaction_audit_logs_ledgerId_createdAt_idx" ON "transaction_audit_logs"("ledgerId", "createdAt");

-- CreateIndex
CREATE INDEX "transaction_audit_logs_entryId_createdAt_idx" ON "transaction_audit_logs"("entryId", "createdAt");

-- CreateIndex
CREATE INDEX "transaction_audit_logs_draftId_createdAt_idx" ON "transaction_audit_logs"("draftId", "createdAt");

-- CreateIndex
CREATE INDEX "contacts_ledgerId_kind_archivedAt_idx" ON "contacts"("ledgerId", "kind", "archivedAt");

-- CreateIndex
CREATE INDEX "contacts_ledgerId_name_idx" ON "contacts"("ledgerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "debts_reversalOfId_key" ON "debts"("reversalOfId");

-- CreateIndex
CREATE INDEX "debts_ledgerId_status_dueDate_idx" ON "debts"("ledgerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "debts_ledgerId_direction_status_idx" ON "debts"("ledgerId", "direction", "status");

-- CreateIndex
CREATE INDEX "debts_ledgerId_businessDate_idx" ON "debts"("ledgerId", "businessDate");

-- CreateIndex
CREATE INDEX "debts_contactId_status_idx" ON "debts"("contactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "debt_allocations_reversalOfId_key" ON "debt_allocations"("reversalOfId");

-- CreateIndex
CREATE INDEX "debt_allocations_debtId_allocatedAt_idx" ON "debt_allocations"("debtId", "allocatedAt");

-- CreateIndex
CREATE INDEX "debt_allocations_entryId_idx" ON "debt_allocations"("entryId");

-- CreateIndex
CREATE INDEX "products_ledgerId_kind_archivedAt_idx" ON "products"("ledgerId", "kind", "archivedAt");

-- CreateIndex
CREATE INDEX "products_taxRateId_idx" ON "products"("taxRateId");

-- CreateIndex
CREATE UNIQUE INDEX "products_ledgerId_sku_key" ON "products"("ledgerId", "sku");

-- CreateIndex
CREATE INDEX "warehouses_ledgerId_archivedAt_idx" ON "warehouses"("ledgerId", "archivedAt");

-- CreateIndex
CREATE INDEX "stock_movements_ledgerId_productId_businessDate_idx" ON "stock_movements"("ledgerId", "productId", "businessDate");

-- CreateIndex
CREATE INDEX "stock_movements_warehouseId_productId_idx" ON "stock_movements"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "stock_movements_entryId_idx" ON "stock_movements"("entryId");

-- CreateIndex
CREATE INDEX "tax_rates_ledgerId_isActive_archivedAt_idx" ON "tax_rates"("ledgerId", "isActive", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_ledgerId_code_key" ON "tax_rates"("ledgerId", "code");

-- CreateIndex
CREATE INDEX "audio_consents_userId_grantedAt_idx" ON "audio_consents"("userId", "grantedAt");

-- CreateIndex
CREATE INDEX "audio_consents_providerId_idx" ON "audio_consents"("providerId");

-- CreateIndex
CREATE INDEX "audio_recordings_ledgerId_status_idx" ON "audio_recordings"("ledgerId", "status");

-- CreateIndex
CREATE INDEX "audio_recordings_userId_createdAt_idx" ON "audio_recordings"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audio_recordings_retentionExpiresAt_idx" ON "audio_recordings"("retentionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "transcription_jobs_recordingId_key" ON "transcription_jobs"("recordingId");

-- CreateIndex
CREATE INDEX "transcription_jobs_status_createdAt_idx" ON "transcription_jobs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "report_requests_ledgerId_type_periodStart_periodEnd_idx" ON "report_requests"("ledgerId", "type", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "report_requests_requestedById_createdAt_idx" ON "report_requests"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "report_requests_status_createdAt_idx" ON "report_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "report_tokens_tokenHash_key" ON "report_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "report_tokens_reportRequestId_status_idx" ON "report_tokens"("reportRequestId", "status");

-- CreateIndex
CREATE INDEX "report_tokens_expiresAt_idx" ON "report_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "revoked_report_tokens_tokenId_idx" ON "revoked_report_tokens"("tokenId");

-- CreateIndex
CREATE INDEX "revoked_report_tokens_tokenHashAtRevocation_idx" ON "revoked_report_tokens"("tokenHashAtRevocation");

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_storageKey_key" ON "file_objects"("storageKey");

-- CreateIndex
CREATE INDEX "file_objects_ledgerId_status_idx" ON "file_objects"("ledgerId", "status");

-- CreateIndex
CREATE INDEX "file_objects_checksumSha256_idx" ON "file_objects"("checksumSha256");

-- CreateIndex
CREATE INDEX "receipts_ledgerId_status_idx" ON "receipts"("ledgerId", "status");

-- CreateIndex
CREATE INDEX "receipts_entryId_idx" ON "receipts"("entryId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_status_createdAt_idx" ON "notifications"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_ledgerId_createdAt_idx" ON "notifications"("ledgerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_createdAt_idx" ON "push_subscriptions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_defaultCurrencyId_fkey" FOREIGN KEY ("defaultCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_displayCurrencyId_fkey" FOREIGN KEY ("displayCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES "plan_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_displayCurrencyId_fkey" FOREIGN KEY ("displayCurrencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledgers" ADD CONSTRAINT "ledgers_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_members" ADD CONSTRAINT "ledger_members_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_members" ADD CONSTRAINT "ledger_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_member_permissions" ADD CONSTRAINT "ledger_member_permissions_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ledger_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_member_permissions" ADD CONSTRAINT "ledger_member_permissions_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_invitations" ADD CONSTRAINT "qr_invitations_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_invitations" ADD CONSTRAINT "qr_invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_items" ADD CONSTRAINT "category_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "category_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_periods" ADD CONSTRAINT "budget_periods_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "alert_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_budgetPeriodId_fkey" FOREIGN KEY ("budgetPeriodId") REFERENCES "budget_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_originalCurrencyId_fkey" FOREIGN KEY ("originalCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_counterpartyAccountId_fkey" FOREIGN KEY ("counterpartyAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_audioRecordingId_fkey" FOREIGN KEY ("audioRecordingId") REFERENCES "audio_recordings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_transactions" ADD CONSTRAINT "draft_transactions_postedEntryId_fkey" FOREIGN KEY ("postedEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "draft_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_lines" ADD CONSTRAINT "draft_lines_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "category_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_originalCurrencyId_fkey" FOREIGN KEY ("originalCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_categoryItemId_fkey" FOREIGN KEY ("categoryItemId") REFERENCES "category_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_logs" ADD CONSTRAINT "transaction_audit_logs_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_logs" ADD CONSTRAINT "transaction_audit_logs_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_logs" ADD CONSTRAINT "transaction_audit_logs_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "draft_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_logs" ADD CONSTRAINT "transaction_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_audit_logs" ADD CONSTRAINT "transaction_audit_logs_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_sourceEntryId_fkey" FOREIGN KEY ("sourceEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_baseCurrencyId_fkey" FOREIGN KEY ("baseCurrencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_allocations" ADD CONSTRAINT "debt_allocations_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_allocations" ADD CONSTRAINT "debt_allocations_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_allocations" ADD CONSTRAINT "debt_allocations_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "debt_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "tax_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_consents" ADD CONSTRAINT "audio_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "audio_consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_recordings" ADD CONSTRAINT "audio_recordings_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcription_jobs" ADD CONSTRAINT "transcription_jobs_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "audio_recordings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_requests" ADD CONSTRAINT "report_requests_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tokens" ADD CONSTRAINT "report_tokens_reportRequestId_fkey" FOREIGN KEY ("reportRequestId") REFERENCES "report_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_tokens" ADD CONSTRAINT "report_tokens_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revoked_report_tokens" ADD CONSTRAINT "revoked_report_tokens_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "report_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revoked_report_tokens" ADD CONSTRAINT "revoked_report_tokens_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alertEventId_fkey" FOREIGN KEY ("alertEventId") REFERENCES "alert_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "ledgers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

