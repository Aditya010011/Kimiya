const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/contact-tags
 * Get all contact tags for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build WHERE clause - Admin can see all tags, regular users only their own
    let whereClause = '';
    const params = {};

    if (userRole !== 'admin') {
      whereClause = 'WHERE ct.created_by = @userId';
      params.userId = userId;
    }

    const query = `
      SELECT
        ct.id,
        ct.name,
        ct.color,
        ct.created_at,
        ct.created_by,
        u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name,
        COUNT(cta.contact_id) as usage_count
      FROM tblContactTags ct
      LEFT JOIN tblContactTagAssignments cta ON ct.id = cta.tag_id
      LEFT JOIN tblContacts c ON cta.contact_id = c.id AND c.is_active = 1
      LEFT JOIN tblUsers u ON ct.created_by = u.id
      ${whereClause}
      GROUP BY ct.id, ct.name, ct.color, ct.created_at, ct.created_by, u.first_name, u.last_name
      ORDER BY ct.name ASC
    `;

    const result = await databaseService.query(query, params);

    res.json({
      success: true,
      data: result.recordset
    });

  } catch (error) {
    console.error('Get contact tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact tags',
      message: error.message
    });
  }
});

/**
 * GET /api/contact-tags/:id
 * Get a specific contact tag by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    const userId = req.user.id;

    const query = `
      SELECT 
        ct.id,
        ct.name,
        ct.color,
        ct.created_at,
        COUNT(cta.contact_id) as usage_count
      FROM tblContactTags ct
      LEFT JOIN tblContactTagAssignments cta ON ct.id = cta.tag_id
      LEFT JOIN tblContacts c ON cta.contact_id = c.id AND c.is_active = 1
      WHERE ct.id = @tagId AND ct.created_by = @userId
      GROUP BY ct.id, ct.name, ct.color, ct.created_at
    `;

    const result = await databaseService.query(query, { tagId, userId });

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact tag not found'
      });
    }

    res.json({
      success: true,
      data: result.recordset[0]
    });

  } catch (error) {
    console.error('Get contact tag error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact tag',
      message: error.message
    });
  }
});

/**
 * POST /api/contact-tags
 * Create a new contact tag
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, color } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Tag name is required'
      });
    }

    // Check if tag name already exists for this user
    const existingTagQuery = `
      SELECT id FROM tblContactTags 
      WHERE name = @name AND created_by = @userId
    `;
    const existingTag = await databaseService.query(existingTagQuery, { name: name.trim(), userId });
    
    if (existingTag.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'A tag with this name already exists'
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

    // Create the tag
    const insertQuery = `
      INSERT INTO tblContactTags (name, color, created_by, created_at)
      VALUES (@name, @color, @userId, GETDATE());
      
      SELECT SCOPE_IDENTITY() as id;
    `;

    const insertResult = await databaseService.query(insertQuery, {
      name: name.trim(),
      color: color || null,
      userId
    });

    const tagId = insertResult.recordset[0].id;

    // Fetch the created tag
    const createdTagQuery = `
      SELECT 
        id, name, color, created_at
      FROM tblContactTags
      WHERE id = @tagId
    `;

    const createdTag = await databaseService.query(createdTagQuery, { tagId });

    res.status(201).json({
      success: true,
      data: { ...createdTag.recordset[0], usage_count: 0 },
      message: 'Contact tag created successfully'
    });

  } catch (error) {
    console.error('Create contact tag error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact tag',
      message: error.message
    });
  }
});

/**
 * PUT /api/contact-tags/:id
 * Update an existing contact tag
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    const userId = req.user.id;
    const { name, color } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'Tag name is required'
      });
    }

    // Check if tag exists and belongs to user
    const existingTagQuery = `
      SELECT id FROM tblContactTags 
      WHERE id = @tagId AND created_by = @userId
    `;
    const existingTag = await databaseService.query(existingTagQuery, { tagId, userId });
    
    if (existingTag.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact tag not found'
      });
    }

    // Check if tag name already exists for another tag
    const duplicateNameQuery = `
      SELECT id FROM tblContactTags 
      WHERE name = @name AND created_by = @userId AND id != @tagId
    `;
    const duplicateName = await databaseService.query(duplicateNameQuery, { name: name.trim(), userId, tagId });
    
    if (duplicateName.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'A tag with this name already exists'
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

    // Update the tag
    const updateQuery = `
      UPDATE tblContactTags SET
        name = @name,
        color = @color
      WHERE id = @tagId AND created_by = @userId
    `;

    await databaseService.query(updateQuery, {
      name: name.trim(),
      color: color || null,
      tagId,
      userId
    });

    // Fetch the updated tag with usage count
    const updatedTagQuery = `
      SELECT 
        ct.id,
        ct.name,
        ct.color,
        ct.created_at,
        COUNT(cta.contact_id) as usage_count
      FROM tblContactTags ct
      LEFT JOIN tblContactTagAssignments cta ON ct.id = cta.tag_id
      LEFT JOIN tblContacts c ON cta.contact_id = c.id AND c.is_active = 1
      WHERE ct.id = @tagId
      GROUP BY ct.id, ct.name, ct.color, ct.created_at
    `;

    const updatedTag = await databaseService.query(updatedTagQuery, { tagId });

    res.json({
      success: true,
      data: updatedTag.recordset[0],
      message: 'Contact tag updated successfully'
    });

  } catch (error) {
    console.error('Update contact tag error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact tag',
      message: error.message
    });
  }
});

/**
 * DELETE /api/contact-tags/:id
 * Delete a contact tag
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const tagId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if tag exists and belongs to user
    const existingTagQuery = `
      SELECT id FROM tblContactTags 
      WHERE id = @tagId AND created_by = @userId
    `;
    const existingTag = await databaseService.query(existingTagQuery, { tagId, userId });
    
    if (existingTag.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact tag not found'
      });
    }

    // Delete tag assignments first (cascade will handle this, but being explicit)
    await databaseService.query(`
      DELETE FROM tblContactTagAssignments 
      WHERE tag_id = @tagId
    `, { tagId });

    // Delete the tag
    await databaseService.query(`
      DELETE FROM tblContactTags 
      WHERE id = @tagId AND created_by = @userId
    `, { tagId, userId });

    res.json({
      success: true,
      message: 'Contact tag deleted successfully'
    });

  } catch (error) {
    console.error('Delete contact tag error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact tag',
      message: error.message
    });
  }
});

module.exports = router;
