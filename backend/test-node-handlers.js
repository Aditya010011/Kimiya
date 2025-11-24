/**
 * Test Suite for Node Type Handlers
 * Tests all implemented node types in executeNode() method
 */

const ConversationRelay = require('./services/conversationRelay.js');

console.log('🧪 Starting Node Type Handlers Test Suite...\n');

// Mock call data
const mockCallData = {
  workflowData: {
    workflowId: 'test-workflow',
    globalPrompt: 'You are a helpful AI assistant for testing.',
    nodes: [],
    edges: []
  },
  conversationHistory: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ],
  currentNode: 'test-node',
  isActive: true
};

// Initialize ConversationRelay
const conversationRelay = new ConversationRelay({});

// Test counter
let testsRun = 0;
let testsPassed = 0;

// Helper function to run a test
async function runTest(testName, nodeType, nodeData, expectedAction, expectedMetadata = null) {
  testsRun++;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST ${testsRun}: ${testName}`);
  console.log(`${'='.repeat(60)}`);
  
  const testNode = {
    id: `test-node-${testsRun}`,
    type: nodeType,
    data: nodeData
  };
  
  console.log(`Node Type: ${nodeType}`);
  console.log(`Node Data:`, JSON.stringify(nodeData, null, 2));
  
  try {
    const result = await conversationRelay.executeNode(testNode, 'Test user input', mockCallData);
    
    console.log(`\n✓ Result:`, JSON.stringify(result, null, 2));
    
    // Validate result
    if (!result.response) {
      console.log(`❌ FAILED: No response returned`);
      return;
    }
    
    if (result.action !== expectedAction) {
      console.log(`❌ FAILED: Expected action '${expectedAction}', got '${result.action}'`);
      return;
    }
    
    if (expectedMetadata && result.metadata) {
      const metadataMatch = Object.keys(expectedMetadata).every(key => 
        result.metadata[key] === expectedMetadata[key]
      );
      if (!metadataMatch) {
        console.log(`⚠️  WARNING: Metadata mismatch`);
        console.log(`   Expected:`, expectedMetadata);
        console.log(`   Got:`, result.metadata);
      }
    }
    
    testsPassed++;
    console.log(`\n✅ TEST PASSED`);
    
  } catch (error) {
    console.log(`\n❌ TEST FAILED with error:`, error.message);
  }
}

// Run all tests
(async () => {
  
  // Test 1: Start Node
  await runTest(
    'Start Node Handler',
    'startNode',
    {
      firstMessage: 'Welcome to our service!',
      globalPrompt: 'You are a customer service assistant.'
    },
    'speak',
    { nodeType: 'start' }
  );
  
  // Test 2: Start Node (case variation)
  await runTest(
    'Start Node Handler (case insensitive)',
    'StartCall',
    {
      firstMessage: 'Hello and welcome!'
    },
    'speak',
    { nodeType: 'start' }
  );
  
  // Test 3: Conversation Node
  await runTest(
    'Conversation Node Handler',
    'conversationNode',
    {
      prompt: 'Help the user with their property inquiry. Be professional and helpful.',
      model: 'gpt-4o'
    },
    'speak',
    { nodeType: 'conversation' }
  );
  
  // Test 4: AI Node (alias for conversation)
  await runTest(
    'AI Node Handler (conversation alias)',
    'ai',
    {
      systemPrompt: 'You are a sales assistant.'
    },
    'speak',
    { nodeType: 'conversation' }
  );
  
  // Test 5: End Node
  await runTest(
    'End Node Handler',
    'endCall',
    {
      endMessage: 'Thank you for calling. Goodbye!',
      reason: 'completed'
    },
    'end',
    { nodeType: 'end', reason: 'completed' }
  );
  
  // Test 6: End Node (case variation)
  await runTest(
    'End Node Handler (case insensitive)',
    'EndNode',
    {
      farewell: 'Have a great day!'
    },
    'end',
    { nodeType: 'end' }
  );
  
  // Test 7: Transfer Node (not functional)
  await runTest(
    'Transfer Node Handler (not functional)',
    'transferCall',
    {
      destination: '+1234567890',
      transferMessage: 'Transferring to agent'
    },
    'speak',
    { nodeType: 'transfer', status: 'not_implemented' }
  );
  
  // Test 8: API Request Node (not functional)
  await runTest(
    'API Request Node Handler (not functional)',
    'apiRequest',
    {
      method: 'GET',
      url: 'https://api.example.com/data'
    },
    'speak',
    { nodeType: 'api', status: 'not_implemented', fallbackUsed: true }
  );
  
  // Test 9: Legacy Greeting Node
  await runTest(
    'Legacy Greeting Node Handler',
    'greeting',
    {
      message: 'Hello! Welcome to our service.'
    },
    'speak'
  );
  
  // Test 10: Unknown Node Type (fallback)
  await runTest(
    'Unknown Node Type Handler (fallback)',
    'unknownNodeType',
    {
      someData: 'test'
    },
    'speak',
    { nodeType: 'unknown', fallbackUsed: true }
  );
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log(`${'='.repeat(60)}`);
  console.log(`Total Tests: ${testsRun}`);
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsRun - testsPassed}`);
  console.log(`Success Rate: ${((testsPassed / testsRun) * 100).toFixed(1)}%`);
  
  if (testsPassed === testsRun) {
    console.log(`\n✅ ALL TESTS PASSED! 🎉`);
  } else {
    console.log(`\n⚠️  Some tests failed. Please review the output above.`);
  }
  
})();

