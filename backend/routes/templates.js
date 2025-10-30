const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Helper function to clean node data for database storage
 */
function cleanNodeData(data) {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const cleaned = { ...data };
  delete cleaned.component;
  delete cleaned.__reactInternalInstance;
  delete cleaned.__reactInternalMemoizedUnmaskedChildContext;

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
 * Helper function to clean edge data for database storage
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
 * GET /api/templates
 * List all active templates (all authenticated users)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const templatesResult = await databaseService.query(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.category,
        t.is_active,
        t.created_at,
        t.updated_at,
        t.template_data,
        u.email as created_by_email
      FROM tblWorkflowTemplates t
      LEFT JOIN tblUsers u ON t.created_by = u.id
      WHERE t.is_active = 1
      ORDER BY t.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    const totalResult = await databaseService.query(`
      SELECT COUNT(*) as total FROM tblWorkflowTemplates WHERE is_active = 1
    `);

    const total = totalResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Parse template_data and calculate node/edge counts
    const templates = (templatesResult.recordset || []).map(template => {
      let nodeCount = 0;
      let edgeCount = 0;

      try {
        const templateData = JSON.parse(template.template_data);
        nodeCount = templateData.nodes?.length || 0;
        edgeCount = templateData.edges?.length || 0;
      } catch (e) {
        console.warn(`Failed to parse template_data for template ${template.id}:`, e);
      }

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        is_active: template.is_active,
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by_email: template.created_by_email,
        node_count: nodeCount,
        edge_count: edgeCount
      };
    });

    res.json({
      success: true,
      data: {
        templates,
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
    console.error('Get templates error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/:id
 * Get template details (all authenticated users)
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    const templateResult = await databaseService.query(`
      SELECT
        t.id,
        t.name,
        t.description,
        t.template_data,
        t.category,
        t.is_active,
        t.created_at,
        t.updated_at,
        u.email as created_by_email
      FROM tblWorkflowTemplates t
      LEFT JOIN tblUsers u ON t.created_by = u.id
      WHERE t.id = @templateId AND t.is_active = 1
    `, { templateId });

    if (templateResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        message: 'Template does not exist'
      });
    }

    const template = templateResult.recordset[0];
    let templateData = {};
    let nodeCount = 0;
    let edgeCount = 0;

    try {
      templateData = JSON.parse(template.template_data);
      nodeCount = templateData.nodes?.length || 0;
      edgeCount = templateData.edges?.length || 0;
    } catch (e) {
      console.warn('Failed to parse template_data:', e);
    }

    res.json({
      success: true,
      data: {
        ...template,
        template_data: templateData,
        node_count: nodeCount,
        edge_count: edgeCount
      }
    });
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
      message: error.message
    });
  }
});

/**
 * POST /api/templates
 * Create template (admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, category, template_data } = req.body;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Template name is required'
      });
    }

    if (!template_data) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Template data is required'
      });
    }

    const templateDataStr = typeof template_data === 'string' 
      ? template_data 
      : JSON.stringify(template_data);

    await databaseService.query(`
      INSERT INTO tblWorkflowTemplates (name, description, category, template_data, created_by, created_at, updated_at)
      VALUES (@name, @description, @category, @templateData, @userId, GETDATE(), GETDATE())
    `, {
      name: name.trim(),
      description: description || null,
      category: category || null,
      templateData: templateDataStr,
      userId
    });

    const createdResult = await databaseService.query(`
      SELECT TOP 1
        id, name, description, category, is_active, created_at, updated_at
      FROM tblWorkflowTemplates
      WHERE name = @name AND created_by = @userId
      ORDER BY created_at DESC
    `, { name: name.trim(), userId });

    res.status(201).json({
      success: true,
      data: createdResult.recordset[0]
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
      message: error.message
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update template (admin only)
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { name, description, category, template_data } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Template name is required'
      });
    }

    const templateDataStr = template_data 
      ? (typeof template_data === 'string' ? template_data : JSON.stringify(template_data))
      : undefined;

    const updateQuery = templateDataStr
      ? `UPDATE tblWorkflowTemplates SET name = @name, description = @description, category = @category, template_data = @templateData, updated_at = GETDATE() WHERE id = @templateId`
      : `UPDATE tblWorkflowTemplates SET name = @name, description = @description, category = @category, updated_at = GETDATE() WHERE id = @templateId`;

    await databaseService.query(updateQuery, {
      templateId,
      name: name.trim(),
      description: description || null,
      category: category || null,
      templateData: templateDataStr
    });

    const updatedResult = await databaseService.query(`
      SELECT id, name, description, category, is_active, created_at, updated_at
      FROM tblWorkflowTemplates
      WHERE id = @templateId
    `, { templateId });

    res.json({
      success: true,
      data: updatedResult.recordset[0]
    });
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
      message: error.message
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Delete template (admin only)
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    await databaseService.query(`
      UPDATE tblWorkflowTemplates
      SET is_active = 0, updated_at = GETDATE()
      WHERE id = @templateId
    `, { templateId });

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
      message: error.message
    });
  }
});

/**
 * POST /api/templates/:id/clone
 * Clone template to user's workflows (all authenticated users)
 */
router.post('/:id/clone', authenticateToken, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const userId = req.user.id;
    const { workflowName } = req.body;

    // Get template
    const templateResult = await databaseService.query(`
      SELECT id, name, description, template_data
      FROM tblWorkflowTemplates
      WHERE id = @templateId AND is_active = 1
    `, { templateId });

    if (templateResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
        message: 'Template does not exist'
      });
    }

    const template = templateResult.recordset[0];
    let templateData = {};
    try {
      templateData = JSON.parse(template.template_data);
    } catch (e) {
      console.warn('Failed to parse template_data:', e);
    }

    // Start transaction
    const transaction = await databaseService.beginTransaction();

    try {
      // Create new workflow
      const newWorkflowName = workflowName || `${template.name} (Clone)`;
      await databaseService.query(`
        INSERT INTO tblWorkflows (name, description, created_by, created_at, updated_at)
        VALUES (@name, @description, @userId, GETDATE(), GETDATE())
      `, {
        name: newWorkflowName,
        description: template.description || null,
        userId
      }, transaction);

      // Get the created workflow
      const workflowResult = await databaseService.query(`
        SELECT id FROM tblWorkflows WHERE name = @name AND created_by = @userId
        ORDER BY created_at DESC
      `, { name: newWorkflowName, userId }, transaction);

      const workflowId = workflowResult.recordset[0].id;

      // Clone nodes
      if (templateData.nodes && templateData.nodes.length > 0) {
        for (const node of templateData.nodes) {
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

      // Clone edges
      if (templateData.edges && templateData.edges.length > 0) {
        for (const edge of templateData.edges) {
          // Clean edge data (only the data property, not the whole edge)
          const cleanedEdgeData = cleanEdgeData(edge.data || {});

          await databaseService.query(`
            INSERT INTO tblFlowEdges (
              workflow_id, edge_id, source_node_id, target_node_id, edge_type, edge_data, created_at, updated_at
            )
            VALUES (
              @workflowId, @edgeId, @sourceNodeId, @targetNodeId, @edgeType, @edgeData, GETDATE(), GETDATE()
            )
          `, {
            workflowId,
            edgeId: edge.id,
            sourceNodeId: edge.source,
            targetNodeId: edge.target,
            edgeType: edge.type || 'default',
            edgeData: JSON.stringify(cleanedEdgeData)
          }, transaction);
        }
      }

      // Clone configs
      if (templateData.configs && typeof templateData.configs === 'object') {
        for (const [key, value] of Object.entries(templateData.configs)) {
          let configType = 'string';
          let configValue = '';

          if (value === null || value === undefined) {
            configValue = '';
            configType = 'string';
          } else if (typeof value === 'boolean') {
            configValue = value.toString();
            configType = 'boolean';
          } else if (typeof value === 'number') {
            configValue = value.toString();
            configType = 'number';
          } else if (Array.isArray(value)) {
            configValue = JSON.stringify(value);
            configType = 'array';
          } else if (typeof value === 'object') {
            configValue = JSON.stringify(value);
            configType = 'json';
          } else {
            configValue = String(value);
            configType = 'string';
          }

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
        data: {
          workflow: createdWorkflow.recordset[0],
          cloned: {
            nodeCount: templateData.nodes?.length || 0,
            edgeCount: templateData.edges?.length || 0,
            configCount: templateData.configs ? Object.keys(templateData.configs).length : 0
          }
        }
      });
    } catch (error) {
      await databaseService.rollbackTransaction(transaction);
      throw error;
    }
  } catch (error) {
    console.error('Clone template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clone template',
      message: error.message
    });
  }
});

/**
 * GET /api/templates/stats/count
 * Get total count of available templates from database
 * Returns: templatesCount
 */
router.get('/stats/count', authenticateToken, async (req, res) => {
  try {
    // Get total count of active templates
    const templatesResult = await databaseService.query(`
      SELECT COUNT(*) as total
      FROM tblWorkflowTemplates
      WHERE is_active = 1
    `);

    const templatesCount = templatesResult.recordset[0]?.total || 0;

    res.json({
      success: true,
      data: {
        templatesCount
      }
    });

  } catch (error) {
    console.error('Get templates count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates count',
      message: error.message
    });
  }
});

module.exports = router;

