const axios = require('axios');
require('dotenv').config({ path: './.env.development' });

// Configuration
const BASE_URL = 'http://localhost:3010';
const TEST_USER = {
  email: 'test@kimiyavoice.com',
  password: 'TestPassword123!',
  first_name: 'Test',
  last_name: 'User'
};

let authToken = null;

/**
 * Helper function to make HTTP requests
 */
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || { error: error.message }
    };
  }
}

/**
 * Test user registration
 */
async function testRegistration() {
  console.log('\n🔐 Testing User Registration...');
  
  const result = await makeRequest('POST', '/api/auth/register', TEST_USER);
  
  if (result.success && result.data.success) {
    console.log('✅ Registration successful');
    console.log(`📧 User: ${result.data.data.user.email}`);
    console.log(`👤 Name: ${result.data.data.user.first_name} ${result.data.data.user.last_name}`);
    console.log(`🔑 Role: ${result.data.data.user.role}`);
    console.log(`🎫 Token received: ${result.data.data.tokens.access_token.substring(0, 20)}...`);
    
    // Store token for later tests
    authToken = result.data.data.tokens.access_token;
    return true;
  } else {
    console.log('❌ Registration failed');
    console.log(`Status: ${result.status}`);
    console.log(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

/**
 * Test user login
 */
async function testLogin() {
  console.log('\n🔑 Testing User Login...');
  
  const loginData = {
    email: TEST_USER.email,
    password: TEST_USER.password
  };
  
  const result = await makeRequest('POST', '/api/auth/login', loginData);
  
  if (result.success && result.data.success) {
    console.log('✅ Login successful');
    console.log(`📧 User: ${result.data.data.user.email}`);
    console.log(`🎫 Token received: ${result.data.data.tokens.access_token.substring(0, 20)}...`);
    
    // Update token
    authToken = result.data.data.tokens.access_token;
    return true;
  } else {
    console.log('❌ Login failed');
    console.log(`Status: ${result.status}`);
    console.log(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

/**
 * Test invalid login
 */
async function testInvalidLogin() {
  console.log('\n🚫 Testing Invalid Login...');
  
  const invalidLoginData = {
    email: TEST_USER.email,
    password: 'wrongpassword'
  };
  
  const result = await makeRequest('POST', '/api/auth/login', invalidLoginData);
  
  if (!result.success || !result.data.success) {
    console.log('✅ Invalid login correctly rejected');
    console.log(`Status: ${result.status}`);
    return true;
  } else {
    console.log('❌ Invalid login was accepted (security issue!)');
    return false;
  }
}

/**
 * Test getting user profile (protected route)
 */
async function testGetProfile() {
  console.log('\n👤 Testing Get Profile (Protected Route)...');
  
  if (!authToken) {
    console.log('❌ No auth token available');
    return false;
  }
  
  const result = await makeRequest('GET', '/api/auth/profile', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('✅ Profile retrieved successfully');
    console.log(`📧 Email: ${result.data.data.user.email}`);
    console.log(`👤 Name: ${result.data.data.user.first_name} ${result.data.data.user.last_name}`);
    console.log(`🔑 Role: ${result.data.data.user.role}`);
    console.log(`📅 Created: ${result.data.data.user.created_at}`);
    return true;
  } else {
    console.log('❌ Profile retrieval failed');
    console.log(`Status: ${result.status}`);
    console.log(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

/**
 * Test updating user profile
 */
async function testUpdateProfile() {
  console.log('\n✏️  Testing Update Profile...');
  
  if (!authToken) {
    console.log('❌ No auth token available');
    return false;
  }
  
  const updateData = {
    first_name: 'Updated',
    last_name: 'TestUser'
  };
  
  const result = await makeRequest('PUT', '/api/auth/profile', updateData, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('✅ Profile updated successfully');
    console.log(`👤 New Name: ${result.data.data.user.first_name} ${result.data.data.user.last_name}`);
    return true;
  } else {
    console.log('❌ Profile update failed');
    console.log(`Status: ${result.status}`);
    console.log(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

/**
 * Test protected route without token
 */
async function testProtectedRouteWithoutToken() {
  console.log('\n🔒 Testing Protected Route Without Token...');
  
  const result = await makeRequest('GET', '/api/auth/profile');
  
  if (!result.success || !result.data.success) {
    console.log('✅ Protected route correctly rejected unauthorized access');
    console.log(`Status: ${result.status}`);
    return true;
  } else {
    console.log('❌ Protected route allowed unauthorized access (security issue!)');
    return false;
  }
}

/**
 * Test logout
 */
async function testLogout() {
  console.log('\n🚪 Testing Logout...');
  
  if (!authToken) {
    console.log('❌ No auth token available');
    return false;
  }
  
  const result = await makeRequest('POST', '/api/auth/logout', null, {
    'Authorization': `Bearer ${authToken}`
  });
  
  if (result.success && result.data.success) {
    console.log('✅ Logout successful');
    console.log(`Message: ${result.data.message}`);
    return true;
  } else {
    console.log('❌ Logout failed');
    console.log(`Status: ${result.status}`);
    console.log(`Error: ${JSON.stringify(result.data, null, 2)}`);
    return false;
  }
}

/**
 * Run all authentication tests
 */
async function runAllTests() {
  console.log('🧪 Starting Authentication System Tests...');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`📧 Test User: ${TEST_USER.email}`);
  
  const results = {
    registration: false,
    login: false,
    invalidLogin: false,
    getProfile: false,
    updateProfile: false,
    protectedWithoutToken: false,
    logout: false
  };
  
  try {
    // Test registration
    results.registration = await testRegistration();
    
    // Test login (skip if registration failed)
    if (results.registration) {
      results.login = await testLogin();
    }
    
    // Test invalid login
    results.invalidLogin = await testInvalidLogin();
    
    // Test protected routes (only if we have a token)
    if (authToken) {
      results.getProfile = await testGetProfile();
      results.updateProfile = await testUpdateProfile();
      results.logout = await testLogout();
    }
    
    // Test protected route without token
    results.protectedWithoutToken = await testProtectedRouteWithoutToken();
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  }
  
  // Print summary
  console.log('\n📊 Test Results Summary:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const testNames = {
    registration: 'User Registration',
    login: 'User Login',
    invalidLogin: 'Invalid Login Rejection',
    getProfile: 'Get Profile (Protected)',
    updateProfile: 'Update Profile (Protected)',
    protectedWithoutToken: 'Protected Route Security',
    logout: 'User Logout'
  };
  
  let passedTests = 0;
  let totalTests = 0;
  
  Object.entries(results).forEach(([key, passed]) => {
    totalTests++;
    if (passed) passedTests++;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testNames[key]}`);
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🎯 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All authentication tests passed!');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run tests
runAllTests().catch(console.error);
