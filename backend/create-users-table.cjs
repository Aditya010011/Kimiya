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

async function createUsersTable() {
  console.log('🔌 Creating users table for authentication system...');
  
  try {
    console.log('\n⏳ Connecting to database...');
    const pool = await sql.connect(config);
    console.log('✅ Database connected successfully!');
    
    console.log('\n🏗️  Creating users table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblUsers' AND xtype='U')
      CREATE TABLE tblUsers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(100) NULL,
        last_name NVARCHAR(100) NULL,
        role NVARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
      );
    `);
    console.log('✅ Users table created successfully!');
    
    console.log('\n📊 Creating index on email...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tblUsers_email')
      CREATE INDEX IX_tblUsers_email ON tblUsers(email);
    `);
    console.log('✅ Email index created successfully!');
    
    console.log('\n⚡ Creating update trigger...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_tblUsers_updated_at')
      EXEC('
        CREATE TRIGGER TR_tblUsers_updated_at
        ON tblUsers
        AFTER UPDATE
        AS
        BEGIN
          SET NOCOUNT ON;
          UPDATE tblUsers
          SET updated_at = GETDATE()
          FROM tblUsers u
          INNER JOIN inserted i ON u.id = i.id;
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
        COLUMN_DEFAULT,
        CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'tblUsers'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('✅ Users table structure:');
    tableInfo.recordset.forEach(column => {
      const nullable = column.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      const length = column.CHARACTER_MAXIMUM_LENGTH ? `(${column.CHARACTER_MAXIMUM_LENGTH})` : '';
      const defaultVal = column.COLUMN_DEFAULT ? ` DEFAULT ${column.COLUMN_DEFAULT}` : '';
      console.log(`  - ${column.COLUMN_NAME}: ${column.DATA_TYPE}${length} ${nullable}${defaultVal}`);
    });
    
    console.log('\n📊 Checking indexes...');
    const indexes = await pool.request().query(`
      SELECT 
        i.name as index_name,
        c.name as column_name
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('tblUsers')
      AND i.name IS NOT NULL
      ORDER BY i.name, ic.key_ordinal
    `);
    
    console.log('✅ Indexes found:');
    indexes.recordset.forEach(index => {
      console.log(`  - ${index.index_name} on ${index.column_name}`);
    });
    
    await pool.close();
    console.log('\n🔌 Database connection closed successfully');
    console.log('\n🎉 Users table setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Users table creation failed:');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    console.error('State:', error.state);
    console.error('Class:', error.class);
    console.error('Server:', error.server);
    console.error('Procedure:', error.procName);
    console.error('Line:', error.lineNumber);
    
    if (error.originalError) {
      console.error('Original Error:', error.originalError.message);
    }
    
    process.exit(1);
  }
}

createUsersTable();
