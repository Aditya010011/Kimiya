#!/usr/bin/env node

/**
 * Credit Reset Cron Job
 * 
 * This job should be run daily (recommended: midnight) to:
 * 1. Reset monthly credits for users whose allocation_reset_date has passed
 * 2. Clean up expired credits (older than 365 days)
 * 
 * Setup with cron:
 * 0 0 * * * cd /var/www/kimiya-voice-dev/backend && node jobs/credit-reset-job.js >> logs/credit-reset.log 2>&1
 * 
 * Or use PM2 cron:
 * pm2 start jobs/credit-reset-job.js --cron "0 0 * * *" --no-autorestart
 */

const path = require('path');
const fs = require('fs');

// Set up paths
const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

// Load environment variables
require('dotenv').config({ path: path.join(rootDir, '.env') });

const CreditResetService = require('../services/CreditResetService');
const databaseService = require('../services/database');

/**
 * Main job function
 */
async function runCreditResetJob() {
  const startTime = new Date();
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🚀 Credit Reset Job Started: ${startTime.toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Connect to database
    console.log('📡 Connecting to database...');
    await databaseService.connect();
    console.log('✅ Database connected');

    // Step 1: Reset monthly credits
    console.log('\n📋 Step 1: Resetting monthly credits...');
    const resetResult = await CreditResetService.resetMonthlyCredits();
    
    if (resetResult.success) {
      console.log(`✅ Monthly reset complete: ${resetResult.resetsProcessed} users processed`);
      if (resetResult.errors > 0) {
        console.log(`⚠️  Errors encountered: ${resetResult.errors}`);
        console.log('Error details:', JSON.stringify(resetResult.errorDetails, null, 2));
      }
    } else {
      console.error('❌ Monthly reset failed:', resetResult.error);
    }

    // Step 2: Clean up expired credits
    console.log('\n📋 Step 2: Cleaning up expired credits...');
    const cleanupResult = await CreditResetService.cleanupExpiredCredits();
    
    if (cleanupResult.success) {
      console.log(`✅ Cleanup complete: ${cleanupResult.creditsExpired} credits expired for ${cleanupResult.usersAffected} users`);
    } else {
      console.error('❌ Cleanup failed:', cleanupResult.error);
    }

    // Step 3: Get upcoming resets info
    console.log('\n📋 Step 3: Checking upcoming resets...');
    const upcomingResult = await CreditResetService.getUpcomingResets();
    
    if (upcomingResult.success) {
      console.log(`📊 Upcoming resets (next 7 days): ${upcomingResult.data.total_resets} users, ${upcomingResult.data.total_credits_to_allocate} total credits`);
    }

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✅ Credit Reset Job Completed: ${endTime.toISOString()}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // Close database connection
    await databaseService.close();

    // Exit successfully
    process.exit(0);

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════');
    console.error('❌ Credit Reset Job Failed');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════\n');

    // Close database connection
    try {
      await databaseService.close();
    } catch (closeError) {
      console.error('Error closing database:', closeError);
    }

    // Exit with error
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the job
runCreditResetJob();

