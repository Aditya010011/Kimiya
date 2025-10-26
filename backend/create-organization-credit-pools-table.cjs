#!/usr/bin/env node

/**
 * Create Organization Credit Pools Table
 * Implements organization-level credit pooling for shared credit management
 */

const sql = require('mssql');
require('dotenv').config();

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

async function createOrganizationCreditPoolsTable() {
  console.log('🔌 Creating organization credit pools table...');
  
  try {
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    console.log('\n🏗️  Creating tblOrganizationCreditPools table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblOrganizationCreditPools' AND xtype='U')
      CREATE TABLE tblOrganizationCreditPools (
        id INT IDENTITY(1,1) PRIMARY KEY,
        organization_id NVARCHAR(50) NOT NULL,
        total_credits INT NOT NULL DEFAULT 0,
        used_credits INT NOT NULL DEFAULT 0,
        available_credits INT NOT NULL DEFAULT 0,
        monthly_allocation INT NOT NULL DEFAULT 0,
        monthly_used INT NOT NULL DEFAULT 0,
        allocation_reset_date DATETIME2 NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_tblOrganizationCreditPools_org FOREIGN KEY (organization_id) 
          REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT UQ_tblOrganizationCreditPools_org UNIQUE (organization_id)
      );
    `);
    console.log('✅ tblOrganizationCreditPools table created successfully!');
    
    console.log('\n📊 Creating indexes...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblOrganizationCreditPools_org_id')
      CREATE INDEX IX_tblOrganizationCreditPools_org_id ON tblOrganizationCreditPools(organization_id);
    `);
    console.log('✅ Indexes created successfully!');
    
    console.log('\n🏗️  Creating tblCreditPoolTransfers table for tracking transfers...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblCreditPoolTransfers' AND xtype='U')
      CREATE TABLE tblCreditPoolTransfers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        organization_id NVARCHAR(50) NOT NULL,
        from_user_id INT NOT NULL,
        to_user_id INT NOT NULL,
        amount INT NOT NULL,
        reason NVARCHAR(500),
        approved_by INT,
        status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_tblCreditPoolTransfers_org FOREIGN KEY (organization_id) 
          REFERENCES tblOrganizations(id) ON DELETE CASCADE,
        CONSTRAINT FK_tblCreditPoolTransfers_from_user FOREIGN KEY (from_user_id) 
          REFERENCES tblUsers(id),
        CONSTRAINT FK_tblCreditPoolTransfers_to_user FOREIGN KEY (to_user_id) 
          REFERENCES tblUsers(id),
        CONSTRAINT FK_tblCreditPoolTransfers_approved_by FOREIGN KEY (approved_by) 
          REFERENCES tblUsers(id)
      );
    `);
    console.log('✅ tblCreditPoolTransfers table created successfully!');
    
    console.log('\n📊 Creating indexes for transfers table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblCreditPoolTransfers_org_id')
      CREATE INDEX IX_tblCreditPoolTransfers_org_id ON tblCreditPoolTransfers(organization_id);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblCreditPoolTransfers_from_user')
      CREATE INDEX IX_tblCreditPoolTransfers_from_user ON tblCreditPoolTransfers(from_user_id);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblCreditPoolTransfers_to_user')
      CREATE INDEX IX_tblCreditPoolTransfers_to_user ON tblCreditPoolTransfers(to_user_id);
      
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblCreditPoolTransfers_status')
      CREATE INDEX IX_tblCreditPoolTransfers_status ON tblCreditPoolTransfers(status);
    `);
    console.log('✅ Transfer table indexes created successfully!');
    
    console.log('\n⚡ Creating update trigger for tblOrganizationCreditPools...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblOrganizationCreditPools_updated_at')
      EXEC('
        CREATE TRIGGER TR_tblOrganizationCreditPools_updated_at
        ON tblOrganizationCreditPools
        AFTER UPDATE
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE tblOrganizationCreditPools
          SET updated_at = GETDATE()
          FROM tblOrganizationCreditPools ocp
          INNER JOIN inserted i ON ocp.id = i.id;
        END
      ');
    `);
    console.log('✅ Update trigger created successfully!');
    
    console.log('\n📋 Verifying table structure...');
    const tableInfo = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblOrganizationCreditPools'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('✅ Organization Credit Pools table structure:');
    tableInfo.recordset.forEach(column => {
      const nullable = column.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = column.COLUMN_DEFAULT ? ` DEFAULT ${column.COLUMN_DEFAULT}` : '';
      console.log(`   ${column.COLUMN_NAME}: ${column.DATA_TYPE} ${nullable}${defaultVal}`);
    });
    
    console.log('\n✅ Organization credit pooling tables created successfully!');
    console.log('\n📝 Summary:');
    console.log('   - tblOrganizationCreditPools: Stores organization-level credit pools');
    console.log('   - tblCreditPoolTransfers: Tracks credit transfers between users');
    console.log('   - Indexes created for optimal query performance');
    console.log('   - Triggers configured for automatic timestamp updates');
    
    await pool.close();
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    process.exit(1);
  }
}

createOrganizationCreditPoolsTable();

