/**
 * Table Naming Convention Utilities
 * Handles the "tbl" + camelCase naming convention for database tables
 * 
 * Examples:
 * - users -> tblUsers
 * - workflow_templates -> tblWorkflowTemplates
 * - user_sessions -> tblUserSessions
 */

/**
 * Convert a table name to the standard naming convention
 * @param {string} tableName - The base table name (e.g., 'users', 'workflow_templates')
 * @returns {string} - The formatted table name (e.g., 'tblUsers', 'tblWorkflowTemplates')
 */
function formatTableName(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Table name must be a non-empty string');
  }

  // If already formatted, return as-is
  if (tableName.startsWith('tbl')) {
    return tableName;
  }

  // Convert snake_case or kebab-case to camelCase
  const camelCase = tableName
    .toLowerCase()
    .split(/[_-]/)
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');

  return `tbl${camelCase}`;
}

/**
 * Extract the base table name from a formatted table name
 * @param {string} formattedTableName - The formatted table name (e.g., 'tblUsers')
 * @returns {string} - The base table name (e.g., 'users')
 */
function extractBaseName(formattedTableName) {
  if (!formattedTableName || typeof formattedTableName !== 'string') {
    throw new Error('Formatted table name must be a non-empty string');
  }

  if (!formattedTableName.startsWith('tbl')) {
    return formattedTableName;
  }

  // Remove 'tbl' prefix and convert to snake_case
  const withoutPrefix = formattedTableName.slice(3);
  
  // Convert camelCase to snake_case
  const snakeCase = withoutPrefix
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, ''); // Remove leading underscore

  return snakeCase;
}

/**
 * Validate that a table name follows the naming convention
 * @param {string} tableName - The table name to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidTableName(tableName) {
  if (!tableName || typeof tableName !== 'string') {
    return false;
  }

  // Must start with 'tbl' followed by a capital letter
  const pattern = /^tbl[A-Z][a-zA-Z0-9]*$/;
  return pattern.test(tableName);
}

/**
 * Get all standard table names used in the application
 * @returns {Object} - Object with base names as keys and formatted names as values
 */
function getStandardTableNames() {
  const baseTables = [
    'users',
    'logs',
    'workflow_templates',
    'user_sessions',
    'call_logs',
    'conversation_history',
    'ai_models',
    'twilio_configs',
    'performance_metrics'
  ];

  const tableMap = {};
  baseTables.forEach(baseName => {
    tableMap[baseName] = formatTableName(baseName);
  });

  return tableMap;
}

/**
 * Create a mapping of old table names to new table names for migration
 * @returns {Object} - Object with old names as keys and new names as values
 */
function getMigrationMapping() {
  return {
    'users': 'tblUsers',
    'logs': 'tblLogs',
    'workflow_templates': 'tblWorkflowTemplates',
    'user_sessions': 'tblUserSessions',
    'call_logs': 'tblCallLogs',
    'conversation_history': 'tblConversationHistory',
    'ai_models': 'tblAiModels',
    'twilio_configs': 'tblTwilioConfigs',
    'performance_metrics': 'tblPerformanceMetrics'
  };
}

/**
 * Generate SQL to rename a table
 * @param {string} oldName - The current table name
 * @param {string} newName - The new table name
 * @returns {string} - SQL statement to rename the table
 */
function generateRenameSQL(oldName, newName) {
  if (!oldName || !newName) {
    throw new Error('Both old and new table names are required');
  }

  return `
    -- Rename table from ${oldName} to ${newName}
    IF EXISTS (SELECT * FROM sysobjects WHERE name='${oldName}' AND xtype='U')
    BEGIN
      EXEC sp_rename '${oldName}', '${newName}';
      PRINT 'Table ${oldName} renamed to ${newName}';
    END
    ELSE
    BEGIN
      PRINT 'Table ${oldName} does not exist, skipping rename';
    END
  `.trim();
}

/**
 * Generate SQL to check if a table exists with the new naming convention
 * @param {string} tableName - The table name to check
 * @returns {string} - SQL statement to check table existence
 */
function generateTableExistsSQL(tableName) {
  const formattedName = formatTableName(tableName);
  return `
    SELECT CASE 
      WHEN EXISTS (SELECT * FROM sysobjects WHERE name='${formattedName}' AND xtype='U')
      THEN 1 
      ELSE 0 
    END as table_exists
  `.trim();
}

module.exports = {
  formatTableName,
  extractBaseName,
  isValidTableName,
  getStandardTableNames,
  getMigrationMapping,
  generateRenameSQL,
  generateTableExistsSQL
};
