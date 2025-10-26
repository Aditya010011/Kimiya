const sql = require('mssql');
require('dotenv').config({ path: './.env.development' });

// Validate required environment variables
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`❌ Missing required database environment variables: ${missingVars.join(', ')}`);
  console.error('Please check your .env.development file');
  process.exit(1);
}

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || false,
    enableArithAbort: true,
    requestTimeout: 60000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

/**
 * Create Organizations table
 */
async function createOrganizationsTable(pool) {
  console.log('\n🏢 Creating Organizations table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblOrganizations' AND xtype='U')
    BEGIN
      CREATE TABLE tblOrganizations (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NULL,
        address_line1 NVARCHAR(255) NULL,
        address_line2 NVARCHAR(255) NULL,
        city NVARCHAR(100) NULL,
        state NVARCHAR(100) NULL,
        postal_code NVARCHAR(20) NULL,
        country NVARCHAR(100) NULL DEFAULT 'US',
        timezone NVARCHAR(50) NULL DEFAULT 'UTC',
        is_active BIT NOT NULL DEFAULT 1,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT UQ_tblOrganizations_email UNIQUE (email)
      );
      
      -- Create indexes
      CREATE INDEX IX_tblOrganizations_name ON tblOrganizations(name);
      CREATE INDEX IX_tblOrganizations_is_active ON tblOrganizations(is_active);
    END
  `);
  console.log('✅ Organizations table created/verified');
}

/**
 * Create Credit Plans table
 */
async function createCreditPlansTable(pool) {
  console.log('\n💳 Creating Credit Plans table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblCreditPlans' AND xtype='U')
    BEGIN
      CREATE TABLE tblCreditPlans (
        id NVARCHAR(50) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NOT NULL,
        monthly_credits INT NOT NULL,
        price_usd DECIMAL(10,2) NOT NULL,
        is_popular BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        
        -- Features (stored as JSON-like structure for flexibility)
        ai_operators INT NOT NULL DEFAULT 1,
        concurrent_calls INT NOT NULL DEFAULT 5,
        campaigns_per_month INT NOT NULL DEFAULT 1,
        ai_messages INT NOT NULL DEFAULT 1000,
        team_members INT NOT NULL DEFAULT 1,
        extra_minute_cost DECIMAL(5,3) NOT NULL DEFAULT 0.15,
        
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblCreditPlans_monthly_credits CHECK (monthly_credits >= -1), -- -1 for unlimited
        CONSTRAINT CK_tblCreditPlans_price_usd CHECK (price_usd >= -1), -- -1 for custom pricing
        CONSTRAINT UQ_tblCreditPlans_name UNIQUE (name)
      );
      
      -- Create indexes
      CREATE INDEX IX_tblCreditPlans_is_active ON tblCreditPlans(is_active);
      CREATE INDEX IX_tblCreditPlans_price_usd ON tblCreditPlans(price_usd);
    END
  `);
  console.log('✅ Credit Plans table created/verified');
}

/**
 * Create Subscriptions table
 */
async function createSubscriptionsTable(pool) {
  console.log('\n📋 Creating Subscriptions table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblSubscriptions' AND xtype='U')
    BEGIN
      CREATE TABLE tblSubscriptions (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        organization_id NVARCHAR(50) NOT NULL,
        plan_id NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) NOT NULL DEFAULT 'active',
        current_period_start DATETIME2 NOT NULL,
        current_period_end DATETIME2 NOT NULL,
        cancel_at_period_end BIT NOT NULL DEFAULT 0,
        cancelled_at DATETIME2 NULL,
        trial_start DATETIME2 NULL,
        trial_end DATETIME2 NULL,
        
        -- Stripe/Payment gateway fields
        stripe_subscription_id NVARCHAR(255) NULL,
        stripe_customer_id NVARCHAR(255) NULL,
        
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblSubscriptions_status CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')),
        CONSTRAINT FK_tblSubscriptions_organization_id 
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT FK_tblSubscriptions_plan_id
          FOREIGN KEY (plan_id) REFERENCES tblCreditPlans(id) ON DELETE NO ACTION,
        -- Note: We'll enforce one active subscription per organization at the application level
      );
      
      -- Create indexes
      CREATE INDEX IX_tblSubscriptions_organization_id ON tblSubscriptions(organization_id);
      CREATE INDEX IX_tblSubscriptions_plan_id ON tblSubscriptions(plan_id);
      CREATE INDEX IX_tblSubscriptions_status ON tblSubscriptions(status);
      CREATE INDEX IX_tblSubscriptions_current_period_end ON tblSubscriptions(current_period_end);
      CREATE INDEX IX_tblSubscriptions_stripe_subscription_id ON tblSubscriptions(stripe_subscription_id);
    END
  `);
  console.log('✅ Subscriptions table created/verified');
}

/**
 * Create Credit Balances table
 */
async function createCreditBalancesTable(pool) {
  console.log('\n💰 Creating Credit Balances table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblCreditBalances' AND xtype='U')
    BEGIN
      CREATE TABLE tblCreditBalances (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        organization_id NVARCHAR(50) NOT NULL,
        current_balance INT NOT NULL DEFAULT 0,
        allocated_credits INT NOT NULL DEFAULT 0,
        used_credits INT NOT NULL DEFAULT 0,
        
        -- Monthly tracking
        monthly_allocation INT NOT NULL DEFAULT 0,
        monthly_used INT NOT NULL DEFAULT 0,
        allocation_reset_date DATETIME2 NOT NULL,
        
        last_updated DATETIME2 NOT NULL DEFAULT GETDATE(),
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblCreditBalances_current_balance CHECK (current_balance >= 0),
        CONSTRAINT CK_tblCreditBalances_allocated_credits CHECK (allocated_credits >= 0),
        CONSTRAINT CK_tblCreditBalances_used_credits CHECK (used_credits >= 0),
        CONSTRAINT FK_tblCreditBalances_user_id 
          FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_tblCreditBalances_organization_id 
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tblCreditBalances_user_id UNIQUE (user_id)
      );
      
      -- Create indexes
      CREATE INDEX IX_tblCreditBalances_organization_id ON tblCreditBalances(organization_id);
      CREATE INDEX IX_tblCreditBalances_current_balance ON tblCreditBalances(current_balance);
      CREATE INDEX IX_tblCreditBalances_allocation_reset_date ON tblCreditBalances(allocation_reset_date);
    END
  `);
  console.log('✅ Credit Balances table created/verified');
}

/**
 * Create Credit Transactions table
 */
async function createCreditTransactionsTable(pool) {
  console.log('\n📊 Creating Credit Transactions table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblCreditTransactions' AND xtype='U')
    BEGIN
      CREATE TABLE tblCreditTransactions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        transaction_id NVARCHAR(50) NOT NULL DEFAULT NEWID(),
        user_id INT NOT NULL,
        organization_id NVARCHAR(50) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        amount INT NOT NULL,
        balance_before INT NOT NULL,
        balance_after INT NOT NULL,
        
        -- Service-specific fields
        service_type NVARCHAR(50) NOT NULL,
        service_details NVARCHAR(MAX) NULL, -- JSON string with service-specific data
        
        -- Reference fields
        reference_id NVARCHAR(255) NULL, -- Reference to chat session, call, etc.
        reference_type NVARCHAR(50) NULL, -- 'chat_message', 'call_session', 'manual_allocation', etc.
        
        -- Admin/system fields
        created_by INT NULL, -- Admin user who created the transaction (for manual allocations)
        notes NVARCHAR(500) NULL,
        
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblCreditTransactions_type CHECK (type IN ('debit', 'credit', 'allocation', 'refund', 'adjustment')),
        CONSTRAINT CK_tblCreditTransactions_service_type CHECK (service_type IN ('chat', 'inbound_call', 'outbound_call', 'storage', 'transcription', 'ai_service', 'manual', 'system')),
        CONSTRAINT CK_tblCreditTransactions_amount CHECK (amount != 0),
        CONSTRAINT CK_tblCreditTransactions_balance_before CHECK (balance_before >= 0),
        CONSTRAINT CK_tblCreditTransactions_balance_after CHECK (balance_after >= 0),
        CONSTRAINT FK_tblCreditTransactions_user_id 
          FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE,
        CONSTRAINT FK_tblCreditTransactions_organization_id 
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT FK_tblCreditTransactions_created_by
          FOREIGN KEY (created_by) REFERENCES tblUsers(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_tblCreditTransactions_transaction_id UNIQUE (transaction_id)
      );
      
      -- Create indexes for performance
      CREATE INDEX IX_tblCreditTransactions_user_id ON tblCreditTransactions(user_id);
      CREATE INDEX IX_tblCreditTransactions_organization_id ON tblCreditTransactions(organization_id);
      CREATE INDEX IX_tblCreditTransactions_type ON tblCreditTransactions(type);
      CREATE INDEX IX_tblCreditTransactions_service_type ON tblCreditTransactions(service_type);
      CREATE INDEX IX_tblCreditTransactions_created_at ON tblCreditTransactions(created_at DESC);
      CREATE INDEX IX_tblCreditTransactions_reference ON tblCreditTransactions(reference_type, reference_id);
    END
  `);
  console.log('✅ Credit Transactions table created/verified');
}

/**
 * Create Payment Methods table
 */
async function createPaymentMethodsTable(pool) {
  console.log('\n💳 Creating Payment Methods table...');
  
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblPaymentMethods' AND xtype='U')
    BEGIN
      CREATE TABLE tblPaymentMethods (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        organization_id NVARCHAR(50) NOT NULL,
        type NVARCHAR(50) NOT NULL DEFAULT 'card',
        
        -- Card details (encrypted/tokenized)
        last_four NVARCHAR(4) NOT NULL,
        brand NVARCHAR(50) NOT NULL,
        exp_month INT NOT NULL,
        exp_year INT NOT NULL,
        
        -- Stripe/Payment gateway fields
        stripe_payment_method_id NVARCHAR(255) NULL,
        stripe_customer_id NVARCHAR(255) NULL,
        
        is_default BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        
        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        
        -- Constraints
        CONSTRAINT CK_tblPaymentMethods_type CHECK (type IN ('card', 'bank_account', 'paypal', 'other')),
        CONSTRAINT CK_tblPaymentMethods_exp_month CHECK (exp_month >= 1 AND exp_month <= 12),
        CONSTRAINT CK_tblPaymentMethods_exp_year CHECK (exp_year >= YEAR(GETDATE())),
        CONSTRAINT FK_tblPaymentMethods_organization_id 
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE CASCADE
      );
      
      -- Create indexes
      CREATE INDEX IX_tblPaymentMethods_organization_id ON tblPaymentMethods(organization_id);
      CREATE INDEX IX_tblPaymentMethods_is_default ON tblPaymentMethods(is_default);
      CREATE INDEX IX_tblPaymentMethods_stripe_payment_method_id ON tblPaymentMethods(stripe_payment_method_id);
    END
  `);
  console.log('✅ Payment Methods table created/verified');
}

/**
 * Create Billing History table
 */
async function createBillingHistoryTable(pool) {
  console.log('\n🧾 Creating Billing History table...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblBillingHistory' AND xtype='U')
    BEGIN
      CREATE TABLE tblBillingHistory (
        id NVARCHAR(50) PRIMARY KEY DEFAULT NEWID(),
        organization_id NVARCHAR(50) NOT NULL,
        subscription_id NVARCHAR(50) NOT NULL,

        -- Invoice details
        invoice_number NVARCHAR(100) NOT NULL,
        amount_usd DECIMAL(10,2) NOT NULL,
        tax_amount_usd DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_amount_usd DECIMAL(10,2) NOT NULL,

        -- Plan details at time of billing
        plan_name NVARCHAR(100) NOT NULL,
        plan_id NVARCHAR(50) NOT NULL,
        billing_period_start DATETIME2 NOT NULL,
        billing_period_end DATETIME2 NOT NULL,

        -- Payment details
        status NVARCHAR(50) NOT NULL DEFAULT 'pending',
        payment_method_id NVARCHAR(50) NULL,
        paid_at DATETIME2 NULL,

        -- Stripe/Payment gateway fields
        stripe_invoice_id NVARCHAR(255) NULL,
        stripe_payment_intent_id NVARCHAR(255) NULL,
        invoice_url NVARCHAR(500) NULL,

        -- Metadata
        line_items NVARCHAR(MAX) NULL, -- JSON string with detailed line items
        notes NVARCHAR(500) NULL,

        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),

        -- Constraints
        CONSTRAINT CK_tblBillingHistory_status CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
        CONSTRAINT CK_tblBillingHistory_amount_usd CHECK (amount_usd >= 0),
        CONSTRAINT CK_tblBillingHistory_tax_amount_usd CHECK (tax_amount_usd >= 0),
        CONSTRAINT CK_tblBillingHistory_total_amount_usd CHECK (total_amount_usd >= 0),
        CONSTRAINT FK_tblBillingHistory_organization_id
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE NO ACTION,
        CONSTRAINT FK_tblBillingHistory_subscription_id
          FOREIGN KEY (subscription_id) REFERENCES tblSubscriptions(id) ON DELETE NO ACTION,
        CONSTRAINT FK_tblBillingHistory_payment_method_id
          FOREIGN KEY (payment_method_id) REFERENCES tblPaymentMethods(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_tblBillingHistory_invoice_number UNIQUE (invoice_number)
      );

      -- Create indexes
      CREATE INDEX IX_tblBillingHistory_organization_id ON tblBillingHistory(organization_id);
      CREATE INDEX IX_tblBillingHistory_subscription_id ON tblBillingHistory(subscription_id);
      CREATE INDEX IX_tblBillingHistory_status ON tblBillingHistory(status);
      CREATE INDEX IX_tblBillingHistory_billing_period ON tblBillingHistory(billing_period_start, billing_period_end);
      CREATE INDEX IX_tblBillingHistory_created_at ON tblBillingHistory(created_at DESC);
      CREATE INDEX IX_tblBillingHistory_stripe_invoice_id ON tblBillingHistory(stripe_invoice_id);
    END
  `);
  console.log('✅ Billing History table created/verified');
}

/**
 * Create Usage Logs table
 */
async function createUsageLogsTable(pool) {
  console.log('\n📈 Creating Usage Logs table...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUsageLogs' AND xtype='U')
    BEGIN
      CREATE TABLE tblUsageLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        log_id NVARCHAR(50) NOT NULL DEFAULT NEWID(),
        user_id INT NOT NULL,
        organization_id NVARCHAR(50) NOT NULL,

        -- Service usage details
        service_type NVARCHAR(50) NOT NULL,
        usage_amount INT NOT NULL, -- Credits consumed
        usage_units NVARCHAR(50) NOT NULL, -- 'credits', 'seconds', 'messages', etc.

        -- Service-specific metadata
        service_metadata NVARCHAR(MAX) NULL, -- JSON string with service-specific data

        -- Reference to the actual service record
        reference_id NVARCHAR(255) NULL,
        reference_type NVARCHAR(50) NULL,

        -- Timing information
        usage_start_time DATETIME2 NULL,
        usage_end_time DATETIME2 NULL,
        duration_seconds INT NULL,

        -- Cost calculation
        credit_cost INT NOT NULL,
        rate_applied DECIMAL(10,4) NULL, -- Rate used for calculation (credits per unit)

        created_at DATETIME2 NOT NULL DEFAULT GETDATE(),

        -- Constraints
        CONSTRAINT CK_tblUsageLogs_service_type CHECK (service_type IN ('chat', 'inbound_call', 'outbound_call', 'storage', 'transcription', 'ai_service')),
        CONSTRAINT CK_tblUsageLogs_usage_amount CHECK (usage_amount > 0),
        CONSTRAINT CK_tblUsageLogs_credit_cost CHECK (credit_cost > 0),
        CONSTRAINT CK_tblUsageLogs_duration_seconds CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
        CONSTRAINT FK_tblUsageLogs_user_id
          FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE NO ACTION,
        CONSTRAINT FK_tblUsageLogs_organization_id
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE NO ACTION,
        CONSTRAINT UQ_tblUsageLogs_log_id UNIQUE (log_id)
      );

      -- Create indexes for performance and analytics
      CREATE INDEX IX_tblUsageLogs_user_id ON tblUsageLogs(user_id);
      CREATE INDEX IX_tblUsageLogs_organization_id ON tblUsageLogs(organization_id);
      CREATE INDEX IX_tblUsageLogs_service_type ON tblUsageLogs(service_type);
      CREATE INDEX IX_tblUsageLogs_created_at ON tblUsageLogs(created_at DESC);
      CREATE INDEX IX_tblUsageLogs_reference ON tblUsageLogs(reference_type, reference_id);
      -- Note: Date-based index would need to be a computed column for SQL Server
    END
  `);
  console.log('✅ Usage Logs table created/verified');
}

/**
 * Create update triggers for timestamp fields
 */
async function createUpdateTriggers(pool) {
  console.log('\n⚡ Creating update triggers...');

  // Organizations table trigger
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblOrganizations_updated_at')
    EXEC('
      CREATE TRIGGER TR_tblOrganizations_updated_at
      ON tblOrganizations
      AFTER UPDATE
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE tblOrganizations
        SET updated_at = GETDATE()
        FROM tblOrganizations o
        INNER JOIN inserted i ON o.id = i.id;
      END
    ');
  `);

  // Credit Plans table trigger
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblCreditPlans_updated_at')
    EXEC('
      CREATE TRIGGER TR_tblCreditPlans_updated_at
      ON tblCreditPlans
      AFTER UPDATE
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE tblCreditPlans
        SET updated_at = GETDATE()
        FROM tblCreditPlans cp
        INNER JOIN inserted i ON cp.id = i.id;
      END
    ');
  `);

  // Subscriptions table trigger
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblSubscriptions_updated_at')
    EXEC('
      CREATE TRIGGER TR_tblSubscriptions_updated_at
      ON tblSubscriptions
      AFTER UPDATE
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE tblSubscriptions
        SET updated_at = GETDATE()
        FROM tblSubscriptions s
        INNER JOIN inserted i ON s.id = i.id;
      END
    ');
  `);

  // Payment Methods table trigger
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblPaymentMethods_updated_at')
    EXEC('
      CREATE TRIGGER TR_tblPaymentMethods_updated_at
      ON tblPaymentMethods
      AFTER UPDATE
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE tblPaymentMethods
        SET updated_at = GETDATE()
        FROM tblPaymentMethods pm
        INNER JOIN inserted i ON pm.id = i.id;
      END
    ');
  `);

  // Billing History table trigger
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblBillingHistory_updated_at')
    EXEC('
      CREATE TRIGGER TR_tblBillingHistory_updated_at
      ON tblBillingHistory
      AFTER UPDATE
      AS
      BEGIN
        SET NOCOUNT ON;
        UPDATE tblBillingHistory
        SET updated_at = GETDATE()
        FROM tblBillingHistory bh
        INNER JOIN inserted i ON bh.id = i.id;
      END
    ');
  `);

  console.log('✅ Update triggers created/verified');
}

/**
 * Insert default credit plans
 */
async function insertDefaultCreditPlans(pool) {
  console.log('\n💎 Inserting default credit plans...');

  const defaultPlans = [
    {
      id: 'basic',
      name: 'Basic',
      description: '60 mins / month',
      monthly_credits: 3600, // 60 minutes * 60 seconds
      price_usd: 29,
      is_popular: 0,
      ai_operators: 1,
      concurrent_calls: 5,
      campaigns_per_month: 1,
      ai_messages: 1000,
      team_members: 1,
      extra_minute_cost: 0.15
    },
    {
      id: 'professional',
      name: 'Professional',
      description: '2,500 mins / month',
      monthly_credits: 150000, // 2500 minutes * 60 seconds
      price_usd: 399,
      is_popular: 1,
      ai_operators: 5,
      concurrent_calls: 20,
      campaigns_per_month: 10,
      ai_messages: 20000,
      team_members: 5,
      extra_minute_cost: 0.12
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: '6,000 mins / month',
      monthly_credits: 360000, // 6000 minutes * 60 seconds
      price_usd: 1999,
      is_popular: 0,
      ai_operators: 10,
      concurrent_calls: 50,
      campaigns_per_month: 50,
      ai_messages: 50000,
      team_members: 20,
      extra_minute_cost: 0.09
    },
    {
      id: 'ultimate',
      name: 'Ultimate',
      description: 'Unlimited usage',
      monthly_credits: -1, // Unlimited
      price_usd: -1, // Custom pricing
      is_popular: 0,
      ai_operators: -1,
      concurrent_calls: -1,
      campaigns_per_month: -1,
      ai_messages: -1,
      team_members: -1,
      extra_minute_cost: 0
    }
  ];

  for (const plan of defaultPlans) {
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM tblCreditPlans WHERE id = '${plan.id}')
      BEGIN
        INSERT INTO tblCreditPlans (
          id, name, description, monthly_credits, price_usd, is_popular,
          ai_operators, concurrent_calls, campaigns_per_month, ai_messages,
          team_members, extra_minute_cost
        ) VALUES (
          '${plan.id}', '${plan.name}', '${plan.description}', ${plan.monthly_credits},
          ${plan.price_usd}, ${plan.is_popular}, ${plan.ai_operators}, ${plan.concurrent_calls},
          ${plan.campaigns_per_month}, ${plan.ai_messages}, ${plan.team_members}, ${plan.extra_minute_cost}
        );
      END
    `);
  }

  console.log('✅ Default credit plans inserted/verified');
}

/**
 * Create default organization and update users table
 */
async function createDefaultOrganization(pool) {
  console.log('\n🏢 Creating default organization...');

  // Create default organization
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM tblOrganizations WHERE id = 'org_default_123')
    BEGIN
      INSERT INTO tblOrganizations (
        id, name, email, country, timezone
      ) VALUES (
        'org_default_123', 'Default Organization', 'admin@kimiya.ai', 'US', 'UTC'
      );
    END
  `);

  // Add organization_id column to tblUsers if it doesn't exist
  const columnCheck = await pool.request().query(`
    SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'tblUsers' AND COLUMN_NAME = 'organization_id'
  `);

  if (columnCheck.recordset[0].count === 0) {
    await pool.request().query(`
      ALTER TABLE tblUsers
      ADD organization_id NVARCHAR(50) NULL;
    `);

    // Add foreign key constraint
    await pool.request().query(`
      ALTER TABLE tblUsers
      ADD CONSTRAINT FK_tblUsers_organization_id
        FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE SET NULL;
    `);

    // Update existing users to have the default organization
    await pool.request().query(`
      UPDATE tblUsers
      SET organization_id = 'org_default_123'
      WHERE organization_id IS NULL;
    `);

    console.log('✅ Added organization_id to tblUsers and updated existing users');
  }

  console.log('✅ Default organization created/verified');
}

/**
 * Main function to create all credit system tables
 */
async function createCreditSystemTables() {
  console.log('🚀 Creating Credit System Database Schema...');
  console.log('Timestamp:', new Date().toISOString());

  try {
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');

    // Create all tables in dependency order
    await createOrganizationsTable(pool);
    await createCreditPlansTable(pool);
    await createSubscriptionsTable(pool);
    await createCreditBalancesTable(pool);
    await createCreditTransactionsTable(pool);
    await createPaymentMethodsTable(pool);
    await createBillingHistoryTable(pool);
    await createUsageLogsTable(pool);

    // Create webhook events table for idempotency
    await createWebhookEventsTable(pool);

    // Create triggers
    await createUpdateTriggers(pool);

    // Insert default data
    await insertDefaultCreditPlans(pool);
    await createDefaultOrganization(pool);

    console.log('\n📋 Verifying table creation...');
    const tableCheck = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN (
        'tblOrganizations', 'tblCreditPlans', 'tblSubscriptions',
        'tblCreditBalances', 'tblCreditTransactions', 'tblPaymentMethods',
        'tblBillingHistory', 'tblUsageLogs', 'tblWebhookEvents'
      )
      ORDER BY TABLE_NAME
    `);

    console.log('✅ Credit System Tables Created:');
    tableCheck.recordset.forEach(table => {
      console.log(`   📊 ${table.TABLE_NAME}`);
    });

    console.log('\n🎉 Credit System Database Schema created successfully!');
    console.log(`📊 Total tables created: ${tableCheck.recordset.length}`);

    await pool.close();

  } catch (error) {
    console.error('❌ Error creating credit system tables:', error);
    throw error;
  }
}

// CLI interface for running the script
if (require.main === module) {
  createCreditSystemTables()
    .then(() => {
      console.log('✅ Credit system database schema setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Credit system database schema setup failed:', error);
      process.exit(1);
    });
}

/**
 * Create Webhook Events table for idempotency
 */
async function createWebhookEventsTable(pool) {
  console.log('\n🔔 Creating Webhook Events table...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWebhookEvents' AND xtype='U')
    BEGIN
      CREATE TABLE tblWebhookEvents (
        id INT IDENTITY(1,1) PRIMARY KEY,
        event_id NVARCHAR(100) NOT NULL UNIQUE,
        event_type NVARCHAR(50) NOT NULL,
        organization_id NVARCHAR(50) NOT NULL,
        processed_at DATETIME2 NOT NULL DEFAULT GETDATE(),

        CONSTRAINT FK_tblWebhookEvents_organization_id
          FOREIGN KEY (organization_id) REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tblWebhookEvents_event_id UNIQUE (event_id)
      );

      CREATE INDEX IX_tblWebhookEvents_event_id ON tblWebhookEvents(event_id);
      CREATE INDEX IX_tblWebhookEvents_organization_id ON tblWebhookEvents(organization_id);
      CREATE INDEX IX_tblWebhookEvents_processed_at ON tblWebhookEvents(processed_at DESC);

      PRINT '✅ Webhook Events table created successfully';
    END
    ELSE
    BEGIN
      PRINT '⚠️  Webhook Events table already exists';
    END
  `);
}

module.exports = {
  createCreditSystemTables,
  createOrganizationsTable,
  createCreditPlansTable,
  createSubscriptionsTable,
  createCreditBalancesTable,
  createCreditTransactionsTable,
  createPaymentMethodsTable,
  createBillingHistoryTable,
  createUsageLogsTable,
  createWebhookEventsTable,
  createUpdateTriggers,
  insertDefaultCreditPlans,
  createDefaultOrganization
};
