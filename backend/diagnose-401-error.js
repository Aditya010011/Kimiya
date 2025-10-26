#!/usr/bin/env node

/**
 * Diagnostic Script for 401 Unauthorized Error
 * 
 * This script checks:
 * 1. Backend service is running
 * 2. Database connection works
 * 3. Admin user exists and has correct role
 * 4. Routes are registered
 * 5. Middleware is configured correctly
 * 
 * Usage: node backend/diagnose-401-error.js
 */

const databaseService = require('./services/database');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(70)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(70)}\n`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function runDiagnostics() {
  try {
    logSection('401 UNAUTHORIZED ERROR DIAGNOSTIC');

    // Check 1: Environment variables
    logSection('1. CHECKING ENVIRONMENT VARIABLES');
    
    if (!process.env.JWT_SECRET) {
      logError('JWT_SECRET not set in .env file');
      return;
    }
    logSuccess('JWT_SECRET is configured');

    if (!process.env.DB_SERVER) {
      logError('Database configuration missing');
      return;
    }
    logSuccess('Database configuration found');

    // Check 2: Database connection
    logSection('2. CHECKING DATABASE CONNECTION');
    
    try {
      const testQuery = await databaseService.query('SELECT 1 as test');
      logSuccess('Database connection successful');
    } catch (error) {
      logError(`Database connection failed: ${error.message}`);
      return;
    }

    // Check 3: Admin user exists
    logSection('3. CHECKING ADMIN USERS');
    
    try {
      const adminUsers = await databaseService.query(`
        SELECT id, email, role, is_active, created_at
        FROM tblUsers
        WHERE role = 'admin'
        ORDER BY created_at DESC
      `);

      if (!adminUsers.recordset || adminUsers.recordset.length === 0) {
        logWarning('No admin users found in database');
        logInfo('To create an admin user, run:');
        logInfo('UPDATE tblUsers SET role = "admin" WHERE email = "your-email@example.com";');
      } else {
        logSuccess(`Found ${adminUsers.recordset.length} admin user(s):`);
        adminUsers.recordset.forEach(user => {
          const status = user.is_active ? '✅ Active' : '❌ Inactive';
          log(`  - ${user.email} (ID: ${user.id}) - ${status}`, 'green');
        });
      }
    } catch (error) {
      logError(`Failed to query admin users: ${error.message}`);
    }

    // Check 4: All users and their roles
    logSection('4. CHECKING ALL USERS');
    
    try {
      const allUsers = await databaseService.query(`
        SELECT id, email, role, is_active
        FROM tblUsers
        ORDER BY created_at DESC
      `);

      if (!allUsers.recordset || allUsers.recordset.length === 0) {
        logWarning('No users found in database');
      } else {
        logSuccess(`Found ${allUsers.recordset.length} user(s):`);
        allUsers.recordset.forEach(user => {
          const status = user.is_active ? '✅' : '❌';
          log(`  ${status} ${user.email} - Role: ${user.role} (ID: ${user.id})`, 'green');
        });
      }
    } catch (error) {
      logError(`Failed to query users: ${error.message}`);
    }

    // Check 5: Verify middleware configuration
    logSection('5. CHECKING MIDDLEWARE CONFIGURATION');
    
    try {
      const authMiddleware = require('./middleware/auth');
      
      if (authMiddleware.authenticateToken) {
        logSuccess('authenticateToken middleware is exported');
      } else {
        logError('authenticateToken middleware not found');
      }

      if (authMiddleware.requireAdmin) {
        logSuccess('requireAdmin middleware is exported');
      } else {
        logError('requireAdmin middleware not found');
      }

      if (authMiddleware.requireRole) {
        logSuccess('requireRole middleware is exported');
      } else {
        logError('requireRole middleware not found');
      }
    } catch (error) {
      logError(`Failed to load middleware: ${error.message}`);
    }

    // Check 6: Verify routes are configured
    logSection('6. CHECKING ROUTE CONFIGURATION');
    
    try {
      const adminCreditsRoutes = require('./routes/admin-credits');
      logSuccess('admin-credits routes loaded successfully');
      
      // Check if allocate route exists
      if (adminCreditsRoutes.stack) {
        const allocateRoute = adminCreditsRoutes.stack.find(layer => 
          layer.route && layer.route.path === '/allocate'
        );
        
        if (allocateRoute) {
          logSuccess('POST /allocate route found in admin-credits');
          const methods = Object.keys(allocateRoute.route.methods);
          log(`  Methods: ${methods.join(', ')}`, 'green');
        } else {
          logWarning('POST /allocate route not found in admin-credits');
        }
      }
    } catch (error) {
      logError(`Failed to load routes: ${error.message}`);
    }

    // Check 7: Verify CreditService
    logSection('7. CHECKING CREDIT SERVICE');
    
    try {
      const CreditService = require('./services/CreditService');
      
      if (CreditService.allocateCredits) {
        logSuccess('CreditService.allocateCredits method exists');
      } else {
        logError('CreditService.allocateCredits method not found');
      }
    } catch (error) {
      logError(`Failed to load CreditService: ${error.message}`);
    }

    // Check 8: Summary and recommendations
    logSection('8. SUMMARY & RECOMMENDATIONS');
    
    logInfo('If you\'re still getting 401 errors:');
    log('\n1. Verify your user has admin role:', 'yellow');
    log('   UPDATE tblUsers SET role = "admin" WHERE email = "your-email@example.com";\n', 'yellow');
    
    log('2. Clear browser cache and log in again:', 'yellow');
    log('   - Open DevTools (F12)', 'yellow');
    log('   - Application → Local Storage → Delete all', 'yellow');
    log('   - Application → Cookies → Delete all', 'yellow');
    log('   - Hard refresh (Ctrl+Shift+R)\n', 'yellow');
    
    log('3. Test with curl:', 'yellow');
    log('   curl -X POST http://localhost:3010/api/admin/credits/allocate \\', 'yellow');
    log('     -H "Authorization: Bearer YOUR_JWT_TOKEN" \\', 'yellow');
    log('     -H "Content-Type: application/json" \\', 'yellow');
    log('     -d \'{"userId": 2, "amount": 5000}\'\n', 'yellow');
    
    log('4. Check backend logs:', 'yellow');
    log('   pm2 logs backend\n', 'yellow');

    logSuccess('Diagnostic complete!');

  } catch (error) {
    logError(`Diagnostic failed: ${error.message}`);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

// Run diagnostics
runDiagnostics();

