#!/usr/bin/env node

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  server: process.env.DB_SERVER || 'developmentdbpool',
  database: process.env.DB_DATABASE || 'AI_Phone',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong!Passw0rd',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function fixSessionManagement() {
  let pool;
  
  try {
    console.log('🔧 Connecting to database...');
    pool = await sql.connect(config);
    
    // Step 1: Check current session_token column size
    console.log('📊 Checking current session_token column definition...');
    const columnInfo = await pool.request().query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE, 
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'tblUserSessions' 
      AND COLUMN_NAME = 'session_token'
    `);
    
    if (columnInfo.recordset.length > 0) {
      const column = columnInfo.recordset[0];
      console.log('📋 Current column definition:', {
        name: column.COLUMN_NAME,
        type: column.DATA_TYPE,
        maxLength: column.CHARACTER_MAXIMUM_LENGTH,
        nullable: column.IS_NULLABLE
      });
      
      // Step 2: Fix column size if needed
      if (column.CHARACTER_MAXIMUM_LENGTH < 1000) {
        console.log('🔧 Enlarging session_token column to VARCHAR(1000)...');
        await pool.request().query(`
          ALTER TABLE tblUserSessions
          ALTER COLUMN session_token VARCHAR(1000) NOT NULL
        `);
        console.log('✅ Session token column enlarged successfully');
      } else {
        console.log('✅ Session token column size is already adequate');
      }
    }
    
    // Step 3: Clean up duplicate and invalid sessions
    console.log('🧹 Cleaning up duplicate and invalid sessions...');
    
    // First, deactivate all sessions older than 24 hours
    const cleanupOld = await pool.request().query(`
      UPDATE tblUserSessions 
      SET is_active = 0 
      WHERE last_accessed_at < DATEADD(hour, -24, GETDATE())
      AND is_active = 1
    `);
    console.log(`🗑️ Deactivated ${cleanupOld.rowsAffected[0]} old sessions`);
    
    // Remove duplicate sessions (keep the most recent one per user)
    const removeDuplicates = await pool.request().query(`
      WITH RankedSessions AS (
        SELECT 
          session_id,
          user_id,
          session_token,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, session_token 
            ORDER BY last_accessed_at DESC
          ) as rn
        FROM tblUserSessions
        WHERE is_active = 1
      )
      UPDATE tblUserSessions 
      SET is_active = 0
      WHERE session_id IN (
        SELECT session_id 
        FROM RankedSessions 
        WHERE rn > 1
      )
    `);
    console.log(`🗑️ Removed ${removeDuplicates.rowsAffected[0]} duplicate sessions`);
    
    // Delete very old inactive sessions (older than 7 days)
    const deleteOld = await pool.request().query(`
      DELETE FROM tblUserSessions 
      WHERE created_at < DATEADD(day, -7, GETDATE())
      AND is_active = 0
    `);
    console.log(`🗑️ Deleted ${deleteOld.rowsAffected[0]} old inactive sessions`);
    
    // Step 4: Show current session status
    console.log('📊 Current session status:');
    const sessionStats = await pool.request().query(`
      SELECT 
        u.email,
        COUNT(CASE WHEN s.is_active = 1 THEN 1 END) as active_sessions,
        COUNT(CASE WHEN s.is_active = 0 THEN 1 END) as inactive_sessions,
        MAX(s.last_accessed_at) as last_activity
      FROM tblUsers u
      LEFT JOIN tblUserSessions s ON u.user_id = s.user_id
      GROUP BY u.user_id, u.email
      ORDER BY u.email
    `);
    
    sessionStats.recordset.forEach(user => {
      console.log(`👤 ${user.email}: ${user.active_sessions} active, ${user.inactive_sessions} inactive, last: ${user.last_activity || 'never'}`);
    });
    
    console.log('✅ Session management cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing session management:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the fix
if (require.main === module) {
  fixSessionManagement()
    .then(() => {
      console.log('🎉 Session management fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to fix session management:', error);
      process.exit(1);
    });
}

module.exports = { fixSessionManagement };
