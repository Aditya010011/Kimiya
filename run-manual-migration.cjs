#!/usr/bin/env node

/**
 * Manual Migration: Add edge_type column to tblFlowEdges
 */

require('dotenv').config({ path: './backend/.env.development' });
const databaseService = require('./backend/services/database');

async function runManualMigration() {
  try {
    console.log('🔧 Starting manual edge_type column migration...');
    
    // Connect to database
    await databaseService.connect();
    
    // Check if column exists
    console.log('🔍 Checking if edge_type column exists...');
    const checkResult = await databaseService.query(`
      SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblFlowEdges' 
      AND COLUMN_NAME = 'edge_type'
    `);
    
    if (checkResult.recordset.length > 0) {
      console.log('✅ edge_type column already exists');
      return;
    }
    
    console.log('➕ Adding edge_type column...');
    
    // Add the column
    await databaseService.query(`
      ALTER TABLE tblFlowEdges
      ADD edge_type NVARCHAR(100) NULL
    `);
    
    console.log('✅ Added edge_type column');
    
    // Update existing records
    console.log('🔄 Updating existing records...');
    await databaseService.query(`
      UPDATE tblFlowEdges
      SET edge_type = 'default'
      WHERE edge_type IS NULL
    `);
    
    console.log('✅ Updated existing records');
    
    // Make column NOT NULL
    console.log('🔒 Making column NOT NULL...');
    await databaseService.query(`
      ALTER TABLE tblFlowEdges
      ALTER COLUMN edge_type NVARCHAR(100) NOT NULL
    `);
    
    console.log('✅ Made column NOT NULL');
    
    // Add default constraint
    console.log('⚙️ Adding default constraint...');
    try {
      await databaseService.query(`
        ALTER TABLE tblFlowEdges
        ADD CONSTRAINT DF_tblFlowEdges_edge_type DEFAULT 'default' FOR edge_type
      `);
      console.log('✅ Added default constraint');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️ Default constraint already exists');
      } else {
        throw error;
      }
    }
    
    // Verify the changes
    console.log('🔍 Verifying migration...');
    const verifyResult = await databaseService.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblFlowEdges' 
      AND COLUMN_NAME = 'edge_type'
    `);
    
    if (verifyResult.recordset.length > 0) {
      console.log('✅ Migration verification successful:');
      console.log(verifyResult.recordset[0]);
    } else {
      console.log('❌ Migration verification failed');
    }
    
    console.log('🎉 Manual migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await databaseService.close();
  }
}

// Run the migration
if (require.main === module) {
  runManualMigration().then(() => {
    console.log('✅ Migration script completed');
    process.exit(0);
  }).catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runManualMigration };
