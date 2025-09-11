# Database Integration Guide

This document explains how to use the MSSQL database integration that has been added to the Kimiya Voice application.

## Table Naming Convention

All database tables follow the naming convention: **`tbl` + `CamelCase`**

Examples:
- `users` → `tblUsers`
- `workflow_templates` → `tblWorkflowTemplates`
- `user_sessions` → `tblUserSessions`
- `call_logs` → `tblCallLogs`

## Database Configuration

The application is configured to connect to an Azure SQL Database with the following connection details:

- **Server**: `developmentdbpool.database.windows.net`
- **Database**: `Kimiya_Voice`
- **User**: `Aditya`
- **Password**: `AiPhone2025QW`
- **Port**: `1433`
- **Encryption**: `true`

## Environment Variables

The database configuration is stored in the `backend/.env.development` file:

```bash
# Database Configuration (MSSQL)
DB_SERVER=developmentdbpool.database.windows.net
DB_DATABASE=Kimiya_Voice
DB_USER=Aditya
DB_PASSWORD=AiPhone2025QW
DB_PORT=1433
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false
```

## Backend Integration

### Database Service

The main database service is located at `backend/services/database.js` and provides:

- Connection pooling
- Query execution
- Stored procedure execution
- Transaction support
- Health monitoring
- Graceful shutdown handling

### API Endpoints

The following database-related endpoints are available:

#### Health Check
- `GET /api/database-health` - Get database connection status

#### Database Operations
- `GET /api/database/test-connection` - Test database connection
- `GET /api/database/test-query` - Execute a simple test query
- `GET /api/database/tables` - List all database tables
- `POST /api/database/create-logs-table` - Create the logs table
- `POST /api/database/log-entry` - Create a new log entry
- `GET /api/database/logs?limit=10` - Get recent log entries

### Usage Examples

#### Basic Query
```javascript
const databaseService = require('./services/database');

// Simple query using new table naming convention
const result = await databaseService.query('SELECT * FROM tblLogs WHERE level = @level', {
  level: 'ERROR'
});

// With transaction
const transaction = await databaseService.beginTransaction();
try {
  const request = transaction.request();
  request.input('message', 'Test message');
  await request.query('INSERT INTO logs (message) VALUES (@message)');
  await transaction.commit();
} catch (error) {
  await transaction.rollback();
  throw error;
}
```

## Frontend Integration

### Database Service

The frontend database service is located at `src/services/databaseService.ts` and provides:

- TypeScript interfaces for database operations
- API calls to backend database endpoints
- Error handling
- Full test suite functionality

### React Component

A test component is available at `src/components/DatabaseTest.tsx` that demonstrates:

- Connection testing
- Query execution
- Table management
- Log entry creation and retrieval

### Usage Example

```typescript
import { databaseService } from '../services/databaseService';

// Test connection
const healthStatus = await databaseService.getHealthStatus();

// Create log entry
const result = await databaseService.createLogEntry(
  'User action completed',
  'INFO',
  'Frontend'
);

// Get recent logs
const logs = await databaseService.getLogs(10);
```

## Testing

### Backend Test

Run the database test script:

```bash
cd backend
node test-database.cjs
```

This will:
1. Test the database connection
2. Execute a sample query
3. List database tables
4. Create a logs table
5. Insert a test log entry
6. Retrieve recent log entries

### Frontend Test

Add the `DatabaseTest` component to your React application to test database operations from the frontend.

## Database Schema

### Logs Table

The application creates a simple logs table for demonstration:

```sql
CREATE TABLE logs (
  id INT IDENTITY(1,1) PRIMARY KEY,
  message NVARCHAR(MAX) NOT NULL,
  level NVARCHAR(50) DEFAULT 'INFO',
  source NVARCHAR(100) DEFAULT 'API',
  created_at DATETIME2 DEFAULT GETDATE()
)
```

## Security Considerations

1. **Environment Variables**: Database credentials are stored in environment variables, never hardcoded
2. **Backend-Only Access**: Database credentials are only accessible to the backend server
3. **Frontend API Access**: Frontend accesses database through secure API endpoints, not direct connections
4. **Connection Encryption**: All connections use SSL/TLS encryption
5. **Parameterized Queries**: All queries use parameterized inputs to prevent SQL injection
6. **Connection Pooling**: Efficient connection management with automatic cleanup
7. **Error Handling**: Comprehensive error handling without exposing sensitive information
8. **Validation**: Required environment variables are validated on startup

## Troubleshooting

### Common Issues

1. **Connection Timeout**: Increase `connectionTimeout` in database config
2. **SSL Certificate Issues**: Set `trustServerCertificate: true` for development
3. **Firewall Issues**: Ensure Azure SQL firewall allows your IP address
4. **Authentication Errors**: Verify username and password are correct

### Debug Mode

Enable debug logging by setting environment variable:
```bash
DEBUG=mssql* node server.js
```

## Next Steps

1. **Add More Tables**: Create additional tables for your application data
2. **Implement Models**: Create data models for your entities
3. **Add Migrations**: Implement database migration system
4. **Add Caching**: Implement Redis or in-memory caching for frequently accessed data
5. **Add Monitoring**: Implement database performance monitoring

## Support

For issues with the database integration, check:
1. Database connection logs in the backend console
2. API endpoint responses for error details
3. Azure SQL Database metrics in the Azure portal
4. Network connectivity between your application and Azure SQL
