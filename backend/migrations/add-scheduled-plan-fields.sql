-- Migration: Add scheduled plan change fields to tblSubscriptions
-- Date: 2025-10-17
-- Description: Adds fields to support scheduling plan changes for next billing cycle

USE KimiyaVoiceDB;
GO

-- Check if columns already exist before adding
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.tblSubscriptions') AND name = 'scheduled_plan_id')
BEGIN
    ALTER TABLE tblSubscriptions
    ADD scheduled_plan_id NVARCHAR(50) NULL;
    
    PRINT '✅ Added scheduled_plan_id column to tblSubscriptions';
END
ELSE
BEGIN
    PRINT '⚠️  scheduled_plan_id column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.tblSubscriptions') AND name = 'scheduled_billing_cycle')
BEGIN
    ALTER TABLE tblSubscriptions
    ADD scheduled_billing_cycle NVARCHAR(20) NULL;
    
    PRINT '✅ Added scheduled_billing_cycle column to tblSubscriptions';
END
ELSE
BEGIN
    PRINT '⚠️  scheduled_billing_cycle column already exists';
END
GO

-- Add foreign key constraint for scheduled_plan_id
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_tblSubscriptions_scheduled_plan')
BEGIN
    ALTER TABLE tblSubscriptions
    ADD CONSTRAINT FK_tblSubscriptions_scheduled_plan
    FOREIGN KEY (scheduled_plan_id) REFERENCES tblCreditPlans(id);
    
    PRINT '✅ Added foreign key constraint for scheduled_plan_id';
END
ELSE
BEGIN
    PRINT '⚠️  Foreign key constraint already exists';
END
GO

-- Add check constraint for scheduled_billing_cycle
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_tblSubscriptions_scheduled_billing_cycle')
BEGIN
    ALTER TABLE tblSubscriptions
    ADD CONSTRAINT CK_tblSubscriptions_scheduled_billing_cycle
    CHECK (scheduled_billing_cycle IN ('monthly', 'annual') OR scheduled_billing_cycle IS NULL);
    
    PRINT '✅ Added check constraint for scheduled_billing_cycle';
END
ELSE
BEGIN
    PRINT '⚠️  Check constraint already exists';
END
GO

-- Add extended properties (descriptions)
IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('dbo.tblSubscriptions') 
    AND minor_id = (SELECT column_id FROM sys.columns WHERE name = 'scheduled_plan_id' AND object_id = OBJECT_ID('dbo.tblSubscriptions'))
    AND name = 'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Plan ID to switch to at next billing cycle (NULL if no change scheduled)', 
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE',  @level1name = N'tblSubscriptions',
        @level2type = N'COLUMN', @level2name = N'scheduled_plan_id';
    
    PRINT '✅ Added description for scheduled_plan_id';
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('dbo.tblSubscriptions') 
    AND minor_id = (SELECT column_id FROM sys.columns WHERE name = 'scheduled_billing_cycle' AND object_id = OBJECT_ID('dbo.tblSubscriptions'))
    AND name = 'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Billing cycle for scheduled plan (monthly or annual)', 
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE',  @level1name = N'tblSubscriptions',
        @level2type = N'COLUMN', @level2name = N'scheduled_billing_cycle';
    
    PRINT '✅ Added description for scheduled_billing_cycle';
END
GO

-- Create table for plan change history (audit trail)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblPlanChangeHistory')
BEGIN
    CREATE TABLE tblPlanChangeHistory (
        id INT IDENTITY(1,1) PRIMARY KEY,
        organization_id NVARCHAR(50) NOT NULL,
        old_plan_id NVARCHAR(50) NOT NULL,
        new_plan_id NVARCHAR(50) NOT NULL,
        old_billing_cycle NVARCHAR(20) NOT NULL,
        new_billing_cycle NVARCHAR(20) NOT NULL,
        change_type NVARCHAR(20) NOT NULL, -- 'upgrade', 'downgrade', 'cycle_change'
        effective_date DATETIME2 NOT NULL,
        proration_amount DECIMAL(10,2) NULL,
        credit_adjustment INT NULL,
        users_affected INT NULL,
        changed_by INT NOT NULL,
        reason NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_tblPlanChangeHistory_organization 
            FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id),
        CONSTRAINT FK_tblPlanChangeHistory_old_plan 
            FOREIGN KEY (old_plan_id) REFERENCES tblCreditPlans(id),
        CONSTRAINT FK_tblPlanChangeHistory_new_plan 
            FOREIGN KEY (new_plan_id) REFERENCES tblCreditPlans(id),
        CONSTRAINT FK_tblPlanChangeHistory_changed_by 
            FOREIGN KEY (changed_by) REFERENCES tblUsers(id),
        CONSTRAINT CK_tblPlanChangeHistory_change_type 
            CHECK (change_type IN ('upgrade', 'downgrade', 'cycle_change', 'same_tier'))
    );
    
    -- Create index for faster queries
    CREATE INDEX IX_tblPlanChangeHistory_organization 
        ON tblPlanChangeHistory(organization_id, created_at DESC);
    
    CREATE INDEX IX_tblPlanChangeHistory_created_at 
        ON tblPlanChangeHistory(created_at DESC);
    
    PRINT '✅ Created tblPlanChangeHistory table';
END
ELSE
BEGIN
    PRINT '⚠️  tblPlanChangeHistory table already exists';
END
GO

-- Add extended properties for tblPlanChangeHistory
IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('dbo.tblPlanChangeHistory') 
    AND minor_id = 0
    AND name = 'MS_Description'
)
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Audit trail for all plan changes including upgrades, downgrades, and billing cycle changes', 
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE',  @level1name = N'tblPlanChangeHistory';
    
    PRINT '✅ Added description for tblPlanChangeHistory';
END
GO

PRINT '';
PRINT '═══════════════════════════════════════════════════════════';
PRINT '✅ Migration completed successfully!';
PRINT '═══════════════════════════════════════════════════════════';
PRINT '';
PRINT 'Changes made:';
PRINT '  1. Added scheduled_plan_id column to tblSubscriptions';
PRINT '  2. Added scheduled_billing_cycle column to tblSubscriptions';
PRINT '  3. Added foreign key and check constraints';
PRINT '  4. Created tblPlanChangeHistory table for audit trail';
PRINT '  5. Added indexes for performance';
PRINT '';
PRINT 'Next steps:';
PRINT '  - Test plan change functionality';
PRINT '  - Verify audit trail is working';
PRINT '  - Update API documentation';
PRINT '';
GO

