const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/workflows
 * Get all workflows for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get workflows with pagination
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
 * Get a specific workflow with full configuration
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const userId = req.user.id;

    // Get workflow details
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
      WHERE w.id = @workflowId AND w.created_by = @userId AND w.is_active = 1
    `, { workflowId, userId });

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

    // Check if workflow exists and user owns it
    const existingWorkflow = await databaseService.query(`
      SELECT id FROM tblWorkflows
      WHERE id = @workflowId AND created_by = @userId AND is_active = 1
    `, { workflowId, userId });

    if (existingWorkflow.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to modify it'
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

    // Check if workflow exists and user owns it
    const existingWorkflow = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND created_by = @userId AND is_active = 1
    `, { workflowId, userId });

    if (existingWorkflow.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to delete it'
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
 * Get complete flow data (nodes + edges) for a workflow
 */
router.get('/:id/flow', authenticateToken, async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if workflow exists and user owns it
    const workflowResult = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND created_by = @userId AND is_active = 1
    `, { workflowId, userId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to access it'
      });
    }

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
        edge_data
      FROM tblFlowEdges
      WHERE workflow_id = @workflowId
      ORDER BY created_at
    `, { workflowId });

    // Parse node data and format for React Flow
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

    // Parse edge data and format for React Flow
    const edges = edgesResult.recordset.map(edge => {
      let data = {};
      try {
        if (edge.edge_data) {
          data = JSON.parse(edge.edge_data);
        }
      } catch (e) {
        console.warn(`Failed to parse edge data for edge ${edge.id}:`, e.message);
      }

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...data
      };
    });

    res.json({
      success: true,
      data: {
        workflow: workflowResult.recordset[0],
        nodes,
        edges
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
    const { nodes = [], edges = [] } = req.body;
    const userId = req.user.id;

    // Check if workflow exists and user owns it
    const workflowResult = await databaseService.query(`
      SELECT id, name FROM tblWorkflows
      WHERE id = @workflowId AND created_by = @userId AND is_active = 1
    `, { workflowId, userId });

    if (workflowResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: 'Workflow does not exist or you do not have permission to modify it'
      });
    }

    // Validate nodes and edges
    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Nodes and edges must be arrays'
      });
    }

    // Validate node structure
    for (const node of nodes) {
      if (!node.id || !node.type) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Each node must have an id and type'
        });
      }
    }

    // Validate edge structure and node references
    const nodeIds = new Set(nodes.map(n => n.id));
    for (const edge of edges) {
      if (!edge.id || !edge.source || !edge.target) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Each edge must have an id, source, and target'
        });
      }

      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: `Edge ${edge.id} references non-existent nodes`
        });
      }
    }

    // Start transaction
    const transaction = await databaseService.beginTransaction();

    try {
      // Delete existing nodes and edges (cascade will handle related data)
      await databaseService.query(`
        DELETE FROM tblFlowNodes WHERE workflow_id = @workflowId
      `, { workflowId }, transaction);

      await databaseService.query(`
        DELETE FROM tblFlowEdges WHERE workflow_id = @workflowId
      `, { workflowId }, transaction);

      // Insert new nodes
      for (const node of nodes) {
        const { id, type, position = { x: 0, y: 0 }, data = {} } = node;

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
          nodeData: JSON.stringify(data)
        }, transaction);
      }

      // Insert new edges
      for (const edge of edges) {
        const { id, source, target, ...edgeData } = edge;

        await databaseService.query(`
          INSERT INTO tblFlowEdges (
            workflow_id, edge_id, source_node_id, target_node_id, edge_data, created_at, updated_at
          )
          VALUES (
            @workflowId, @edgeId, @sourceNodeId, @targetNodeId, @edgeData, GETDATE(), GETDATE()
          )
        `, {
          workflowId,
          edgeId: id,
          sourceNodeId: source,
          targetNodeId: target,
          edgeData: JSON.stringify(edgeData)
        }, transaction);
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
          edgeCount: edges.length
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

module.exports = router;
