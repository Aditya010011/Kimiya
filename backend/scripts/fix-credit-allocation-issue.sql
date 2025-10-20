-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX CREDIT ALLOCATION ISSUE
-- ═══════════════════════════════════════════════════════════════════════════════
-- 
-- This script fixes two critical issues preventing credit allocation:
-- 1. Updates CHECK constraint on service_type to allow new values
-- 2. Creates missing tblPlanChangeHistory table
--
-- ═══════════════════════════════════════════════════════════════════════════════

PRINT '═══════════════════════════════════════════════════════════════════════════════';
PRINT '🔧 FIXING CREDIT ALLOCATION ISSUES';
PRINT '═══════════════════════════════════════════════════════════════════════════════';
PRINT '';

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Update CHECK constraint on tblCreditTransactions.service_type
-- ═══════════════════════════════════════════════════════════════════════════════

PRINT '📋 STEP 1: Updating CHECK constraint on service_type...';
PRINT '';

-- Drop existing constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_tblCreditTransactions_service_type')
BEGIN
    ALTER TABLE tblCreditTransactions DROP CONSTRAINT CK_tblCreditTransactions_service_type;
    PRINT '  ✅ Dropped old CHECK constraint';
END
ELSE
BEGIN
    PRINT '  ℹ️  No existing CHECK constraint found';
END

-- Create new constraint with all required values
ALTER TABLE tblCreditTransactions ADD CONSTRAINT CK_tblCreditTransactions_service_type 
CHECK (service_type IN (
    -- Original values (existing usage)
    'chat',
    'inbound_call',
    'outbound_call',
    'storage',
    'transcription',
    'ai_service',
    'manual',
    'system',
    -- New values (credit system fixes)
    'adjustment',
    'plan_upgrade',
    'plan_downgrade',
    'reservation',
    'reservation_refund',
    'credit_expiration',
    'allocation',
    'deduction',
    'refund',
    'purchase',
    'subscription'
));

PRINT '  ✅ Created new CHECK constraint with all required values';
PRINT '';

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create tblPlanChangeHistory table
-- ═══════════════════════════════════════════════════════════════════════════════

PRINT '📋 STEP 2: Creating tblPlanChangeHistory table...';
PRINT '';

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tblPlanChangeHistory')
BEGIN
    CREATE TABLE tblPlanChangeHistory (
        id INT IDENTITY(1,1) PRIMARY KEY,
        organization_id NVARCHAR(50) NOT NULL,
        old_plan_id NVARCHAR(50),
        new_plan_id NVARCHAR(50),
        old_billing_cycle NVARCHAR(20),
        new_billing_cycle NVARCHAR(20),
        change_type NVARCHAR(20) CHECK (change_type IN ('upgrade', 'downgrade', 'cycle_change', 'initial')),
        effective_date DATETIME2 DEFAULT GETDATE(),
        proration_amount DECIMAL(10,2),
        credit_adjustment INT,
        users_affected INT,
        changed_by INT,
        reason NVARCHAR(500),
        created_at DATETIME2 DEFAULT GETDATE(),
        
        -- Foreign keys
        CONSTRAINT FK_PlanChangeHistory_Organization 
            FOREIGN KEY (organization_id) REFERENCES tblOrganizations(organization_id),
        CONSTRAINT FK_PlanChangeHistory_OldPlan 
            FOREIGN KEY (old_plan_id) REFERENCES tblPricingPlans(plan_id),
        CONSTRAINT FK_PlanChangeHistory_NewPlan 
            FOREIGN KEY (new_plan_id) REFERENCES tblPricingPlans(plan_id),
        CONSTRAINT FK_PlanChangeHistory_ChangedBy 
            FOREIGN KEY (changed_by) REFERENCES tblUsers(id)
    );
    
    PRINT '  ✅ Created tblPlanChangeHistory table';
    
    -- Create indexes for performance
    CREATE INDEX IX_PlanChangeHistory_Organization 
        ON tblPlanChangeHistory(organization_id);
    
    CREATE INDEX IX_PlanChangeHistory_EffectiveDate 
        ON tblPlanChangeHistory(effective_date DESC);
    
    CREATE INDEX IX_PlanChangeHistory_ChangeType 
        ON tblPlanChangeHistory(change_type);
    
    PRINT '  ✅ Created indexes on tblPlanChangeHistory';
END
ELSE
BEGIN
    PRINT '  ℹ️  tblPlanChangeHistory table already exists';
END

PRINT '';

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Verify fixes
-- ═══════════════════════════════════════════════════════════════════════════════

PRINT '📋 STEP 3: Verifying fixes...';
PRINT '';

-- Verify CHECK constraint
DECLARE @constraintDef NVARCHAR(MAX);
SELECT @constraintDef = definition 
FROM sys.check_constraints 
WHERE name = 'CK_tblCreditTransactions_service_type';

IF @constraintDef IS NOT NULL
BEGIN
    PRINT '  ✅ CHECK constraint exists and is active';
END
ELSE
BEGIN
    PRINT '  ❌ CHECK constraint not found!';
END

-- Verify table exists
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'tblPlanChangeHistory')
BEGIN
    PRINT '  ✅ tblPlanChangeHistory table exists';
END
ELSE
BEGIN
    PRINT '  ❌ tblPlanChangeHistory table not found!';
END

PRINT '';
PRINT '═══════════════════════════════════════════════════════════════════════════════';
PRINT '✅ CREDIT ALLOCATION FIXES COMPLETE';
PRINT '═══════════════════════════════════════════════════════════════════════════════';
PRINT '';
PRINT 'Next Steps:';
PRINT '  1. Restart the backend server: pm2 restart kimiya-voice-backend-dev';
PRINT '  2. Try purchasing or changing a plan';
PRINT '  3. Verify credits are allocated correctly';
PRINT '  4. Check PM2 logs for any errors';
PRINT '';

