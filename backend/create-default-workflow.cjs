/**
 * Create Default Inbound Workflow
 * 
 * This script creates a basic default workflow for inbound calls
 * with a simple conversation flow.
 */

const path = require('path');
const sql = require('mssql');

// Load environment variables
const envFile = path.join(__dirname, '.env.development');
require('dotenv').config({ path: envFile });

const databaseService = require('./services/database');

async function createDefaultWorkflow() {
  try {
    console.log('🔧 Creating default inbound workflow...');
    
    const pool = await databaseService.getPool();
    
    // Check if default workflow already exists
    const existingWorkflow = await pool.request()
      .input('name', sql.NVarChar(255), 'default-inbound')
      .query(`
        SELECT id FROM tblWorkflows 
        WHERE name = @name
      `);
    
    if (existingWorkflow.recordset.length > 0) {
      console.log('✅ Default workflow already exists with ID:', existingWorkflow.recordset[0].id);
      return existingWorkflow.recordset[0].id;
    }
    
    // Create the workflow
    const workflowResult = await pool.request()
      .input('name', sql.NVarChar(255), 'default-inbound')
      .input('description', sql.NVarChar(500), 'Default inbound call workflow with AI assistant')
      .input('is_active', sql.Bit, true)
      .input('created_by', sql.Int, 1)
      .query(`
        INSERT INTO tblWorkflows (name, description, is_active, created_by, created_at, updated_at)
        OUTPUT INSERTED.id
        VALUES (@name, @description, @is_active, @created_by, GETDATE(), GETDATE())
      `);
    
    const workflowId = workflowResult.recordset[0].id;
    console.log('✅ Created workflow with ID:', workflowId);
    
    // Create workflow nodes
    const nodes = [
      {
        node_id: 'start',
        node_type: 'start',
        position_x: 100,
        position_y: 100,
        node_data: JSON.stringify({
          message: 'Hello! Welcome to Kimiya Voice AI. I\'m your intelligent assistant. How can I help you today?'
        })
      },
      {
        node_id: 'ai-response-1',
        node_type: 'ai-response',
        position_x: 300,
        position_y: 100,
        node_data: JSON.stringify({
          prompt: 'You are a helpful AI assistant. Respond to the user\'s question or request in a friendly and professional manner.',
          maxTokens: 150
        })
      },
      {
        node_id: 'gather-input',
        node_type: 'gather',
        position_x: 500,
        position_y: 100,
        node_data: JSON.stringify({
          timeout: 10,
          speechTimeout: 3,
          language: 'en-US',
          enhanced: true,
          nextNode: 'ai-response-1'
        })
      },
      {
        node_id: 'end',
        node_type: 'end',
        position_x: 700,
        position_y: 100,
        node_data: JSON.stringify({
          message: 'Thank you for calling Kimiya Voice AI. Have a great day!'
        })
      }
    ];
    
    // Insert nodes
    for (const node of nodes) {
      await pool.request()
        .input('workflow_id', sql.Int, workflowId)
        .input('node_id', sql.NVarChar(50), node.node_id)
        .input('node_type', sql.NVarChar(50), node.node_type)
        .input('position_x', sql.Int, node.position_x)
        .input('position_y', sql.Int, node.position_y)
        .input('node_data', sql.NVarChar(sql.MAX), node.node_data)
        .input('created_by', sql.Int, 1)
        .query(`
          INSERT INTO tblWorkflowNodes
          (workflow_id, node_id, node_type, position_x, position_y, node_data, created_by, created_at, updated_at)
          VALUES (@workflow_id, @node_id, @node_type, @position_x, @position_y, @node_data, @created_by, GETDATE(), GETDATE())
        `);
      
      console.log(`✅ Created node: ${node.node_id} (${node.node_type})`);
    }
    
    // Create connections
    const connections = [
      { from: 'start', to: 'gather-input' },
      { from: 'gather-input', to: 'ai-response-1' },
      { from: 'ai-response-1', to: 'gather-input' } // Loop back for conversation
    ];
    
    for (const conn of connections) {
      await pool.request()
        .input('workflow_id', sql.Int, workflowId)
        .input('from_node', sql.NVarChar(50), conn.from)
        .input('to_node', sql.NVarChar(50), conn.to)
        .input('condition_type', sql.NVarChar(50), 'default')
        .input('created_by', sql.Int, 1)
        .query(`
          INSERT INTO tblWorkflowConnections
          (workflow_id, from_node, to_node, condition_type, created_by, created_at, updated_at)
          VALUES (@workflow_id, @from_node, @to_node, @condition_type, @created_by, GETDATE(), GETDATE())
        `);
      
      console.log(`✅ Created connection: ${conn.from} → ${conn.to}`);
    }
    
    console.log('🎉 Default workflow created successfully!');
    console.log('📋 Workflow Details:');
    console.log(`   ID: ${workflowId}`);
    console.log(`   Name: default-inbound`);
    console.log(`   Nodes: ${nodes.length}`);
    console.log(`   Connections: ${connections.length}`);
    
    return workflowId;
    
  } catch (error) {
    console.error('❌ Failed to create default workflow:', error.message);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  createDefaultWorkflow()
    .then((workflowId) => {
      console.log('🎉 Default workflow setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createDefaultWorkflow };
