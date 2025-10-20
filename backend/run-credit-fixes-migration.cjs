// Load environment from backend directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

const databaseService = require('./services/database');
const fs = require('fs');

async function runMigration() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🚀 CREDIT SYSTEM FIXES - DATABASE MIGRATION');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await databaseService.connect();
    console.log('✅ Connected to database');
    console.log('');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-scheduled-plan-fields.sql');
    console.log('📄 Reading migration file:', migrationPath);
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error('Migration file not found: ' + migrationPath);
    }
    
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Split SQL by GO statements and execute each batch
    console.log('🔄 Executing migration batches...');
    console.log('');
    
    const batches = sqlContent
      .split(/\nGO\n/gi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0 && !batch.startsWith('--') && batch !== 'GO');

    let batchNumber = 1;
    for (const batch of batches) {
      if (batch.trim()) {
        try {
          console.log(`📦 Executing batch ${batchNumber}/${batches.length}...`);
          const result = await databaseService.query(batch);
          
          // Print any messages from the SQL execution
          if (result && result.recordset) {
            console.log('   Result:', result.recordset);
          }
          
          console.log(`✅ Batch ${batchNumber} completed`);
          batchNumber++;
        } catch (error) {
          // Check if it's a benign error (column already exists, etc.)
          if (error.message.includes('already exists') || 
              error.message.includes('Cannot drop') ||
              error.message.includes('There is already an object')) {
            console.log(`⚠️  Batch ${batchNumber} - Object already exists (skipping)`);
            batchNumber++;
          } else {
            console.error(`❌ Error in batch ${batchNumber}:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Summary:');
    console.log('   - Added scheduled_plan_id to tblSubscriptions');
    console.log('   - Added scheduled_billing_cycle to tblSubscriptions');
    console.log('   - Created tblPlanChangeHistory table');
    console.log('   - Added foreign keys and constraints');
    console.log('   - Created indexes for performance');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════════════════════════');
    console.error('❌ MIGRATION FAILED');
    console.error('═══════════════════════════════════════════════════════════════════════════════');
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack:', error.stack);
    console.error('');
    process.exit(1);
  } finally {
    // Close database connection
    try {
      await databaseService.close();
      console.log('📡 Database connection closed');
      console.log('');
    } catch (error) {
      console.error('⚠️  Error closing database connection:', error.message);
    }
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error.message);
    process.exit(1);
  });

