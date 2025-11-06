/**
 * Create Knowledge Base Tables
 * Creates tables for RAG (Retrieval-Augmented Generation) functionality
 */

const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.development') });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function createKnowledgeBaseTables() {
  let pool;
  
  try {
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database');

    // Create tblKnowledgeBases table
    console.log('\n📦 Creating tblKnowledgeBases table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblKnowledgeBases')
      BEGIN
        CREATE TABLE tblKnowledgeBases (
          id VARCHAR(50) PRIMARY KEY,
          user_id INT NOT NULL,
          organization_id VARCHAR(50),
          name NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX),
          embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
          chunk_size INT DEFAULT 1000,
          chunk_overlap INT DEFAULT 200,
          vector_collection_name VARCHAR(255),
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETDATE(),
          updated_at DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES tblUsers(id)
        );
        
        CREATE INDEX idx_kb_user_id ON tblKnowledgeBases(user_id);
        CREATE INDEX idx_kb_org_id ON tblKnowledgeBases(organization_id);
        CREATE INDEX idx_kb_is_active ON tblKnowledgeBases(is_active);
        
        PRINT '✅ tblKnowledgeBases table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️  tblKnowledgeBases table already exists';
      END
    `);

    // Create tblDocuments table
    console.log('\n📄 Creating tblDocuments table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblDocuments')
      BEGIN
        CREATE TABLE tblDocuments (
          id VARCHAR(50) PRIMARY KEY,
          knowledge_base_id VARCHAR(50) NOT NULL,
          filename NVARCHAR(255) NOT NULL,
          file_type VARCHAR(100),
          file_size BIGINT,
          file_path NVARCHAR(MAX),
          chunk_count INT DEFAULT 0,
          processing_status VARCHAR(20) DEFAULT 'pending',
          error_message NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE(),
          processed_at DATETIME2,
          FOREIGN KEY (knowledge_base_id) REFERENCES tblKnowledgeBases(id) ON DELETE CASCADE
        );
        
        CREATE INDEX idx_doc_kb_id ON tblDocuments(knowledge_base_id);
        CREATE INDEX idx_doc_status ON tblDocuments(processing_status);
        CREATE INDEX idx_doc_created ON tblDocuments(created_at);
        
        PRINT '✅ tblDocuments table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️  tblDocuments table already exists';
      END
    `);

    // Create tblDocumentChunks table
    console.log('\n📝 Creating tblDocumentChunks table...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tblDocumentChunks')
      BEGIN
        CREATE TABLE tblDocumentChunks (
          id VARCHAR(50) PRIMARY KEY,
          document_id VARCHAR(50) NOT NULL,
          chunk_index INT NOT NULL,
          chunk_text NVARCHAR(MAX) NOT NULL,
          vector_id VARCHAR(100),
          token_count INT,
          metadata NVARCHAR(MAX),
          created_at DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (document_id) REFERENCES tblDocuments(id) ON DELETE CASCADE
        );
        
        CREATE INDEX idx_chunk_doc_id ON tblDocumentChunks(document_id);
        CREATE INDEX idx_chunk_vector_id ON tblDocumentChunks(vector_id);
        CREATE INDEX idx_chunk_index ON tblDocumentChunks(chunk_index);
        
        PRINT '✅ tblDocumentChunks table created successfully';
      END
      ELSE
      BEGIN
        PRINT '⚠️  tblDocumentChunks table already exists';
      END
    `);

    console.log('\n✅ All Knowledge Base tables created successfully!');
    console.log('\n📊 Tables created:');
    console.log('  1. tblKnowledgeBases - Stores knowledge base configurations');
    console.log('  2. tblDocuments - Stores uploaded documents');
    console.log('  3. tblDocumentChunks - Stores text chunks with vector references');

  } catch (error) {
    console.error('❌ Error creating Knowledge Base tables:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
createKnowledgeBaseTables()
  .then(() => {
    console.log('\n🎉 Knowledge Base tables setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed to create Knowledge Base tables:', error);
    process.exit(1);
  });

