#!/usr/bin/env node

/**
 * Fix session_token column size to accommodate full JWT tokens
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

// Import database service
const databaseService = require('./services/database');

async function fixSessionTokenColumn() {
  try {
    console.log('🔧 Starting session_token column fix...');
    
    // Check current column definition
    console.log('📊 Checking current column definition...');
    const checkResult = await databaseService.query(`
      SELECT 
          COLUMN_NAME, 
          DATA_TYPE, 
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblUserSessions' 
      AND COLUMN_NAME = 'session_token'
    `);
    
    if (checkResult.recordset.length > 0) {
      const column = checkResult.recordset[0];
      console.log('📋 Current column definition:', {
        name: column.COLUMN_NAME,
        type: column.DATA_TYPE,
        maxLength: column.CHARACTER_MAXIMUM_LENGTH,
        nullable: column.IS_NULLABLE
      });
      
      if (column.CHARACTER_MAXIMUM_LENGTH < 500) {
        console.log('⚡ Enlarging session_token column to NVARCHAR(1000)...');

        // Step 1: Drop the unique constraint
        console.log('🔧 Dropping unique constraint UQ_tblUserSessions_token...');
        try {
          await databaseService.query(`
            ALTER TABLE tblUserSessions
            DROP CONSTRAINT UQ_tblUserSessions_token
          `);
          console.log('✅ Unique constraint dropped');
        } catch (error) {
          if (!error.message.includes('does not exist')) {
            console.warn('⚠️ Warning dropping constraint:', error.message);
          }
        }

        // Step 2: Alter the column size
        console.log('🔧 Altering column size to NVARCHAR(1000)...');
        await databaseService.query(`
          ALTER TABLE tblUserSessions
          ALTER COLUMN session_token NVARCHAR(1000) NOT NULL
        `);

        // Step 3: Recreate the unique constraint
        console.log('🔧 Recreating unique constraint...');
        await databaseService.query(`
          ALTER TABLE tblUserSessions
          ADD CONSTRAINT UQ_tblUserSessions_token UNIQUE (session_token)
        `);

        console.log('✅ Column successfully enlarged and constraint recreated!');
      } else {
        console.log('✅ Column is already large enough (>= 500 characters)');
      }
    } else {
      console.log('❌ session_token column not found!');
      return;
    }
    
    // Verify the change
    console.log('🔍 Verifying the change...');
    const verifyResult = await databaseService.query(`
      SELECT 
          COLUMN_NAME, 
          DATA_TYPE, 
          CHARACTER_MAXIMUM_LENGTH,
          IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblUserSessions' 
      AND COLUMN_NAME = 'session_token'
    `);
    
    if (verifyResult.recordset.length > 0) {
      const column = verifyResult.recordset[0];
      console.log('📋 Updated column definition:', {
        name: column.COLUMN_NAME,
        type: column.DATA_TYPE,
        maxLength: column.CHARACTER_MAXIMUM_LENGTH,
        nullable: column.IS_NULLABLE
      });
    }
    
    // Clean up old inactive sessions
    console.log('🧹 Cleaning up old inactive sessions...');
    const cleanupResult = await databaseService.query(`
      DELETE FROM tblUserSessions 
      WHERE created_at < DATEADD(day, -7, GETDATE())
      AND is_active = 0
    `);
    
    const deletedCount = cleanupResult.rowsAffected[0] || 0;
    console.log(`🗑️ Deleted ${deletedCount} old inactive sessions`);
    
    console.log('🎉 Session token column fix completed successfully!');
    console.log('💡 JWT tokens can now be stored without truncation');
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await databaseService.close();
    } catch (error) {
      console.warn('Warning: Failed to close database connection:', error.message);
    }
  }
}

// Run the fix
if (require.main === module) {
  fixSessionTokenColumn();
}

module.exports = { fixSessionTokenColumn };
