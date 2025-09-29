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
    requestTimeout: 30000,
    connectionTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function createContactsTables() {
  let pool;
  
  try {
    console.log('\n⏳ Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    // Create tblContactGroups table first (referenced by tblContacts)
    console.log('\n📁 Creating tblContactGroups table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblContactGroups' AND xtype='U')
      BEGIN
        CREATE TABLE tblContactGroups (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX) NULL,
          color NVARCHAR(7) NULL, -- Hex color code
          created_by INT NOT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign key to users
          CONSTRAINT FK_tblContactGroups_created_by
            FOREIGN KEY (created_by) REFERENCES tblUsers(id) ON DELETE NO ACTION,
          
          -- Unique constraint for group name per user
          CONSTRAINT UQ_tblContactGroups_name_user UNIQUE (name, created_by)
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblContactGroups_created_by ON tblContactGroups(created_by);
        CREATE INDEX IX_tblContactGroups_name ON tblContactGroups(name);
      END
    `);
    console.log('✅ tblContactGroups table created successfully!');

    // Create tblContacts table
    console.log('\n👤 Creating tblContacts table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblContacts' AND xtype='U')
      BEGIN
        CREATE TABLE tblContacts (
          id INT IDENTITY(1,1) PRIMARY KEY,
          first_name NVARCHAR(100) NOT NULL,
          last_name NVARCHAR(100) NULL,
          email NVARCHAR(255) NULL,
          phone NVARCHAR(20) NULL,
          company NVARCHAR(255) NULL,
          job_title NVARCHAR(255) NULL,
          address NVARCHAR(MAX) NULL,
          notes NVARCHAR(MAX) NULL,
          group_id INT NULL,
          is_favorite BIT NOT NULL DEFAULT 0,
          is_active BIT NOT NULL DEFAULT 1,
          created_by INT NOT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          last_contacted_at DATETIME2 NULL,
          
          -- Foreign keys
          CONSTRAINT FK_tblContacts_created_by
            FOREIGN KEY (created_by) REFERENCES tblUsers(id) ON DELETE NO ACTION,
          CONSTRAINT FK_tblContacts_group_id
            FOREIGN KEY (group_id) REFERENCES tblContactGroups(id) ON DELETE SET NULL
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblContacts_created_by ON tblContacts(created_by);
        CREATE INDEX IX_tblContacts_group_id ON tblContacts(group_id);
        CREATE INDEX IX_tblContacts_email ON tblContacts(email);
        CREATE INDEX IX_tblContacts_phone ON tblContacts(phone);
        CREATE INDEX IX_tblContacts_name ON tblContacts(first_name, last_name);
        CREATE INDEX IX_tblContacts_is_favorite ON tblContacts(is_favorite);
        CREATE INDEX IX_tblContacts_is_active ON tblContacts(is_active);
        

      END
    `);
    console.log('✅ tblContacts table created successfully!');

    // Create tblContactTags table
    console.log('\n🏷️ Creating tblContactTags table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblContactTags' AND xtype='U')
      BEGIN
        CREATE TABLE tblContactTags (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(100) NOT NULL,
          color NVARCHAR(7) NULL, -- Hex color code
          created_by INT NOT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign key to users
          CONSTRAINT FK_tblContactTags_created_by
            FOREIGN KEY (created_by) REFERENCES tblUsers(id) ON DELETE NO ACTION,
          
          -- Unique constraint for tag name per user
          CONSTRAINT UQ_tblContactTags_name_user UNIQUE (name, created_by)
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblContactTags_created_by ON tblContactTags(created_by);
        CREATE INDEX IX_tblContactTags_name ON tblContactTags(name);
      END
    `);
    console.log('✅ tblContactTags table created successfully!');

    // Create tblContactTagAssignments junction table
    console.log('\n🔗 Creating tblContactTagAssignments table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblContactTagAssignments' AND xtype='U')
      BEGIN
        CREATE TABLE tblContactTagAssignments (
          id INT IDENTITY(1,1) PRIMARY KEY,
          contact_id INT NOT NULL,
          tag_id INT NOT NULL,
          assigned_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign keys
          CONSTRAINT FK_tblContactTagAssignments_contact_id 
            FOREIGN KEY (contact_id) REFERENCES tblContacts(id) ON DELETE CASCADE,
          CONSTRAINT FK_tblContactTagAssignments_tag_id 
            FOREIGN KEY (tag_id) REFERENCES tblContactTags(id) ON DELETE CASCADE,
          
          -- Unique constraint to prevent duplicate assignments
          CONSTRAINT UQ_tblContactTagAssignments_contact_tag UNIQUE (contact_id, tag_id)
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblContactTagAssignments_contact_id ON tblContactTagAssignments(contact_id);
        CREATE INDEX IX_tblContactTagAssignments_tag_id ON tblContactTagAssignments(tag_id);
      END
    `);
    console.log('✅ tblContactTagAssignments table created successfully!');

    // Create tblContactInteractions table for tracking communication history
    console.log('\n📞 Creating tblContactInteractions table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblContactInteractions' AND xtype='U')
      BEGIN
        CREATE TABLE tblContactInteractions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          contact_id INT NOT NULL,
          interaction_type NVARCHAR(50) NOT NULL, -- 'call', 'email', 'meeting', 'note'
          direction NVARCHAR(20) NULL, -- 'inbound', 'outbound' for calls/emails
          subject NVARCHAR(255) NULL,
          content NVARCHAR(MAX) NULL,
          duration INT NULL, -- in seconds for calls
          outcome NVARCHAR(100) NULL,
          created_by INT NOT NULL,
          created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
          
          -- Foreign keys
          CONSTRAINT FK_tblContactInteractions_contact_id
            FOREIGN KEY (contact_id) REFERENCES tblContacts(id) ON DELETE CASCADE,
          CONSTRAINT FK_tblContactInteractions_created_by
            FOREIGN KEY (created_by) REFERENCES tblUsers(id) ON DELETE NO ACTION,
          
          -- Check constraint for interaction_type
          CONSTRAINT CK_tblContactInteractions_type 
            CHECK (interaction_type IN ('call', 'email', 'meeting', 'note', 'sms')),
          
          -- Check constraint for direction
          CONSTRAINT CK_tblContactInteractions_direction 
            CHECK (direction IS NULL OR direction IN ('inbound', 'outbound'))
        );
        
        -- Create indexes for performance
        CREATE INDEX IX_tblContactInteractions_contact_id ON tblContactInteractions(contact_id);
        CREATE INDEX IX_tblContactInteractions_created_by ON tblContactInteractions(created_by);
        CREATE INDEX IX_tblContactInteractions_type ON tblContactInteractions(interaction_type);
        CREATE INDEX IX_tblContactInteractions_created_at ON tblContactInteractions(created_at);
      END
    `);
    console.log('✅ tblContactInteractions table created successfully!');

    console.log('\n🎉 All contacts tables created successfully!');
    console.log('\n📋 Created Tables:');
    console.log('   📁 tblContactGroups - Contact groups/categories');
    console.log('   👤 tblContacts - Main contacts table');
    console.log('   🏷️ tblContactTags - Contact tags');
    console.log('   🔗 tblContactTagAssignments - Contact-tag relationships');
    console.log('   📞 tblContactInteractions - Communication history');

  } catch (error) {
    console.error('\n❌ Error creating contacts tables:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the function if this file is executed directly
if (require.main === module) {
  createContactsTables()
    .then(() => {
      console.log('\n✅ Contacts tables setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed to setup contacts tables:', error);
      process.exit(1);
    });
}

module.exports = { createContactsTables };
