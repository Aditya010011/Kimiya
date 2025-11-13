const sql = require('mssql');
const path = require('path');

// Load environment configuration
const envFile = process.env.NODE_ENV === "production"
  ? ""
  : path.join(__dirname, ".env.development");

if (envFile) {
  require("dotenv").config({ path: envFile });
}
require('dotenv').config();

async function checkRealtimeData() {
  console.log('🔍 Checking Real-time Metrics Data Sources');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  let pool;
  
  try {
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
    };

    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Database connected\n');

    // 1. Check User Sessions
    console.log('👥 CHECKING USER SESSIONS (tblUserSessions)');
    console.log('─────────────────────────────────────────────');
    
    const allSessions = await pool.request().query(`
      SELECT COUNT(*) as total_sessions FROM tblUserSessions
    `);
    console.log(`Total sessions in table: ${allSessions.recordset[0].total_sessions}`);

    const activeSessions = await pool.request().query(`
      SELECT 
        COUNT(*) as active_sessions,
        COUNT(DISTINCT user_id) as unique_users
      FROM tblUserSessions
      WHERE is_active = 1
    `);
    console.log(`Active sessions (is_active=1): ${activeSessions.recordset[0].active_sessions}`);
    console.log(`Unique users with active sessions: ${activeSessions.recordset[0].unique_users}`);

    const nonExpiredSessions = await pool.request().query(`
      SELECT 
        COUNT(*) as non_expired,
        COUNT(DISTINCT user_id) as unique_users
      FROM tblUserSessions
      WHERE is_active = 1 AND expires_at > GETDATE()
    `);
    console.log(`Active & non-expired sessions: ${nonExpiredSessions.recordset[0].non_expired}`);
    console.log(`Unique users (active & non-expired): ${nonExpiredSessions.recordset[0].unique_users}`);

    const recentSessions = await pool.request().query(`
      SELECT 
        COUNT(*) as recent_sessions,
        COUNT(DISTINCT user_id) as unique_users
      FROM tblUserSessions
      WHERE is_active = 1 
        AND expires_at > GETDATE()
        AND last_accessed_at > DATEADD(MINUTE, -30, GETDATE())
    `);
    console.log(`Recently accessed (last 30 min): ${recentSessions.recordset[0].recent_sessions}`);
    console.log(`Unique users (recently accessed): ${recentSessions.recordset[0].unique_users}`);

    // Show sample sessions
    const sampleSessions = await pool.request().query(`
      SELECT TOP 5
        user_id,
        is_active,
        created_at,
        expires_at,
        last_accessed_at,
        CASE 
          WHEN expires_at > GETDATE() THEN 'Not Expired'
          ELSE 'Expired'
        END as expiry_status
      FROM tblUserSessions
      ORDER BY last_accessed_at DESC
    `);
    console.log('\nSample sessions (most recent):');
    console.table(sampleSessions.recordset);

    // 2. Check Inbound Calls
    console.log('\n📞 CHECKING INBOUND CALLS (tblInboundCalls)');
    console.log('─────────────────────────────────────────────');
    
    const allCalls = await pool.request().query(`
      SELECT COUNT(*) as total_calls FROM tblInboundCalls
    `);
    console.log(`Total calls in table: ${allCalls.recordset[0].total_calls}`);

    const activeCalls = await pool.request().query(`
      SELECT COUNT(*) as active_calls
      FROM tblInboundCalls
      WHERE call_status = 'in-progress'
    `);
    console.log(`Calls with status 'in-progress': ${activeCalls.recordset[0].active_calls}`);

    const recentCalls = await pool.request().query(`
      SELECT COUNT(*) as recent_calls
      FROM tblInboundCalls
      WHERE start_time > DATEADD(HOUR, -2, GETDATE())
    `);
    console.log(`Calls started in last 2 hours: ${recentCalls.recordset[0].recent_calls}`);

    // Show call statuses
    const callStatuses = await pool.request().query(`
      SELECT 
        call_status,
        COUNT(*) as count
      FROM tblInboundCalls
      GROUP BY call_status
      ORDER BY count DESC
    `);
    console.log('\nCall status distribution:');
    console.table(callStatuses.recordset);

    // 3. Check Chat Sessions
    console.log('\n💬 CHECKING CHAT SESSIONS (tblChatSessions)');
    console.log('─────────────────────────────────────────────');
    
    const allChatSessions = await pool.request().query(`
      SELECT COUNT(*) as total_sessions FROM tblChatSessions
    `);
    console.log(`Total chat sessions: ${allChatSessions.recordset[0].total_sessions}`);

    const recentChatSessions = await pool.request().query(`
      SELECT COUNT(*) as recent_sessions
      FROM tblChatSessions
      WHERE created_at > DATEADD(MINUTE, -1, GETDATE())
    `);
    console.log(`Chat sessions in last minute: ${recentChatSessions.recordset[0].recent_sessions}`);

    const lastHourSessions = await pool.request().query(`
      SELECT COUNT(*) as last_hour_sessions
      FROM tblChatSessions
      WHERE created_at > DATEADD(HOUR, -1, GETDATE())
    `);
    console.log(`Chat sessions in last hour: ${lastHourSessions.recordset[0].last_hour_sessions}`);

    // Show outcome distribution
    const outcomes = await pool.request().query(`
      SELECT 
        outcome,
        COUNT(*) as count
      FROM tblChatSessions
      WHERE created_at > DATEADD(HOUR, -1, GETDATE())
      GROUP BY outcome
      ORDER BY count DESC
    `);
    console.log('\nChat session outcomes (last hour):');
    console.table(outcomes.recordset);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Data check complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (pool) {
      await pool.close();
    }
    process.exit(0);
  }
}

checkRealtimeData();
