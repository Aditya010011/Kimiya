import React, { useState } from 'react';
import { databaseService, DatabaseHealthStatus, DatabaseQueryResult } from '../services/databaseService';

interface TestResults {
  connection?: DatabaseHealthStatus;
  query?: DatabaseQueryResult;
  tables?: DatabaseQueryResult;
  createTable?: DatabaseQueryResult;
  createLog?: DatabaseQueryResult;
  getLogs?: DatabaseQueryResult;
}

const DatabaseTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResults>({});
  const [activeTest, setActiveTest] = useState<string>('');

  const runTest = async (testName: string, testFunction: () => Promise<any>) => {
    setLoading(true);
    setActiveTest(testName);
    
    try {
      const result = await testFunction();
      setResults(prev => ({ ...prev, [testName]: result }));
    } catch (error) {
      setResults(prev => ({ 
        ...prev, 
        [testName]: { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        } 
      }));
    } finally {
      setLoading(false);
      setActiveTest('');
    }
  };

  const runFullTest = async () => {
    setLoading(true);
    setActiveTest('fullTest');
    
    try {
      const fullResults = await databaseService.runFullTest();
      setResults(fullResults);
    } catch (error) {
      console.error('Full test failed:', error);
    } finally {
      setLoading(false);
      setActiveTest('');
    }
  };

  const renderResult = (result: any, title: string) => {
    if (!result) return null;

    return (
      <div className="mt-4 p-4 border rounded-lg">
        <h4 className="font-semibold text-lg mb-2">{title}</h4>
        <div className={`p-3 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <div className="font-medium">
            Status: {result.success ? '✅ Success' : '❌ Failed'}
          </div>
          {result.message && (
            <div className="mt-1">Message: {result.message}</div>
          )}
          {result.error && (
            <div className="mt-1">Error: {result.error}</div>
          )}
          {result.sqlError && (
            <div className="mt-1 text-sm">SQL Error: {result.sqlError}</div>
          )}
        </div>
        
        {result.data && (
          <div className="mt-3">
            <div className="font-medium mb-2">Data:</div>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto max-h-40">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        {result.database && (
          <div className="mt-3">
            <div className="font-medium mb-2">Database Info:</div>
            <div className="bg-gray-100 p-2 rounded text-sm">
              <div>Server: {result.database.server}</div>
              <div>Database: {result.database.database}</div>
              <div>Status: {result.database.status}</div>
              <div>Connected: {result.database.connected ? 'Yes' : 'No'}</div>
              {result.database.responseTime && (
                <div>Response Time: {result.database.responseTime}</div>
              )}
            </div>
          </div>
        )}

        {result.tables && (
          <div className="mt-3">
            <div className="font-medium mb-2">Tables ({result.tables.length}):</div>
            <div className="bg-gray-100 p-2 rounded text-sm max-h-40 overflow-auto">
              {result.tables.map((table: any, index: number) => (
                <div key={index} className="mb-1">
                  {table.TABLE_SCHEMA}.{table.TABLE_NAME} ({table.TABLE_TYPE})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Database Connection Test</h2>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Individual Tests</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <button
            onClick={() => runTest('connection', databaseService.testConnection)}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading && activeTest === 'connection' ? 'Testing...' : 'Test Connection'}
          </button>
          
          <button
            onClick={() => runTest('query', databaseService.executeTestQuery)}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {loading && activeTest === 'query' ? 'Running...' : 'Test Query'}
          </button>
          
          <button
            onClick={() => runTest('tables', databaseService.getTables)}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading && activeTest === 'tables' ? 'Loading...' : 'Get Tables'}
          </button>
          
          <button
            onClick={() => runTest('createTable', databaseService.createLogsTable)}
            disabled={loading}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {loading && activeTest === 'createTable' ? 'Creating...' : 'Create Logs Table'}
          </button>
          
          <button
            onClick={() => runTest('createLog', () => databaseService.createLogEntry('Test log from frontend', 'INFO', 'React'))}
            disabled={loading}
            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
          >
            {loading && activeTest === 'createLog' ? 'Creating...' : 'Create Log Entry'}
          </button>
          
          <button
            onClick={() => runTest('getLogs', () => databaseService.getLogs(10))}
            disabled={loading}
            className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50"
          >
            {loading && activeTest === 'getLogs' ? 'Loading...' : 'Get Logs'}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={runFullTest}
          disabled={loading}
          className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-semibold"
        >
          {loading && activeTest === 'fullTest' ? 'Running Full Test...' : 'Run Full Database Test'}
        </button>
      </div>

      <div className="space-y-4">
        {renderResult(results.connection, 'Connection Test')}
        {renderResult(results.query, 'Query Test')}
        {renderResult(results.tables, 'Tables List')}
        {renderResult(results.createTable, 'Create Logs Table')}
        {renderResult(results.createLog, 'Create Log Entry')}
        {renderResult(results.getLogs, 'Get Log Entries')}
      </div>
    </div>
  );
};

export default DatabaseTest;
