const sql = require('mssql');
require('dotenv').config({ path: '.env.development' });

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
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function createWorkflowTables() {
  let pool;
  
  try {
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database successfully');

    // 1. Create tblWorkflows table
    console.log('\n📋 Creating tblWorkflows table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWorkflows' AND xtype='U')
      BEGIN
        CREATE TABLE tblWorkflows (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX),
          created_by INT NOT NULL,
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_Workflows_CreatedBy FOREIGN KEY (created_by) REFERENCES tblUsers(id),
          
          -- Indexes for performance
          INDEX IX_Workflows_CreatedBy (created_by),
          INDEX IX_Workflows_IsActive (is_active),
          INDEX IX_Workflows_CreatedAt (created_at)
        );
        PRINT '✅ tblWorkflows table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblWorkflows table already exists';
      END
    `);

    // 2. Create tblWorkflowConfigs table
    console.log('\n⚙️ Creating tblWorkflowConfigs table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblWorkflowConfigs' AND xtype='U')
      BEGIN
        CREATE TABLE tblWorkflowConfigs (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workflow_id INT NOT NULL,
          config_key NVARCHAR(255) NOT NULL,
          config_value NVARCHAR(MAX),
          config_type NVARCHAR(50) DEFAULT 'string',
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_WorkflowConfigs_WorkflowId FOREIGN KEY (workflow_id) REFERENCES tblWorkflows(id) ON DELETE CASCADE,
          
          -- Unique constraint for config_key per workflow
          CONSTRAINT UQ_WorkflowConfigs_WorkflowKey UNIQUE (workflow_id, config_key),
          
          -- Indexes for performance
          INDEX IX_WorkflowConfigs_WorkflowId (workflow_id),
          INDEX IX_WorkflowConfigs_ConfigKey (config_key)
        );
        PRINT '✅ tblWorkflowConfigs table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblWorkflowConfigs table already exists';
      END
    `);

    // 3. Create tblFlowNodes table
    console.log('\n🔗 Creating tblFlowNodes table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblFlowNodes' AND xtype='U')
      BEGIN
        CREATE TABLE tblFlowNodes (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workflow_id INT NOT NULL,
          node_id NVARCHAR(255) NOT NULL,
          node_type NVARCHAR(100) NOT NULL,
          position_x FLOAT DEFAULT 0,
          position_y FLOAT DEFAULT 0,
          node_data NVARCHAR(MAX), -- JSON data
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_FlowNodes_WorkflowId FOREIGN KEY (workflow_id) REFERENCES tblWorkflows(id) ON DELETE CASCADE,
          
          -- Unique constraint for node_id per workflow
          CONSTRAINT UQ_FlowNodes_WorkflowNodeId UNIQUE (workflow_id, node_id),
          
          -- Indexes for performance
          INDEX IX_FlowNodes_WorkflowId (workflow_id),
          INDEX IX_FlowNodes_NodeType (node_type),
          INDEX IX_FlowNodes_NodeId (node_id)
        );
        PRINT '✅ tblFlowNodes table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblFlowNodes table already exists';
      END
    `);

    // 4. Create tblFlowEdges table
    console.log('\n🔀 Creating tblFlowEdges table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tblFlowEdges' AND xtype='U')
      BEGIN
        CREATE TABLE tblFlowEdges (
          id INT IDENTITY(1,1) PRIMARY KEY,
          workflow_id INT NOT NULL,
          edge_id NVARCHAR(255) NOT NULL,
          source_node_id NVARCHAR(255) NOT NULL,
          target_node_id NVARCHAR(255) NOT NULL,
          edge_data NVARCHAR(MAX), -- JSON data
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          
          -- Foreign key constraint
          CONSTRAINT FK_FlowEdges_WorkflowId FOREIGN KEY (workflow_id) REFERENCES tblWorkflows(id) ON DELETE CASCADE,
          
          -- Unique constraint for edge_id per workflow
          CONSTRAINT UQ_FlowEdges_WorkflowEdgeId UNIQUE (workflow_id, edge_id),
          
          -- Indexes for performance
          INDEX IX_FlowEdges_WorkflowId (workflow_id),
          INDEX IX_FlowEdges_SourceNode (source_node_id),
          INDEX IX_FlowEdges_TargetNode (target_node_id),
          INDEX IX_FlowEdges_EdgeId (edge_id)
        );
        PRINT '✅ tblFlowEdges table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️ tblFlowEdges table already exists';
      END
    `);

    console.log('\n🎉 All workflow tables created successfully!');
    console.log('\n📊 Table Summary:');
    console.log('  • tblWorkflows - Store workflow metadata and ownership');
    console.log('  • tblWorkflowConfigs - Store workflow configuration settings');
    console.log('  • tblFlowNodes - Store visual flow builder nodes');
    console.log('  • tblFlowEdges - Store connections between nodes');

  } catch (error) {
    console.error('❌ Error creating workflow tables:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
createWorkflowTables()
  .then(() => {
    console.log('\n✅ Workflow database schema setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to setup workflow database schema:', error);
    process.exit(1);
  });
