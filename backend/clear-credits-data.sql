-- ============================================================================
-- Clear All Credits-Related Data from KimiyaVoiceDB
-- ============================================================================
-- This script clears all credits, subscriptions, billing, and payment data
-- to allow for a fresh start with testing.
--
-- Tables cleared (in dependency order):
-- 1. tblUsageLogs
-- 2. tblBillingHistory
-- 3. tblCreditTransactions
-- 4. tblPaymentMethods
-- 5. tblCreditBalances
-- 6. tblSubscriptions
--
-- ============================================================================

USE KimiyaVoiceDB;
GO

PRINT '🔄 Starting to clear credits-related data...';
PRINT '';

-- Disable foreign key constraints temporarily
PRINT '🔐 Disabling foreign key constraints...';
EXEC sp_MSForEachTable "ALTER TABLE ? NOCHECK CONSTRAINT all";
PRINT '✅ Foreign key constraints disabled';
PRINT '';

-- Clear tables in order of dependencies
PRINT '📊 Clearing tables...';
PRINT '';

-- 1. Clear Usage Logs
IF OBJECT_ID('tblUsageLogs', 'U') IS NOT NULL
BEGIN
    DECLARE @UsageLogsCount INT;
    SELECT @UsageLogsCount = COUNT(*) FROM tblUsageLogs;
    DELETE FROM tblUsageLogs;
    PRINT '✅ Cleared tblUsageLogs: ' + CAST(@UsageLogsCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblUsageLogs does not exist';
END
GO

-- 2. Clear Billing History
IF OBJECT_ID('tblBillingHistory', 'U') IS NOT NULL
BEGIN
    DECLARE @BillingHistoryCount INT;
    SELECT @BillingHistoryCount = COUNT(*) FROM tblBillingHistory;
    DELETE FROM tblBillingHistory;
    PRINT '✅ Cleared tblBillingHistory: ' + CAST(@BillingHistoryCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblBillingHistory does not exist';
END
GO

-- 3. Clear Credit Transactions
IF OBJECT_ID('tblCreditTransactions', 'U') IS NOT NULL
BEGIN
    DECLARE @CreditTransactionsCount INT;
    SELECT @CreditTransactionsCount = COUNT(*) FROM tblCreditTransactions;
    DELETE FROM tblCreditTransactions;
    PRINT '✅ Cleared tblCreditTransactions: ' + CAST(@CreditTransactionsCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblCreditTransactions does not exist';
END
GO

-- 4. Clear Payment Methods
IF OBJECT_ID('tblPaymentMethods', 'U') IS NOT NULL
BEGIN
    DECLARE @PaymentMethodsCount INT;
    SELECT @PaymentMethodsCount = COUNT(*) FROM tblPaymentMethods;
    DELETE FROM tblPaymentMethods;
    PRINT '✅ Cleared tblPaymentMethods: ' + CAST(@PaymentMethodsCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblPaymentMethods does not exist';
END
GO

-- 5. Clear Credit Balances
IF OBJECT_ID('tblCreditBalances', 'U') IS NOT NULL
BEGIN
    DECLARE @CreditBalancesCount INT;
    SELECT @CreditBalancesCount = COUNT(*) FROM tblCreditBalances;
    DELETE FROM tblCreditBalances;
    PRINT '✅ Cleared tblCreditBalances: ' + CAST(@CreditBalancesCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblCreditBalances does not exist';
END
GO

-- 6. Clear Subscriptions
IF OBJECT_ID('tblSubscriptions', 'U') IS NOT NULL
BEGIN
    DECLARE @SubscriptionsCount INT;
    SELECT @SubscriptionsCount = COUNT(*) FROM tblSubscriptions;
    DELETE FROM tblSubscriptions;
    PRINT '✅ Cleared tblSubscriptions: ' + CAST(@SubscriptionsCount AS VARCHAR(10)) + ' rows deleted';
END
ELSE
BEGIN
    PRINT '⚠️  tblSubscriptions does not exist';
END
GO

PRINT '';

-- Re-enable foreign key constraints
PRINT '🔐 Re-enabling foreign key constraints...';
EXEC sp_MSForEachTable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT all";
PRINT '✅ Foreign key constraints re-enabled';
PRINT '';

-- Verify tables are empty
PRINT '📊 Verifying tables are empty:';
PRINT '';

IF OBJECT_ID('tblUsageLogs', 'U') IS NOT NULL
    SELECT '   tblUsageLogs: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblUsageLogs;

IF OBJECT_ID('tblBillingHistory', 'U') IS NOT NULL
    SELECT '   tblBillingHistory: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblBillingHistory;

IF OBJECT_ID('tblCreditTransactions', 'U') IS NOT NULL
    SELECT '   tblCreditTransactions: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblCreditTransactions;

IF OBJECT_ID('tblPaymentMethods', 'U') IS NOT NULL
    SELECT '   tblPaymentMethods: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblPaymentMethods;

IF OBJECT_ID('tblCreditBalances', 'U') IS NOT NULL
    SELECT '   tblCreditBalances: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblCreditBalances;

IF OBJECT_ID('tblSubscriptions', 'U') IS NOT NULL
    SELECT '   tblSubscriptions: ' + CAST(COUNT(*) AS VARCHAR(10)) + ' rows' AS Status FROM tblSubscriptions;

PRINT '';
PRINT '🎉 All credits data cleared successfully!';
PRINT '';
PRINT '📝 Next steps:';
PRINT '   1. Log in to the admin panel';
PRINT '   2. Navigate to /admin/billing';
PRINT '   3. Select a plan and complete the payment';
PRINT '   4. Check if the subscription updates correctly';
PRINT '';

