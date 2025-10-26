#!/usr/bin/env node

/**
 * Test Admin Authentication
 * This script tests the admin authentication flow and allocate endpoint
 */

const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });
const databaseService = require('./services/database');

async function testAdminAuth() {
  console.log('\n🧪 Testing Admin Authentication Flow\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Connect to database
    console.log('\n📍 Step 1: Connecting to database...');
    await databaseService.connect();
    console.log('✅ Database connected');

    // Step 2: Get all users
    console.log('\n📍 Step 2: Fetching all users...');
    const usersResult = await databaseService.query(`
      SELECT id, email, role, is_active, created_at
      FROM tblUsers
      ORDER BY created_at DESC
    `);

    if (!usersResult.recordset || usersResult.recordset.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    console.log(`✅ Found ${usersResult.recordset.length} user(s):`);
    usersResult.recordset.forEach(user => {
      const status = user.is_active ? '✅ Active' : '❌ Inactive';
      const roleStatus = user.role === 'admin' ? '👑 ADMIN' : '👤 USER';
      console.log(`   - ${user.email} (ID: ${user.id}) - ${roleStatus} - ${status}`);
    });

    // Step 3: Find an admin user
    console.log('\n📍 Step 3: Looking for admin user...');
    const adminUser = usersResult.recordset.find(u => u.role === 'admin' && u.is_active);

    if (!adminUser) {
      console.log('❌ No active admin user found');
      console.log('\n💡 To fix this, run:');
      console.log(`   UPDATE tblUsers SET role = 'admin' WHERE email = 'your-email@example.com';`);
      return;
    }

    console.log(`✅ Found admin user: ${adminUser.email} (ID: ${adminUser.id})`);

    // Step 4: Create a JWT token for the admin user
    console.log('\n📍 Step 4: Creating JWT token...');
    const token = jwt.sign(
      {
        userId: adminUser.id,
        email: adminUser.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ JWT token created');
    console.log(`\n🔑 Token (first 50 chars): ${token.substring(0, 50)}...`);

    // Step 5: Verify the token
    console.log('\n📍 Step 5: Verifying JWT token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verified');
    console.log(`   - userId: ${decoded.userId}`);
    console.log(`   - email: ${decoded.email}`);

    // Step 6: Simulate authenticateToken middleware
    console.log('\n📍 Step 6: Simulating authenticateToken middleware...');
    const userFromDb = await databaseService.query(`
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at
      FROM tblUsers
      WHERE id = @userId AND is_active = 1
    `, {
      userId: decoded.userId
    });

    if (!userFromDb.recordset || userFromDb.recordset.length === 0) {
      console.log('❌ User not found or inactive');
      return;
    }

    const user = userFromDb.recordset[0];
    console.log('✅ User loaded from database');
    console.log(`   - id: ${user.id}`);
    console.log(`   - email: ${user.email}`);
    console.log(`   - role: ${user.role}`);
    console.log(`   - is_active: ${user.is_active}`);

    // Step 7: Simulate requireAdmin middleware
    console.log('\n📍 Step 7: Simulating requireAdmin middleware...');
    if (user.role !== 'admin') {
      console.log(`❌ User role is '${user.role}', not 'admin'`);
      return;
    }

    console.log('✅ User has admin role');

    // Step 8: Test endpoint with curl
    console.log('\n📍 Step 8: Testing endpoint with curl...');
    console.log('\n🔗 Use this curl command to test the endpoint:');
    console.log(`\ncurl -X POST http://localhost:3010/api/admin/credits/allocate \\`);
    console.log(`  -H "Authorization: Bearer ${token}" \\`);
    console.log(`  -H "Content-Type: application/json" \\`);
    console.log(`  -d '{"userId": 2, "amount": 5000, "notes": "Test"}'`);

    console.log('\n' + '='.repeat(60));
    console.log('\n✅ All authentication checks passed!');
    console.log('\n💡 If you still get 401 errors:');
    console.log('   1. Make sure you\'re using the correct JWT token');
    console.log('   2. Check that the token hasn\'t expired');
    console.log('   3. Verify the Authorization header format: "Bearer <token>"');
    console.log('   4. Check backend logs: pm2 logs backend');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    await databaseService.close();
  }
}

testAdminAuth();

