const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/contact-groups
 * Get all contact groups for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build WHERE clause - Admin can see all groups, regular users only their own
    let whereClause = '';
    const params = {};

    if (userRole !== 'admin') {
      whereClause = 'WHERE cg.created_by = @userId';
      params.userId = userId;
    }

    const query = `
      SELECT
        cg.id,
        cg.name,
        cg.description,
        cg.color,
        cg.created_at,
        cg.updated_at,
        cg.created_by,
        u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name,
        COUNT(c.id) as contact_count
      FROM tblContactGroups cg
      LEFT JOIN tblContacts c ON cg.id = c.group_id AND c.is_active = 1
      LEFT JOIN tblUsers u ON cg.created_by = u.id
      ${whereClause}
      GROUP BY cg.id, cg.name, cg.description, cg.color, cg.created_at, cg.updated_at, cg.created_by, u.first_name, u.last_name
      ORDER BY cg.name ASC
    `;

    const result = await databaseService.query(query, params);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Get contact groups error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact groups',
      message: error.message
    });
  }
});

/**
 * GET /api/contact-groups/:id
 * Get a specific contact group by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = req.user.id;

    const query = `
      SELECT 
        cg.id,
        cg.name,
        cg.description,
        cg.color,
        cg.created_at,
        cg.updated_at,
        COUNT(c.id) as contact_count
      FROM tblContactGroups cg
      LEFT JOIN tblContacts c ON cg.id = c.group_id AND c.is_active = 1
      WHERE cg.id = @groupId AND cg.created_by = @userId
      GROUP BY cg.id, cg.name, cg.description, cg.color, cg.created_at, cg.updated_at
    `;

    const result = await databaseService.query(query, { groupId, userId });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact group not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Get contact group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact group',
      message: error.message
    });
  }
});

/**
 * POST /api/contact-groups
 * Create a new contact group
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, color } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Group name is required'
      });
    }

    // Check if group name already exists for this user
    const existingGroupQuery = `
      SELECT id FROM tblContactGroups 
      WHERE name = @name AND created_by = @userId
    `;
    const existingGroup = await databaseService.query(existingGroupQuery, { name: name.trim(), userId });
    
    if (existingGroup.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'A group with this name already exists'
      });
    }

    // Validate color format if provided (hex color)
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Color must be a valid hex color code (e.g., #FF0000)'
      });
    }

    // Create the group
    const insertQuery = `
      INSERT INTO tblContactGroups (name, description, color, created_by, created_at, updated_at)
      VALUES (@name, @description, @color, @userId, GETDATE(), GETDATE());
      
      SELECT SCOPE_IDENTITY() as id;
    `;

    const insertResult = await databaseService.query(insertQuery, {
      name: name.trim(),
      description: description ? description.trim() : null,
      color: color || null,
      userId
    });

    const groupId = insertResult.recordset[0].id;

    // Fetch the created group
    const createdGroupQuery = `
      SELECT 
        id, name, description, color, created_at, updated_at
      FROM tblContactGroups
      WHERE id = @groupId
    `;

    const createdGroup = await databaseService.query(createdGroupQuery, { groupId });

    res.status(201).json({
      success: true,
      data: { ...createdGroup.recordset[0], contact_count: 0 },
      message: 'Contact group created successfully'
    });

  } catch (error) {
    console.error('Create contact group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact group',
      message: error.message
    });
  }
});

/**
 * PUT /api/contact-groups/:id
 * Update an existing contact group
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = req.user.id;
    const { name, description, color } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Group name is required'
      });
    }

    // Check if group exists and belongs to user
    const existingGroupQuery = `
      SELECT id FROM tblContactGroups 
      WHERE id = @groupId AND created_by = @userId
    `;
    const existingGroup = await databaseService.query(existingGroupQuery, { groupId, userId });
    
    if (existingGroup.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact group not found'
      });
    }

    // Check if group name already exists for another group
    const duplicateNameQuery = `
      SELECT id FROM tblContactGroups 
      WHERE name = @name AND created_by = @userId AND id != @groupId
    `;
    const duplicateName = await databaseService.query(duplicateNameQuery, { name: name.trim(), userId, groupId });
    
    if (duplicateName.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'A group with this name already exists'
      });
    }

    // Validate color format if provided (hex color)
    if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Color must be a valid hex color code (e.g., #FF0000)'
      });
    }

    // Update the group
    const updateQuery = `
      UPDATE tblContactGroups SET
        name = @name,
        description = @description,
        color = @color,
        updated_at = GETDATE()
      WHERE id = @groupId AND created_by = @userId
    `;

    await databaseService.query(updateQuery, {
      name: name.trim(),
      description: description ? description.trim() : null,
      color: color || null,
      groupId,
      userId
    });

    // Fetch the updated group with contact count
    const updatedGroupQuery = `
      SELECT 
        cg.id,
        cg.name,
        cg.description,
        cg.color,
        cg.created_at,
        cg.updated_at,
        COUNT(c.id) as contact_count
      FROM tblContactGroups cg
      LEFT JOIN tblContacts c ON cg.id = c.group_id AND c.is_active = 1
      WHERE cg.id = @groupId
      GROUP BY cg.id, cg.name, cg.description, cg.color, cg.created_at, cg.updated_at
    `;

    const updatedGroup = await databaseService.query(updatedGroupQuery, { groupId });

    res.json({
      success: true,
      data: updatedGroup.recordset[0],
      message: 'Contact group updated successfully'
    });

  } catch (error) {
    console.error('Update contact group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact group',
      message: error.message
    });
  }
});

/**
 * DELETE /api/contact-groups/:id
 * Delete a contact group
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if group exists and belongs to user
    const existingGroupQuery = `
      SELECT id FROM tblContactGroups 
      WHERE id = @groupId AND created_by = @userId
    `;
    const existingGroup = await databaseService.query(existingGroupQuery, { groupId, userId });
    
    if (existingGroup.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact group not found'
      });
    }

    // Check if group has contacts
    const contactCountQuery = `
      SELECT COUNT(*) as count FROM tblContacts 
      WHERE group_id = @groupId AND is_active = 1
    `;
    const contactCount = await databaseService.query(contactCountQuery, { groupId });
    
    if (contactCount.recordset[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete group',
        message: 'This group contains contacts. Please move or delete the contacts first.'
      });
    }

    // Delete the group
    await databaseService.query(`
      DELETE FROM tblContactGroups 
      WHERE id = @groupId AND created_by = @userId
    `, { groupId, userId });

    res.json({
      success: true,
      message: 'Contact group deleted successfully'
    });

  } catch (error) {
    console.error('Delete contact group error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact group',
      message: error.message
    });
  }
});

module.exports = router;
