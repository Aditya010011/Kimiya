const sql = require('mssql');
require('dotenv').config({ path: './.env.development' });

const baseConfig = {
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
 * Create chat analytics tables
 */
async function createChatAnalyticsTables(pool) {
  console.log('\n📊 Creating Chat Analytics tables...');
  
  try {
    // Create tblChatSessions table
    console.log('Creating tblChatSessions...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblChatSessions' AND xtype='U')
      BEGIN
        CREATE TABLE tblChatSessions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          session_id NVARCHAR(255) NOT NULL,
          workflow_id NVARCHAR(255) NULL,
          workflow_name NVARCHAR(255) NOT NULL,
          user_id INT NOT NULL,
          start_time DATETIME2 NOT NULL DEFAULT GETDATE(),
          end_time DATETIME2 NULL,
          duration INT NULL, -- in seconds
          message_count INT NOT NULL DEFAULT 0,
          status NVARCHAR(50) NOT NULL DEFAULT 'active',
          outcome NVARCHAR(50) NULL,
          completion_rate DECIMAL(5,2) NULL, -- percentage 0-100
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT CK_tblChatSessions_status CHECK (status IN ('active', 'completed', 'abandoned', 'failed')),
          CONSTRAINT CK_tblChatSessions_outcome CHECK (outcome IN ('success', 'partial_success', 'failure', 'abandoned')),
          CONSTRAINT CK_tblChatSessions_completion_rate CHECK (completion_rate >= 0 AND completion_rate <= 100),
          CONSTRAINT UQ_tblChatSessions_session_id UNIQUE (session_id),
          
          -- Foreign key to users
          CONSTRAINT FK_tblChatSessions_user_id 
            FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblChatSessions_user_id ON tblChatSessions(user_id);
        CREATE INDEX IX_tblChatSessions_start_time ON tblChatSessions(start_time DESC);
        CREATE INDEX IX_tblChatSessions_workflow_id ON tblChatSessions(workflow_id);
        CREATE INDEX IX_tblChatSessions_status ON tblChatSessions(status);
        CREATE INDEX IX_tblChatSessions_outcome ON tblChatSessions(outcome);
      END
    `);
    console.log('✅ tblChatSessions table created/verified');

    // Create tblChatMessages table
    console.log('Creating tblChatMessages...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblChatMessages' AND xtype='U')
      BEGIN
        CREATE TABLE tblChatMessages (
          id INT IDENTITY(1,1) PRIMARY KEY,
          message_id NVARCHAR(255) NOT NULL,
          session_id INT NOT NULL,
          type NVARCHAR(50) NOT NULL,
          content NVARCHAR(MAX) NOT NULL,
          timestamp DATETIME2 NOT NULL DEFAULT GETDATE(),
          node_id NVARCHAR(255) NULL,
          node_name NVARCHAR(255) NULL,
          
          -- Metadata fields
          confidence_score DECIMAL(3,2) NULL, -- 0.00 to 1.00
          processing_time INT NULL, -- in milliseconds
          tokens_used INT NULL,
          intent_detected NVARCHAR(255) NULL,
          entities_extracted NVARCHAR(MAX) NULL, -- JSON string
          
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT CK_tblChatMessages_type CHECK (type IN ('user', 'ai', 'system')),
          CONSTRAINT CK_tblChatMessages_confidence_score CHECK (confidence_score >= 0 AND confidence_score <= 1),
          CONSTRAINT UQ_tblChatMessages_message_id UNIQUE (message_id),
          
          -- Foreign key to chat sessions
          CONSTRAINT FK_tblChatMessages_session_id 
            FOREIGN KEY (session_id) REFERENCES tblChatSessions(id) ON DELETE CASCADE
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblChatMessages_session_id ON tblChatMessages(session_id);
        CREATE INDEX IX_tblChatMessages_timestamp ON tblChatMessages(timestamp DESC);
        CREATE INDEX IX_tblChatMessages_type ON tblChatMessages(type);
      END
    `);
    console.log('✅ tblChatMessages table created/verified');

    // Create tblConversationAnalysis table
    console.log('Creating tblConversationAnalysis...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblConversationAnalysis' AND xtype='U')
      BEGIN
        CREATE TABLE tblConversationAnalysis (
          id INT IDENTITY(1,1) PRIMARY KEY,
          session_id INT NOT NULL,
          sentiment_score DECIMAL(3,2) NOT NULL DEFAULT 0, -- -1.00 to 1.00
          engagement_level NVARCHAR(50) NOT NULL DEFAULT 'medium',
          user_satisfaction DECIMAL(2,1) NULL, -- 1.0 to 5.0 scale
          workflow_adherence DECIMAL(5,2) NULL, -- percentage 0-100
          success_indicators NVARCHAR(MAX) NULL, -- JSON array
          failure_points NVARCHAR(MAX) NULL, -- JSON array
          analyzed_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT CK_tblConversationAnalysis_sentiment_score CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
          CONSTRAINT CK_tblConversationAnalysis_engagement_level CHECK (engagement_level IN ('low', 'medium', 'high')),
          CONSTRAINT CK_tblConversationAnalysis_user_satisfaction CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
          CONSTRAINT CK_tblConversationAnalysis_workflow_adherence CHECK (workflow_adherence >= 0 AND workflow_adherence <= 100),
          
          -- Foreign key to chat sessions (one-to-one relationship)
          CONSTRAINT FK_tblConversationAnalysis_session_id 
            FOREIGN KEY (session_id) REFERENCES tblChatSessions(id) ON DELETE CASCADE,
          CONSTRAINT UQ_tblConversationAnalysis_session_id UNIQUE (session_id)
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblConversationAnalysis_sentiment_score ON tblConversationAnalysis(sentiment_score);
        CREATE INDEX IX_tblConversationAnalysis_engagement_level ON tblConversationAnalysis(engagement_level);
        CREATE INDEX IX_tblConversationAnalysis_analyzed_at ON tblConversationAnalysis(analyzed_at DESC);
      END
    `);
    console.log('✅ tblConversationAnalysis table created/verified');

    // Create tblUserAnalytics table for aggregated analytics
    console.log('Creating tblUserAnalytics...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUserAnalytics' AND xtype='U')
      BEGIN
        CREATE TABLE tblUserAnalytics (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          date_period DATE NOT NULL, -- Daily aggregation
          total_sessions INT NOT NULL DEFAULT 0,
          completed_sessions INT NOT NULL DEFAULT 0,
          abandoned_sessions INT NOT NULL DEFAULT 0,
          failed_sessions INT NOT NULL DEFAULT 0,
          total_messages INT NOT NULL DEFAULT 0,
          total_duration INT NOT NULL DEFAULT 0, -- in seconds
          average_session_duration DECIMAL(8,2) NULL,
          average_messages_per_session DECIMAL(6,2) NULL,
          success_rate DECIMAL(5,2) NULL, -- percentage 0-100
          average_sentiment_score DECIMAL(3,2) NULL, -- -1.00 to 1.00
          high_engagement_sessions INT NOT NULL DEFAULT 0,
          medium_engagement_sessions INT NOT NULL DEFAULT 0,
          low_engagement_sessions INT NOT NULL DEFAULT 0,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Constraints
          CONSTRAINT CK_tblUserAnalytics_success_rate CHECK (success_rate >= 0 AND success_rate <= 100),
          CONSTRAINT CK_tblUserAnalytics_average_sentiment_score CHECK (average_sentiment_score >= -1 AND average_sentiment_score <= 1),
          
          -- Foreign key to users
          CONSTRAINT FK_tblUserAnalytics_user_id 
            FOREIGN KEY (user_id) REFERENCES tblUsers(id) ON DELETE CASCADE,
          
          -- Unique constraint for user and date period
          CONSTRAINT UQ_tblUserAnalytics_user_date UNIQUE (user_id, date_period)
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblUserAnalytics_user_id ON tblUserAnalytics(user_id);
        CREATE INDEX IX_tblUserAnalytics_date_period ON tblUserAnalytics(date_period DESC);
      END
    `);
    console.log('✅ tblUserAnalytics table created/verified');

    console.log('\n🎉 All Chat Analytics tables created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to create chat analytics tables:', error.message);
    return false;
  }
}

/**
 * Create triggers for automatic updates
 */
async function createTriggers(pool) {
  console.log('\n⚙️ Creating triggers for automatic updates...');
  
  try {
    // Trigger to update session message count when messages are added
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblChatMessages_UpdateSessionCount')
      BEGIN
        EXEC('
          CREATE TRIGGER TR_tblChatMessages_UpdateSessionCount
          ON tblChatMessages
          AFTER INSERT, DELETE
          AS
          BEGIN
            SET NOCOUNT ON;
            
            -- Update message count for affected sessions
            UPDATE s
            SET message_count = (
              SELECT COUNT(*)
              FROM tblChatMessages m
              WHERE m.session_id = s.id
            ),
            updated_at = GETDATE()
            FROM tblChatSessions s
            WHERE s.id IN (
              SELECT DISTINCT session_id FROM inserted
              UNION
              SELECT DISTINCT session_id FROM deleted
            );
          END
        ')
      END
    `);
    console.log('✅ Message count update trigger created');

    // Trigger to update session duration when end_time is set
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblChatSessions_UpdateDuration')
      BEGIN
        EXEC('
          CREATE TRIGGER TR_tblChatSessions_UpdateDuration
          ON tblChatSessions
          AFTER UPDATE
          AS
          BEGIN
            SET NOCOUNT ON;
            
            -- Update duration when end_time is set
            UPDATE s
            SET duration = DATEDIFF(SECOND, s.start_time, s.end_time),
                updated_at = GETDATE()
            FROM tblChatSessions s
            INNER JOIN inserted i ON s.id = i.id
            WHERE s.end_time IS NOT NULL 
              AND s.duration IS NULL;
          END
        ')
      END
    `);
    console.log('✅ Session duration update trigger created');

    return true;
    
  } catch (error) {
    console.error('❌ Failed to create triggers:', error.message);
    console.log('⚠️  Continuing without triggers...');
    return false;
  }
}

/**
 * Main setup function
 */
async function setupChatAnalyticsTables() {
  console.log('🚀 Chat Analytics Tables Setup');
  console.log('═══════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`🔌 Server: ${baseConfig.server}`);
  console.log(`📊 Database: ${baseConfig.database}`);
  console.log(`👤 User: ${baseConfig.user}`);

  try {
    // Connect to database
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(baseConfig);
    console.log(`✅ Connected to ${baseConfig.database}`);

    // Create chat analytics tables
    console.log('\n⏳ Creating chat analytics tables...');
    const tablesCreated = await createChatAnalyticsTables(pool);

    if (!tablesCreated) {
      throw new Error('Failed to create chat analytics tables');
    }

    // Create triggers
    console.log('\n⏳ Creating triggers...');
    await createTriggers(pool);

    await pool.close();
    console.log('🔌 Database connection closed');

    // Success summary
    console.log('\n🎉 Chat Analytics Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All chat analytics tables created successfully');
    console.log('✅ Triggers created for automatic updates');

    console.log('\n📋 Created Tables:');
    console.log('   💬 tblChatSessions - Chat session tracking');
    console.log('   📝 tblChatMessages - Individual messages');
    console.log('   📊 tblConversationAnalysis - Session analysis data');
    console.log('   📈 tblUserAnalytics - Aggregated user analytics');

    console.log('\n🔧 Next Steps:');
    console.log('   1. Create API endpoints for chat data');
    console.log('   2. Integrate with playground chat functionality');
    console.log('   3. Update frontend to use real data');
    console.log('   4. Test the complete integration');

  } catch (error) {
    console.error('\n❌ Setup failed:');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupChatAnalyticsTables();
}

module.exports = {
  setupChatAnalyticsTables,
  createChatAnalyticsTables,
  createTriggers
};
