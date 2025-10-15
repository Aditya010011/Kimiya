/**
 * Create Inbound Call Tables for Kimiya Voice AI
 * 
 * This script creates database tables specifically for inbound call handling,
 * separate from the existing outbound call infrastructure.
 */

const sql = require('mssql');
const path = require('path');

// Load environment configuration
const envFile = process.env.NODE_ENV === "production"
  ? ""
  : path.join(__dirname, ".env.development");

if (envFile) {
  require("dotenv").config({ path: envFile });
}
// Always load .env file first, then environment variables can override
require('dotenv').config();

async function createInboundCallTables() {
  console.log('🎯 Creating Inbound Call Tables for Kimiya Voice AI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let pool;
  
  try {
    // Database configuration
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
        requestTimeout: 30000,
        connectionTimeout: 30000,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Database connected successfully');

    // 1. Create tblInboundCalls table
    console.log('\n📞 Creating tblInboundCalls table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblInboundCalls' AND xtype='U')
      BEGIN
        CREATE TABLE tblInboundCalls (
          id INT IDENTITY(1,1) PRIMARY KEY,
          call_sid NVARCHAR(255) NOT NULL,
          from_number NVARCHAR(50) NOT NULL,
          to_number NVARCHAR(50) NOT NULL,
          workflow_id NVARCHAR(255) NULL,
          workflow_name NVARCHAR(255) NULL,
          call_status NVARCHAR(50) NOT NULL DEFAULT 'initiated',
          call_direction NVARCHAR(20) NOT NULL DEFAULT 'inbound',
          start_time DATETIME2 NOT NULL DEFAULT GETDATE(),
          answer_time DATETIME2 NULL,
          end_time DATETIME2 NULL,
          duration INT NULL, -- in seconds
          recording_url NVARCHAR(500) NULL,
          recording_duration INT NULL, -- in seconds
          caller_city NVARCHAR(100) NULL,
          caller_state NVARCHAR(50) NULL,
          caller_country NVARCHAR(50) NULL,
          caller_zip NVARCHAR(20) NULL,
          forwarded_from NVARCHAR(50) NULL,
          caller_name NVARCHAR(255) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT UQ_tblInboundCalls_call_sid UNIQUE (call_sid),
          
          -- Indexes for performance
          INDEX IX_InboundCalls_CallSid (call_sid),
          INDEX IX_InboundCalls_FromNumber (from_number),
          INDEX IX_InboundCalls_ToNumber (to_number),
          INDEX IX_InboundCalls_WorkflowId (workflow_id),
          INDEX IX_InboundCalls_CallStatus (call_status),
          INDEX IX_InboundCalls_StartTime (start_time)
        );
        PRINT '✅ tblInboundCalls table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblInboundCalls table already exists';
      END
    `);

    // 2. Create tblInboundCallSteps table for tracking conversation flow
    console.log('\n🔄 Creating tblInboundCallSteps table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblInboundCallSteps' AND xtype='U')
      BEGIN
        CREATE TABLE tblInboundCallSteps (
          id INT IDENTITY(1,1) PRIMARY KEY,
          call_id INT NOT NULL,
          call_sid NVARCHAR(255) NOT NULL,
          step_number INT NOT NULL,
          step_type NVARCHAR(50) NOT NULL, -- 'gather', 'say', 'play', 'record', 'redirect'
          step_action NVARCHAR(100) NULL, -- specific action taken
          user_input NVARCHAR(MAX) NULL, -- what user said/pressed
          ai_response NVARCHAR(MAX) NULL, -- what AI responded
          node_id NVARCHAR(255) NULL, -- workflow node if applicable
          node_name NVARCHAR(255) NULL,
          processing_time INT NULL, -- in milliseconds
          confidence_score DECIMAL(3,2) NULL, -- 0.00 to 1.00
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_InboundCallSteps_CallId 
            FOREIGN KEY (call_id) REFERENCES tblInboundCalls(id) ON DELETE CASCADE,
          
          -- Indexes for performance
          INDEX IX_InboundCallSteps_CallId (call_id),
          INDEX IX_InboundCallSteps_CallSid (call_sid),
          INDEX IX_InboundCallSteps_StepNumber (step_number),
          INDEX IX_InboundCallSteps_StepType (step_type)
        );
        PRINT '✅ tblInboundCallSteps table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblInboundCallSteps table already exists';
      END
    `);

    // 3. Create tblInboundCallAnalytics table
    console.log('\n📊 Creating tblInboundCallAnalytics table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblInboundCallAnalytics' AND xtype='U')
      BEGIN
        CREATE TABLE tblInboundCallAnalytics (
          id INT IDENTITY(1,1) PRIMARY KEY,
          call_id INT NOT NULL,
          call_sid NVARCHAR(255) NOT NULL,
          total_steps INT NOT NULL DEFAULT 0,
          completion_rate DECIMAL(5,2) NULL, -- percentage 0-100
          sentiment_score DECIMAL(3,2) NULL, -- -1.00 to 1.00
          engagement_level NVARCHAR(50) NULL, -- 'high', 'medium', 'low'
          success_indicators NVARCHAR(MAX) NULL, -- JSON array
          failure_points NVARCHAR(MAX) NULL, -- JSON array
          call_outcome NVARCHAR(100) NULL, -- 'completed', 'abandoned', 'transferred', 'failed'
          customer_satisfaction DECIMAL(2,1) NULL, -- 1.0 to 5.0 scale
          agent_performance DECIMAL(2,1) NULL, -- 1.0 to 5.0 scale
          key_topics NVARCHAR(MAX) NULL, -- JSON array of detected topics
          action_items NVARCHAR(MAX) NULL, -- JSON array of follow-up actions
          analyzed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_InboundCallAnalytics_CallId 
            FOREIGN KEY (call_id) REFERENCES tblInboundCalls(id) ON DELETE CASCADE,
          
          -- Constraints
          CONSTRAINT CK_InboundCallAnalytics_completion_rate 
            CHECK (completion_rate >= 0 AND completion_rate <= 100),
          CONSTRAINT CK_InboundCallAnalytics_sentiment_score 
            CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
          CONSTRAINT CK_InboundCallAnalytics_customer_satisfaction 
            CHECK (customer_satisfaction >= 1 AND customer_satisfaction <= 5),
          CONSTRAINT CK_InboundCallAnalytics_agent_performance 
            CHECK (agent_performance >= 1 AND agent_performance <= 5),
          
          -- Indexes for performance
          INDEX IX_InboundCallAnalytics_CallId (call_id),
          INDEX IX_InboundCallAnalytics_CallSid (call_sid),
          INDEX IX_InboundCallAnalytics_CallOutcome (call_outcome),
          INDEX IX_InboundCallAnalytics_AnalyzedAt (analyzed_at)
        );
        PRINT '✅ tblInboundCallAnalytics table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblInboundCallAnalytics table already exists';
      END
    `);

    // 4. Create tblWebCallSessions table for web-based test calls
    console.log('\n🌐 Creating tblWebCallSessions table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWebCallSessions' AND xtype='U')
      BEGIN
        CREATE TABLE tblWebCallSessions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          session_id NVARCHAR(255) NOT NULL,
          user_id INT NULL,
          workflow_id NVARCHAR(255) NULL,
          workflow_name NVARCHAR(255) NULL,
          test_scenario NVARCHAR(255) NULL,
          call_sid NVARCHAR(255) NULL, -- Twilio call SID when connected
          session_status NVARCHAR(50) NOT NULL DEFAULT 'initiated',
          start_time DATETIME2 NOT NULL DEFAULT GETDATE(),
          end_time DATETIME2 NULL,
          duration INT NULL, -- in seconds
          browser_info NVARCHAR(MAX) NULL, -- JSON with browser details
          ip_address NVARCHAR(45) NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT UQ_tblWebCallSessions_session_id UNIQUE (session_id),
          
          -- Foreign key to users (optional)
          CONSTRAINT FK_WebCallSessions_UserId 
            FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE SET NULL,
          
          -- Indexes for performance
          INDEX IX_WebCallSessions_SessionId (session_id),
          INDEX IX_WebCallSessions_UserId (user_id),
          INDEX IX_WebCallSessions_WorkflowId (workflow_id),
          INDEX IX_WebCallSessions_SessionStatus (session_status),
          INDEX IX_WebCallSessions_StartTime (start_time)
        );
        PRINT '✅ tblWebCallSessions table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblWebCallSessions table already exists';
      END
    `);

    console.log('\n🎉 All inbound call tables created successfully!');
    console.log('\n📊 Table Summary:');
    console.log('  • tblInboundCalls - Main inbound call tracking');
    console.log('  • tblInboundCallSteps - Conversation flow tracking');
    console.log('  • tblInboundCallAnalytics - Call analysis and metrics');
    console.log('  • tblWebCallSessions - Web-based test call sessions');

  } catch (error) {
    console.error('❌ Error creating inbound call tables:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  createInboundCallTables()
    .then(() => {
      console.log('\n✅ Inbound call tables setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createInboundCallTables };
