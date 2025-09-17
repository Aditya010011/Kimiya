const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper Functions - Defined at the top to avoid hoisting issues
 */

/**
 * Clean node data for database storage
 */
function cleanNodeData(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const cleaned = { ...data };

  // Remove circular references and non-serializable data
  delete cleaned.component;
  delete cleaned.__reactInternalInstance;
  delete cleaned.__reactInternalMemoizedUnmaskedChildContext;

  // Ensure all values are serializable
  Object.keys(cleaned).forEach(key => {
    if (typeof cleaned[key] === 'function') {
      delete cleaned[key];
    } else if (cleaned[key] && typeof cleaned[key] === 'object') {
      try {
        JSON.stringify(cleaned[key]);
      } catch (error) {
        console.warn(`Removing non-serializable property: ${key}`);
        delete cleaned[key];
      }
    }
  });

  return cleaned;
}

/**
 * Clean edge data for database storage
 */
function cleanEdgeData(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const cleaned = { ...data };

  // Remove React Flow internal properties
  delete cleaned.sourceHandle;
  delete cleaned.targetHandle;
  delete cleaned.sourceX;
  delete cleaned.sourceY;
  delete cleaned.targetX;
  delete cleaned.targetY;

  return cleaned;
}

/**
 * Validate and normalize edge type for React Flow
 */
function validateEdgeType(edgeType) {
  // Valid React Flow edge types
  const validEdgeTypes = ['default', 'straight', 'step', 'smoothstep', 'conditional'];

  // If no type or invalid type, default to 'default'
  if (!edgeType || !validEdgeTypes.includes(edgeType)) {
    return 'default';
  }

  return edgeType;
}

/**
 * Serialize configuration value with type detection
 */
function serializeConfigValue(value) {
  if (value === null || value === undefined) {
    return { configValue: '', configType: 'string' };
  }

  if (typeof value === 'boolean') {
    return { configValue: value.toString(), configType: 'boolean' };
  }

  if (typeof value === 'number') {
    return { configValue: value.toString(), configType: 'number' };
  }

  if (Array.isArray(value)) {
    return { configValue: JSON.stringify(value), configType: 'array' };
  }

  if (typeof value === 'object') {
    return { configValue: JSON.stringify(value), configType: 'json' };
  }

  return { configValue: value.toString(), configType: 'string' };
}

/**
 * GET /api/workflows/my
 * Get workflows created by the current user only
 */
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get user's own workflows with pagination
    const workflows = await databaseService.query(`
      SELECT
        w.id,
        w.name,
        w.description,
        w.is_active,
        w.created_at,
        w.updated_at,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM tblFlowNodes WHERE workflow_id = w.id) as node_count,
        (SELECT COUNT(*) FROM tblFlowEdges WHERE workflow_id = w.id) as edge_count
      FROM tblWorkflows w
      LEFT JOIN tblUsers u ON w.created_by = u.id
      WHERE w.created_by = @userId AND w.is_active = 1
      ORDER BY w.updated_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { userId, offset, limit });

    // Get total count for pagination
    const totalResult = await databaseService.query(`
      SELECT COUNT(*) as total
      FROM tblWorkflows
      WHERE created_by = @userId AND is_active = 1
    `, { userId });

    const total = totalResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        workflows: workflows.recordset || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get my workflows error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows',
      message: error.message
    });
  }
});

/**
 * GET /api/workflows
 * Get all workflows (visible to all authenticated users)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get all workflows with pagination (removed user filtering)
    const workflows = await databaseService.query(`
      SELECT
        w.id,
        w.name,
        w.description,
        w.is_active,
        w.created_at,
        w.updated_at,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM tblFlowNodes WHERE workflow_id = w.id) as node_count,
        (SELECT COUNT(*) FROM tblFlowEdges WHERE workflow_id = w.id) as edge_count
      FROM tblWorkflows w
      LEFT JOIN tblUsers u ON w.created_by = u.id
      WHERE w.is_active = 1
      ORDER BY w.updated_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    // Get total count for pagination (removed user filtering)
    const totalResult = await databaseService.query(`
      SELECT COUNT(*) as total
      FROM tblWorkflows
      WHERE is_active = 1
    `, {});

    const total = totalResult.recordset[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        workflows: workflows.recordset,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get workflows error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows',
      message: error.message
    });
  }
});

/**
 * GET /api/workflows/:id
 * Get a specific workflow with full configuration (accessible to all users)
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);

    // Get workflow details (removed user ownership check)
    const workflowResult = await databaseService.query(`
      SELECT
        w.id,
        w.name,
        w.description,
        w.is_active,
        w.created_at,
        w.updated_at,
        u.email as created_by_email
      FROM tblWorkflows w
      LEFT JOIN tblUsers u ON w.created_by = u.id
      WHERE w.id = @workflowId AND w.is_active = 1
    `, { workflowId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to access it'
      });
    }

    const workflow = workflowResult.recordset[0];

    // Get workflow configurations
    const configsResult = await databaseService.query(`
      SELECT config_key, config_value, config_type
      FROM tblWorkflowConfigs
      WHERE workflow_id = @workflowId
      ORDER BY config_key
    `, { workflowId });

    // Convert configs to object
    const configs = {};
    configsResult.recordset.forEach(config => {
      let value = config.config_value;
      
      // Parse value based on type
      try {
        switch (config.config_type) {
          case 'json':
            value = JSON.parse(value);
            break;
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value === 'true';
            break;
          case 'array':
            value = JSON.parse(value);
            break;
          default:
            // Keep as string
            break;
        }
      } catch (e) {
        console.warn(`Failed to parse config ${config.config_key}:`, e.message);
      }
      
      configs[config.config_key] = value;
    });

    workflow.configs = configs;

    res.json({
      success: true,
      data: { workflow }
    });

  } catch (error) {
    console.error('Get workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow',
      message: error.message
    });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, configs = {} } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Workflow name is required'
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Workflow name must be less than 255 characters'
      });
    }

    // Start transaction
    const transaction = await databaseService.beginTransaction();

    try {
      // Create workflow
      const workflowResult = await databaseService.query(`
        INSERT INTO tblWorkflows (name, description, created_by, created_at, updated_at)
        OUTPUT INSERTED.id
        VALUES (@name, @description, @userId, GETDATE(), GETDATE())
      `, { name: name.trim(), description: description || null, userId }, transaction);

      const workflowId = workflowResult.recordset[0].id;

      // Insert configurations if provided
      if (Object.keys(configs).length > 0) {
        for (const [key, value] of Object.entries(configs)) {
          let configValue = value;
          let configType = 'string';

          // Determine config type and serialize value
          if (typeof value === 'object' && value !== null) {
            configValue = JSON.stringify(value);
            configType = Array.isArray(value) ? 'array' : 'json';
          } else if (typeof value === 'number') {
            configValue = value.toString();
            configType = 'number';
          } else if (typeof value === 'boolean') {
            configValue = value.toString();
            configType = 'boolean';
          }

          await databaseService.query(`
            INSERT INTO tblWorkflowConfigs (workflow_id, config_key, config_value, config_type, created_at, updated_at)
            VALUES (@workflowId, @configKey, @configValue, @configType, GETDATE(), GETDATE())
          `, { 
            workflowId, 
            configKey: key, 
            configValue: configValue.toString(), 
            configType 
          }, transaction);
        }
      }

      await databaseService.commitTransaction(transaction);

      // Return created workflow
      const createdWorkflow = await databaseService.query(`
        SELECT 
          w.id,
          w.name,
          w.description,
          w.is_active,
          w.created_at,
          w.updated_at,
          u.email as created_by_email
        FROM tblWorkflows w
        LEFT JOIN tblUsers u ON w.created_by = u.id
        WHERE w.id = @workflowId
      `, { workflowId });

      res.status(201).json({
        success: true,
        data: { workflow: createdWorkflow.recordset[0] },
        message: 'Workflow created successfully'
      });

    } catch (error) {
      await databaseService.rollbackTransaction(transaction);
      throw error;
    }

  } catch (error) {
    console.error('Create workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create workflow',
      message: error.message
    });
  }
});

/**
 * PUT /api/workflows/:id
 * Update an existing workflow
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { name, description, configs = {} } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Workflow name is required'
      });
    }

    if (name.length > 255) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Workflow name must be less than 255 characters'
      });
    }

    // Check if workflow exists (removed user ownership check)
    const existingWorkflow = await databaseService.query(`
      SELECT id FROM tblWorkflows
      WHERE id = @workflowId AND is_active = 1
    `, { workflowId });

    if (existingWorkflow.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist'
      });
    }

    // Start transaction
    const transaction = await databaseService.beginTransaction();

    try {
      // Update workflow
      await databaseService.query(`
        UPDATE tblWorkflows
        SET name = @name, description = @description, updated_at = GETDATE()
        WHERE id = @workflowId
      `, { workflowId, name: name.trim(), description: description || null }, transaction);

      // Delete existing configs
      await databaseService.query(`
        DELETE FROM tblWorkflowConfigs WHERE workflow_id = @workflowId
      `, { workflowId }, transaction);

      // Insert new configurations
      if (Object.keys(configs).length > 0) {
        for (const [key, value] of Object.entries(configs)) {
          let configValue = value;
          let configType = 'string';

          // Determine config type and serialize value
          if (typeof value === 'object' && value !== null) {
            configValue = JSON.stringify(value);
            configType = Array.isArray(value) ? 'array' : 'json';
          } else if (typeof value === 'number') {
            configValue = value.toString();
            configType = 'number';
          } else if (typeof value === 'boolean') {
            configValue = value.toString();
            configType = 'boolean';
          }

          await databaseService.query(`
            INSERT INTO tblWorkflowConfigs (workflow_id, config_key, config_value, config_type, created_at, updated_at)
            VALUES (@workflowId, @configKey, @configValue, @configType, GETDATE(), GETDATE())
          `, { 
            workflowId, 
            configKey: key, 
            configValue: configValue.toString(), 
            configType 
          }, transaction);
        }
      }

      await databaseService.commitTransaction(transaction);

      // Return updated workflow
      const updatedWorkflow = await databaseService.query(`
        SELECT 
          w.id,
          w.name,
          w.description,
          w.is_active,
          w.created_at,
          w.updated_at,
          u.email as created_by_email
        FROM tblWorkflows w
        LEFT JOIN tblUsers u ON w.created_by = u.id
        WHERE w.id = @workflowId
      `, { workflowId });

      res.json({
        success: true,
        data: { workflow: updatedWorkflow.recordset[0] },
        message: 'Workflow updated successfully'
      });

    } catch (error) {
      await databaseService.rollbackTransaction(transaction);
      throw error;
    }

  } catch (error) {
    console.error('Update workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow',
      message: error.message
    });
  }
});

/**
 * DELETE /api/workflows/:id
 * Soft delete a workflow (set is_active = false)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if workflow exists (removed user ownership check)
    const existingWorkflow = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND is_active = 1
    `, { workflowId });

    if (existingWorkflow.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist'
      });
    }

    // Soft delete workflow
    await databaseService.query(`
      UPDATE tblWorkflows
      SET is_active = 0, updated_at = GETDATE()
      WHERE id = @workflowId
    `, { workflowId });

    res.json({
      success: true,
      message: `Workflow "${existingWorkflow.recordset[0].name}" deleted successfully`
    });

  } catch (error) {
    console.error('Delete workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete workflow',
      message: error.message
    });
  }
});

/**
 * GET /api/workflows/:id/flow
 * Get complete flow data (nodes + edges) for a workflow (accessible to all users)
 */
router.get('/:id/flow', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);

    // Check if workflow exists (removed user ownership check)
    const workflowResult = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND is_active = 1
    `, { workflowId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to access it'
      });
    }

    // Get complete flow data using helper function
    const flowData = await getCompleteWorkflowFlow(workflowId);

    res.json({
      success: true,
      data: {
        workflow: workflowResult.recordset[0],
        nodes: flowData.nodes,
        edges: flowData.edges,
        configs: flowData.configs
      }
    });

  } catch (error) {
    console.error('Get workflow flow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow flow',
      message: error.message
    });
  }
});

/**
 * PUT /api/workflows/:id/flow
 * Save complete flow state (nodes + edges) for a workflow
 */
router.put('/:id/flow', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const { nodes = [], edges = [], configs = {} } = req.body;
    const userId = req.user.id;

    // Enhanced validation
    const validationResult = validateWorkflowFlow({ nodes, edges, configs });
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Invalid workflow data',
        details: validationResult.errors
      });
    }

    // Check if workflow exists (removed user ownership check)
    const workflowResult = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND is_active = 1
    `, { workflowId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist'
      });
    }

    // Start transaction for atomic operation
    const transaction = await databaseService.beginTransaction();

    try {
      // Delete existing flow data
      await databaseService.query(`
        DELETE FROM tblFlowNodes WHERE workflow_id = @workflowId
      `, { workflowId }, transaction);

      await databaseService.query(`
        DELETE FROM tblFlowEdges WHERE workflow_id = @workflowId
      `, { workflowId }, transaction);

      // Insert new nodes with enhanced data handling
      for (const node of nodes) {
        const { id, type, position = { x: 0, y: 0 }, data = {} } = node;

        // Clean and validate node data
        const cleanData = cleanNodeData(data);

        await databaseService.query(`
          INSERT INTO tblFlowNodes (
            workflow_id, node_id, node_type, position_x, position_y, node_data, created_at, updated_at
          )
          VALUES (
            @workflowId, @nodeId, @nodeType, @positionX, @positionY, @nodeData, GETDATE(), GETDATE()
          )
        `, {
          workflowId,
          nodeId: id,
          nodeType: type,
          positionX: position.x || 0,
          positionY: position.y || 0,
          nodeData: JSON.stringify(cleanData)
        }, transaction);
      }

      // Insert new edges with enhanced data handling
      for (const edge of edges) {
        const { id, source, target, type: edgeType, data } = edge;

        // Clean edge data (only the data property, not the whole edge)
        const cleanedEdgeData = cleanEdgeData(data || {});

        await databaseService.query(`
          INSERT INTO tblFlowEdges (
            workflow_id, edge_id, source_node_id, target_node_id, edge_type, edge_data, created_at, updated_at
          )
          VALUES (
            @workflowId, @edgeId, @sourceNodeId, @targetNodeId, @edgeType, @edgeData, GETDATE(), GETDATE()
          )
        `, {
          workflowId,
          edgeId: id,
          sourceNodeId: source,
          targetNodeId: target,
          edgeType: edgeType || 'default',
          edgeData: JSON.stringify(cleanedEdgeData)
        }, transaction);
      }

      // Update workflow configurations if provided
      if (Object.keys(configs).length > 0) {
        // Delete existing configs
        await databaseService.query(`
          DELETE FROM tblWorkflowConfigs WHERE workflow_id = @workflowId
        `, { workflowId }, transaction);

        // Insert new configs
        for (const [key, value] of Object.entries(configs)) {
          const { configValue, configType } = serializeConfigValue(value);

          await databaseService.query(`
            INSERT INTO tblWorkflowConfigs (workflow_id, config_key, config_value, config_type, created_at, updated_at)
            VALUES (@workflowId, @configKey, @configValue, @configType, GETDATE(), GETDATE())
          `, {
            workflowId,
            configKey: key,
            configValue,
            configType
          }, transaction);
        }
      }

      // Update workflow timestamp
      await databaseService.query(`
        UPDATE tblWorkflows
        SET updated_at = GETDATE()
        WHERE id = @workflowId
      `, { workflowId }, transaction);

      await databaseService.commitTransaction(transaction);

      res.json({
        success: true,
        data: {
          workflow: workflowResult.recordset[0],
          nodeCount: nodes.length,
          edgeCount: edges.length,
          configCount: Object.keys(configs).length
        },
        message: 'Workflow flow saved successfully'
      });

    } catch (error) {
      await databaseService.rollbackTransaction(transaction);
      throw error;
    }

  } catch (error) {
    console.error('Save workflow flow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save workflow flow',
      message: error.message
    });
  }
});

/**
 * POST /api/workflows/import
 * Import workflow from JSON data
 */
router.post('/import', authenticateToken, async (req, res) => {
  try {
    const { workflowData, overwriteExisting = false, currentWorkflowId = null } = req.body;
    const userId = req.user.id;

    // Validate JSON structure
    const validationResult = validateImportedWorkflow(workflowData);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow data',
        message: 'The imported workflow data is not valid',
        details: validationResult.errors
      });
    }

    // Determine which workflow to overwrite
    let existingWorkflow = { recordset: [] };

    if (currentWorkflowId && overwriteExisting) {
      // Check if the specified current workflow exists (removed user ownership check)
      existingWorkflow = await databaseService.query(`
        SELECT id, name FROM tblWorkflows
        WHERE id = @workflowId AND is_active = 1
      `, { workflowId: currentWorkflowId });

      if (existingWorkflow.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
          message: `Current workflow with ID ${currentWorkflowId} not found`
        });
      }
    } else {
      // Check if workflow with same name already exists (removed user ownership check)
      existingWorkflow = await databaseService.query(`
        SELECT id, name FROM tblWorkflows
        WHERE name = @name AND is_active = 1
      `, { name: workflowData.name });

      if (existingWorkflow.recordset.length > 0 && !overwriteExisting) {
        return res.status(409).json({
          success: false,
          error: 'Workflow exists',
          message: `A workflow named "${workflowData.name}" already exists`,
          data: { existingWorkflowId: existingWorkflow.recordset[0].id }
        });
      }
    }

    // Start transaction
    const transaction = await databaseService.beginTransaction();

    try {
      let workflowId;

      if (existingWorkflow.recordset.length > 0 && overwriteExisting) {
        // Update existing workflow
        workflowId = existingWorkflow.recordset[0].id;

        await databaseService.query(`
          UPDATE tblWorkflows
          SET name = @name, description = @description, updated_at = GETDATE()
          WHERE id = @workflowId
        `, {
          workflowId,
          name: workflowData.name || 'Imported Workflow',
          description: workflowData.description || null
        }, transaction);

        // Clear existing flow data
        await databaseService.query(`
          DELETE FROM tblFlowNodes WHERE workflow_id = @workflowId
        `, { workflowId }, transaction);

        await databaseService.query(`
          DELETE FROM tblFlowEdges WHERE workflow_id = @workflowId
        `, { workflowId }, transaction);

        await databaseService.query(`
          DELETE FROM tblWorkflowConfigs WHERE workflow_id = @workflowId
        `, { workflowId }, transaction);

      } else {
        // Create new workflow
        const workflowResult = await databaseService.query(`
          INSERT INTO tblWorkflows (name, description, created_by, created_at, updated_at)
          OUTPUT INSERTED.id
          VALUES (@name, @description, @userId, GETDATE(), GETDATE())
        `, {
          name: workflowData.name,
          description: workflowData.description || null,
          userId
        }, transaction);

        workflowId = workflowResult.recordset[0].id;
      }

      // Import nodes
      if (workflowData.nodes && workflowData.nodes.length > 0) {
        for (const node of workflowData.nodes) {
          const cleanData = cleanNodeData(node.data || {});

          await databaseService.query(`
            INSERT INTO tblFlowNodes (
              workflow_id, node_id, node_type, position_x, position_y, node_data, created_at, updated_at
            )
            VALUES (
              @workflowId, @nodeId, @nodeType, @positionX, @positionY, @nodeData, GETDATE(), GETDATE()
            )
          `, {
            workflowId,
            nodeId: node.id,
            nodeType: node.type,
            positionX: node.position?.x || 0,
            positionY: node.position?.y || 0,
            nodeData: JSON.stringify(cleanData)
          }, transaction);
        }
      }

      // Import edges
      if (workflowData.edges && workflowData.edges.length > 0) {
        for (const edge of workflowData.edges) {
          const { id, source, target, type: edgeType, data } = edge;
          const cleanedEdgeData = cleanEdgeData(data || {});

          await databaseService.query(`
            INSERT INTO tblFlowEdges (
              workflow_id, edge_id, source_node_id, target_node_id, edge_type, edge_data, created_at, updated_at
            )
            VALUES (
              @workflowId, @edgeId, @sourceNodeId, @targetNodeId, @edgeType, @edgeData, GETDATE(), GETDATE()
            )
          `, {
            workflowId,
            edgeId: id,
            sourceNodeId: source,
            targetNodeId: target,
            edgeType: edgeType || 'default',
            edgeData: JSON.stringify(cleanedEdgeData)
          }, transaction);
        }
      }

      // Import configurations
      if (workflowData.config && typeof workflowData.config === 'object') {
        for (const [key, value] of Object.entries(workflowData.config)) {
          const { configValue, configType } = serializeConfigValue(value);

          await databaseService.query(`
            INSERT INTO tblWorkflowConfigs (workflow_id, config_key, config_value, config_type, created_at, updated_at)
            VALUES (@workflowId, @configKey, @configValue, @configType, GETDATE(), GETDATE())
          `, {
            workflowId,
            configKey: key,
            configValue,
            configType
          }, transaction);
        }
      }

      await databaseService.commitTransaction(transaction);

      // Return the imported workflow
      const importedWorkflow = await databaseService.query(`
        SELECT
          w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
          u.email as created_by_email
        FROM tblWorkflows w
        LEFT JOIN tblUsers u ON w.created_by = u.id
        WHERE w.id = @workflowId
      `, { workflowId });

      const statusCode = overwriteExisting ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        data: {
          workflow: importedWorkflow.recordset[0],
          imported: {
            nodeCount: workflowData.nodes?.length || 0,
            edgeCount: workflowData.edges?.length || 0,
            configCount: workflowData.config ? Object.keys(workflowData.config).length : 0
          }
        },
        message: overwriteExisting ? 'Workflow updated from import' : 'Workflow imported successfully'
      });

    } catch (error) {
      await databaseService.rollbackTransaction(transaction);
      throw error;
    }

  } catch (error) {
    console.error('Import workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import workflow',
      message: error.message
    });
  }
});

/**
 * GET /api/workflows/:id/export
 * Export workflow as JSON (accessible to all users)
 */
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const includeMetadata = req.query.metadata !== 'false';

    // Get workflow details (removed user ownership check)
    const workflowResult = await databaseService.query(`
      SELECT
        w.id, w.name, w.description, w.is_active, w.created_at, w.updated_at,
        u.email as created_by_email
      FROM tblWorkflows w
      LEFT JOIN tblUsers u ON w.created_by = u.id
      WHERE w.id = @workflowId AND w.is_active = 1
    `, { workflowId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to access it'
      });
    }

    const workflow = workflowResult.recordset[0];

    // Get workflow flow data
    const flowData = await getCompleteWorkflowFlow(workflowId);

    // Build export data
    const exportData = {
      name: workflow.name,
      description: workflow.description,
      nodes: flowData.nodes,
      edges: flowData.edges,
      config: flowData.configs,
      version: '1.0.0',
      exportedAt: new Date().toISOString()
    };

    if (includeMetadata) {
      exportData.metadata = {
        id: workflow.id,
        created_at: workflow.created_at,
        updated_at: workflow.updated_at,
        created_by: workflow.created_by_email
      };
    }

    res.json({
      success: true,
      data: exportData,
      message: 'Workflow exported successfully'
    });

  } catch (error) {
    console.error('Export workflow error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export workflow',
      message: error.message
    });
  }
});

/**
 * Validation helper for workflow flow data
 */
function validateWorkflowFlow(flowData) {
  const errors = [];
  const { nodes = [], edges = [], configs = {} } = flowData;

  // Validate nodes
  if (!Array.isArray(nodes)) {
    errors.push('Nodes must be an array');
  } else {
    const nodeIds = new Set();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.id || typeof node.id !== 'string') {
        errors.push(`Node at index ${i} must have a valid string id`);
      } else if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node id: ${node.id}`);
      } else {
        nodeIds.add(node.id);
      }

      if (!node.type || typeof node.type !== 'string') {
        errors.push(`Node ${node.id || i} must have a valid type`);
      }

      if (node.position && (typeof node.position.x !== 'number' || typeof node.position.y !== 'number')) {
        errors.push(`Node ${node.id || i} position must have numeric x and y coordinates`);
      }
    }

    // Validate edges
    if (!Array.isArray(edges)) {
      errors.push('Edges must be an array');
    } else {
      const edgeIds = new Set();
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        if (!edge.id || typeof edge.id !== 'string') {
          errors.push(`Edge at index ${i} must have a valid string id`);
        } else if (edgeIds.has(edge.id)) {
          errors.push(`Duplicate edge id: ${edge.id}`);
        } else {
          edgeIds.add(edge.id);
        }

        if (!edge.source || !nodeIds.has(edge.source)) {
          errors.push(`Edge ${edge.id || i} has invalid source node: ${edge.source}`);
        }

        if (!edge.target || !nodeIds.has(edge.target)) {
          errors.push(`Edge ${edge.id || i} has invalid target node: ${edge.target}`);
        }
      }
    }
  }

  // Validate configs
  if (configs && typeof configs !== 'object') {
    errors.push('Configs must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}



/**
 * Validate imported workflow data
 */
function validateImportedWorkflow(workflowData) {
  const errors = [];

  if (!workflowData || typeof workflowData !== 'object') {
    errors.push('Workflow data must be an object');
    return { isValid: false, errors };
  }

  // Validate required fields
  if (!workflowData.name || typeof workflowData.name !== 'string') {
    errors.push('Workflow name is required and must be a string');
  } else if (workflowData.name.trim().length === 0) {
    errors.push('Workflow name cannot be empty');
  } else if (workflowData.name.length > 255) {
    errors.push('Workflow name must be less than 255 characters');
  }

  if (workflowData.description && typeof workflowData.description !== 'string') {
    errors.push('Description must be a string');
  } else if (workflowData.description && workflowData.description.length > 1000) {
    errors.push('Description must be less than 1000 characters');
  }

  // Validate nodes if present
  if (workflowData.nodes) {
    if (!Array.isArray(workflowData.nodes)) {
      errors.push('Nodes must be an array');
    } else {
      const nodeIds = new Set();
      workflowData.nodes.forEach((node, index) => {
        if (!node.id || typeof node.id !== 'string') {
          errors.push(`Node at index ${index} must have a valid string id`);
        } else if (nodeIds.has(node.id)) {
          errors.push(`Duplicate node id: ${node.id}`);
        } else {
          nodeIds.add(node.id);
        }

        if (!node.type || typeof node.type !== 'string') {
          errors.push(`Node ${node.id || index} must have a valid type`);
        }

        if (node.position && (
          typeof node.position.x !== 'number' ||
          typeof node.position.y !== 'number'
        )) {
          errors.push(`Node ${node.id || index} position must have numeric x and y coordinates`);
        }
      });

      // Validate edges if present
      if (workflowData.edges) {
        if (!Array.isArray(workflowData.edges)) {
          errors.push('Edges must be an array');
        } else {
          const edgeIds = new Set();
          workflowData.edges.forEach((edge, index) => {
            if (!edge.id || typeof edge.id !== 'string') {
              errors.push(`Edge at index ${index} must have a valid string id`);
            } else if (edgeIds.has(edge.id)) {
              errors.push(`Duplicate edge id: ${edge.id}`);
            } else {
              edgeIds.add(edge.id);
            }

            if (!edge.source || !nodeIds.has(edge.source)) {
              errors.push(`Edge ${edge.id || index} has invalid source node: ${edge.source}`);
            }

            if (!edge.target || !nodeIds.has(edge.target)) {
              errors.push(`Edge ${edge.id || index} has invalid target node: ${edge.target}`);
            }
          });
        }
      }
    }
  }

  // Validate config if present
  if (workflowData.config && typeof workflowData.config !== 'object') {
    errors.push('Config must be an object');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get complete workflow flow data including configs
 */
async function getCompleteWorkflowFlow(workflowId) {
  // Get nodes
  const nodesResult = await databaseService.query(`
    SELECT
      node_id as id,
      node_type as type,
      position_x,
      position_y,
      node_data
    FROM tblFlowNodes
    WHERE workflow_id = @workflowId
    ORDER BY created_at
  `, { workflowId });

  // Get edges
  const edgesResult = await databaseService.query(`
    SELECT
      edge_id as id,
      source_node_id as source,
      target_node_id as target,
      edge_type as type,
      edge_data
    FROM tblFlowEdges
    WHERE workflow_id = @workflowId
    ORDER BY created_at
  `, { workflowId });

  // Get configurations
  const configsResult = await databaseService.query(`
    SELECT config_key, config_value, config_type
    FROM tblWorkflowConfigs
    WHERE workflow_id = @workflowId
    ORDER BY config_key
  `, { workflowId });

  // Parse and format data
  const nodes = nodesResult.recordset.map(node => {
    let data = {};
    try {
      if (node.node_data) {
        data = JSON.parse(node.node_data);
      }
    } catch (e) {
      console.warn(`Failed to parse node data for node ${node.id}:`, e.message);
    }

    return {
      id: node.id,
      type: node.type,
      position: {
        x: node.position_x || 0,
        y: node.position_y || 0
      },
      data
    };
  });

  const edges = edgesResult.recordset.map(edge => {
    let edgeData = {};
    try {
      if (edge.edge_data) {
        edgeData = JSON.parse(edge.edge_data);
      }
    } catch (e) {
      console.warn(`Failed to parse edge data for edge ${edge.id}:`, e.message);
    }

    // Build the edge object with proper type precedence
    const edgeObject = {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: validateEdgeType(edge.type), // Validate and normalize edge type
    };

    // Add data property if there's edge data (condition data, etc.)
    if (Object.keys(edgeData).length > 0) {
      edgeObject.data = edgeData;
    }

    return edgeObject;
  });

  // Parse configurations
  const configs = {};
  configsResult.recordset.forEach(config => {
    let value = config.config_value;

    try {
      switch (config.config_type) {
        case 'json':
          value = JSON.parse(value);
          break;
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'array':
          value = JSON.parse(value);
          break;
        default:
          // Keep as string
          break;
      }
    } catch (e) {
      console.warn(`Failed to parse config ${config.config_key}:`, e.message);
    }

    configs[config.config_key] = value;
  });

  return { nodes, edges, configs };
}

module.exports = router;
