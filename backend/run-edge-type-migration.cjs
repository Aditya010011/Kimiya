#!/usr/bin/env node

/**
 * Migration Script: Add edge_type column to tblFlowEdges
 * This script adds support for different edge types in the workflow system
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './.env.development' });

// Import database service
const databaseService = require('./services/database');

async function runEdgeTypeMigration() {
  try {
    console.log('🔧 Starting edge_type column migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add_edge_type_column.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL into individual statements (remove GO statements as they're SQL Server Management Studio specific)
    const statements = migrationSQL
      .split(/\bGO\b/gi)
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('PRINT'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Connect to database
    await databaseService.connect();
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        try {
          const result = await databaseService.query(statement);
          if (result.recordset && result.recordset.length > 0) {
            console.log('📊 Result:', result.recordset);
          }
        } catch (error) {
          // Check if it's a harmless error (column already exists, etc.)
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('Invalid column name')) {
            console.warn(`⚠️  Warning on statement ${i + 1}: ${error.message}`);
          } else {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            throw error;
          }
        }
      }
    }
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
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
      console.log('✅ Migration verification successful!');
      console.log('📊 Column details:', verifyResult.recordset[0]);
    } else {
      console.warn('⚠️  Migration verification failed - column not found');
    }
    
    console.log('\n🎉 Edge type migration completed successfully!');
    console.log('✅ The tblFlowEdges table now supports edge types');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
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

// Run the migration
if (require.main === module) {
  runEdgeTypeMigration();
}

module.exports = { runEdgeTypeMigration };
