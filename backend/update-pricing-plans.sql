-- Update Credit Plans Schema and Data for New Hybrid Pricing Structure
-- Run this script in SQL Server Management Studio or Azure Data Studio

-- Step 1: Add new columns to tblCreditPlans if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'annual_price_usd')
BEGIN
    ALTER TABLE tblCreditPlans ADD annual_price_usd DECIMAL(10,2) NULL;
    PRINT '✅ Added annual_price_usd column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'billing_cycle')
BEGIN
    ALTER TABLE tblCreditPlans ADD billing_cycle NVARCHAR(20) NULL DEFAULT 'monthly';
    PRINT '✅ Added billing_cycle column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'minutes_included')
BEGIN
    ALTER TABLE tblCreditPlans ADD minutes_included INT NULL;
    PRINT '✅ Added minutes_included column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'cost_per_minute')
BEGIN
    ALTER TABLE tblCreditPlans ADD cost_per_minute DECIMAL(10,4) NULL;
    PRINT '✅ Added cost_per_minute column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'extra_credit_cost')
BEGIN
    ALTER TABLE tblCreditPlans ADD extra_credit_cost DECIMAL(10,6) NULL;
    PRINT '✅ Added extra_credit_cost column';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblCreditPlans') AND name = 'is_enterprise')
BEGIN
    ALTER TABLE tblCreditPlans ADD is_enterprise BIT NOT NULL DEFAULT 0;
    PRINT '✅ Added is_enterprise column';
END

-- Step 2: Add billing_cycle to tblSubscriptions if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('tblSubscriptions') AND name = 'billing_cycle')
BEGIN
    ALTER TABLE tblSubscriptions ADD billing_cycle NVARCHAR(20) NULL DEFAULT 'monthly';
    PRINT '✅ Added billing_cycle column to tblSubscriptions';
END

-- Step 3: Delete old plans
DELETE FROM tblCreditPlans WHERE id IN ('basic', 'professional', 'enterprise', 'ultimate');
PRINT '🗑️ Removed old credit plans';

-- Step 4: Insert new competitive pricing plans

-- Starter Plan - $49/month
INSERT INTO tblCreditPlans (
    id, name, description, monthly_credits, price_usd, annual_price_usd,
    billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
    ai_messages, team_members, extra_minute_cost, extra_credit_cost,
    minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
) VALUES (
    'starter', 
    'Starter', 
    '500 mins / month (30,000 credits)',
    30000,      -- 500 minutes * 60 seconds
    49.00,      -- Monthly price
    470.40,     -- Annual price (20% discount)
    'monthly',
    2,          -- AI operators
    5,          -- Concurrent calls
    5,          -- Campaigns per month
    2000,       -- AI messages
    3,          -- Team members
    0.40,       -- Extra minute cost
    0.0067,     -- Extra credit cost ($0.40 / 60)
    500,        -- Minutes included
    0.098,      -- Cost per minute ($49 / 500)
    0,          -- Not popular
    0,          -- Not enterprise
    1           -- Active
);

-- Professional Plan - $299/month (Most Popular)
INSERT INTO tblCreditPlans (
    id, name, description, monthly_credits, price_usd, annual_price_usd,
    billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
    ai_messages, team_members, extra_minute_cost, extra_credit_cost,
    minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
) VALUES (
    'professional', 
    'Professional', 
    '3,000 mins / month (180,000 credits)',
    180000,     -- 3,000 minutes * 60 seconds
    299.00,     -- Monthly price
    2868.80,    -- Annual price (20% discount)
    'monthly',
    10,         -- AI operators
    25,         -- Concurrent calls
    50,         -- Campaigns per month
    10000,      -- AI messages
    15,         -- Team members
    0.25,       -- Extra minute cost
    0.0042,     -- Extra credit cost ($0.25 / 60)
    3000,       -- Minutes included
    0.0997,     -- Cost per minute ($299 / 3,000)
    1,          -- Most popular
    0,          -- Not enterprise
    1           -- Active
);

-- Business Plan - $899/month
INSERT INTO tblCreditPlans (
    id, name, description, monthly_credits, price_usd, annual_price_usd,
    billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
    ai_messages, team_members, extra_minute_cost, extra_credit_cost,
    minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
) VALUES (
    'business', 
    'Business', 
    '12,000 mins / month (720,000 credits)',
    720000,     -- 12,000 minutes * 60 seconds
    899.00,     -- Monthly price
    8630.40,    -- Annual price (20% discount)
    'monthly',
    50,         -- AI operators
    100,        -- Concurrent calls
    -1,         -- Unlimited campaigns
    50000,      -- AI messages
    50,         -- Team members
    0.15,       -- Extra minute cost
    0.0025,     -- Extra credit cost ($0.15 / 60)
    12000,      -- Minutes included
    0.0749,     -- Cost per minute ($899 / 12,000)
    0,          -- Not popular
    0,          -- Not enterprise
    1           -- Active
);

-- Enterprise Plan - Custom Pricing
INSERT INTO tblCreditPlans (
    id, name, description, monthly_credits, price_usd, annual_price_usd,
    billing_cycle, ai_operators, concurrent_calls, campaigns_per_month,
    ai_messages, team_members, extra_minute_cost, extra_credit_cost,
    minutes_included, cost_per_minute, is_popular, is_enterprise, is_active
) VALUES (
    'enterprise', 
    'Enterprise', 
    'Unlimited minutes (Custom pricing)',
    -1,         -- Unlimited credits
    -1,         -- Custom pricing
    -1,         -- Custom pricing
    'custom',
    -1,         -- Unlimited AI operators
    -1,         -- Unlimited concurrent calls
    -1,         -- Unlimited campaigns
    -1,         -- Unlimited AI messages
    -1,         -- Unlimited team members
    0,          -- Negotiated rates
    0,          -- Negotiated rates
    -1,         -- Unlimited minutes
    0,          -- Custom pricing
    0,          -- Not popular
    1,          -- Enterprise plan
    1           -- Active
);

PRINT '✅ Inserted new credit plans with competitive pricing';

-- Step 5: Display the new plans
SELECT 
    id,
    name,
    description,
    monthly_credits,
    price_usd,
    annual_price_usd,
    minutes_included,
    cost_per_minute,
    ai_operators,
    concurrent_calls,
    ai_messages,
    team_members,
    extra_minute_cost,
    is_popular,
    is_enterprise
FROM tblCreditPlans
ORDER BY 
    CASE 
        WHEN price_usd = -1 THEN 9999
        ELSE price_usd
    END;

PRINT '';
PRINT '🎉 Pricing structure updated successfully!';
PRINT '';
PRINT '📊 New Pricing:';
PRINT '   • Starter: $49/month (500 mins) - $470.40/year';
PRINT '   • Professional: $299/month (3,000 mins) - $2,868.80/year ⭐';
PRINT '   • Business: $899/month (12,000 mins) - $8,630.40/year';
PRINT '   • Enterprise: Custom pricing (Unlimited)';
PRINT '';
PRINT '💰 Annual billing saves 20% on all plans!';
