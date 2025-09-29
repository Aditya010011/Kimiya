const express = require('express');
const router = express.Router();
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/contacts
 * Get all contacts for the authenticated user
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const {
      page = 1,
      limit = 50,
      search = '',
      group_id = null,
      is_favorite = null,
      sort_by = 'first_name',
      sort_order = 'ASC'
    } = req.query;

    const offset = (page - 1) * limit;

    // Build WHERE clause - Admin can see all contacts, regular users only their own
    let whereClause = 'WHERE c.is_active = 1';
    const params = {};

    if (userRole !== 'admin') {
      whereClause += ' AND c.created_by = @userId';
      params.userId = userId;
    }

    if (search) {
      whereClause += ` AND (c.first_name LIKE @search OR c.last_name LIKE @search OR c.email LIKE @search OR c.phone LIKE @search OR c.company LIKE @search)`;
      params.search = `%${search}%`;
    }

    if (group_id) {
      whereClause += ` AND c.group_id = @groupId`;
      params.groupId = group_id;
    }

    if (is_favorite !== null) {
      whereClause += ` AND c.is_favorite = @isFavorite`;
      params.isFavorite = is_favorite === 'true' ? 1 : 0;
    }

    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['first_name', 'last_name', 'email', 'company', 'created_at', 'last_contacted_at'];
    const sortBy = allowedSortFields.includes(sort_by) ? sort_by : 'first_name';
    const sortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.job_title,
        c.address,
        c.notes,
        c.group_id,
        cg.name as group_name,
        cg.color as group_color,
        c.is_favorite,
        c.created_at,
        c.updated_at,
        c.last_contacted_at,
        c.created_by,
        u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name,
        -- Count of interactions
        ISNULL((SELECT COUNT(*) FROM tblContactInteractions ci WHERE ci.contact_id = c.id), 0) as interaction_count,
        -- Recent interaction
        (SELECT TOP 1 interaction_type FROM tblContactInteractions ci
         WHERE ci.contact_id = c.id ORDER BY ci.created_at DESC) as last_interaction_type
      FROM tblContacts c
      LEFT JOIN tblContactGroups cg ON c.group_id = cg.id
      LEFT JOIN tblUsers u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.${sortBy} ${sortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    params.offset = offset;
    params.limit = parseInt(limit);

    const contacts = await databaseService.query(query, params);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tblContacts c
      ${whereClause}
    `;
    
    const countResult = await databaseService.query(countQuery, params);
    const total = countResult.recordset[0].total;

    res.json({
      success: true,
      data: contacts.recordset,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contacts',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/:id
 * Get a specific contact by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build WHERE clause - Admin can see any contact, regular users only their own
    let whereClause = 'WHERE c.id = @contactId AND c.is_active = 1';
    const params = { contactId };

    if (userRole !== 'admin') {
      whereClause += ' AND c.created_by = @userId';
      params.userId = userId;
    }

    const query = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.job_title,
        c.address,
        c.notes,
        c.group_id,
        cg.name as group_name,
        cg.color as group_color,
        c.is_favorite,
        c.created_at,
        c.updated_at,
        c.last_contacted_at,
        c.created_by,
        u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name
      FROM tblContacts c
      LEFT JOIN tblContactGroups cg ON c.group_id = cg.id
      LEFT JOIN tblUsers u ON c.created_by = u.id
      ${whereClause}
    `;

    const result = await databaseService.query(query, params);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    const contact = result.recordset[0];

    // Get contact tags
    const tagsQuery = `
      SELECT ct.id, ct.name, ct.color
      FROM tblContactTags ct
      INNER JOIN tblContactTagAssignments cta ON ct.id = cta.tag_id
      WHERE cta.contact_id = @contactId
    `;

    const tagsResult = await databaseService.query(tagsQuery, { contactId });
    contact.tags = tagsResult.recordset;

    // Get recent interactions
    const interactionsQuery = `
      SELECT TOP 10
        ci.id,
        ci.interaction_type,
        ci.direction,
        ci.subject,
        ci.content,
        ci.duration,
        ci.outcome,
        ci.created_at,
        u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name
      FROM tblContactInteractions ci
      LEFT JOIN tblUsers u ON ci.created_by = u.id
      WHERE ci.contact_id = @contactId
      ORDER BY ci.created_at DESC
    `;

    const interactionsResult = await databaseService.query(interactionsQuery, { contactId });
    contact.recent_interactions = interactionsResult.recordset;

    res.json({
      success: true,
      data: contact
    });

  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact',
      message: error.message
    });
  }
});

/**
 * POST /api/contacts
 * Create a new contact
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      first_name,
      last_name,
      email,
      phone,
      company,
      job_title,
      address,
      notes,
      group_id,
      is_favorite = false,
      tags = []
    } = req.body;

    // Validate required fields
    if (!first_name || first_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'First name is required'
      });
    }

    // Check if email already exists for this user (if provided)
    if (email) {
      const existingEmailQuery = `
        SELECT id FROM tblContacts 
        WHERE email = @email AND created_by = @userId AND is_active = 1
      `;
      const existingEmail = await databaseService.query(existingEmailQuery, { email, userId });
      
      if (existingEmail.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'A contact with this email already exists'
        });
      }
    }

    // Validate group_id if provided
    if (group_id) {
      const groupQuery = `
        SELECT id FROM tblContactGroups 
        WHERE id = @groupId AND created_by = @userId
      `;
      const groupResult = await databaseService.query(groupQuery, { groupId: group_id, userId });
      
      if (groupResult.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid group ID'
        });
      }
    }

    // Create the contact
    const insertQuery = `
      INSERT INTO tblContacts (
        first_name, last_name, email, phone, company, job_title, 
        address, notes, group_id, is_favorite, created_by, created_at, updated_at
      )
      VALUES (
        @firstName, @lastName, @email, @phone, @company, @jobTitle,
        @address, @notes, @groupId, @isFavorite, @userId, GETDATE(), GETDATE()
      );
      
      SELECT SCOPE_IDENTITY() as id;
    `;

    const insertResult = await databaseService.query(insertQuery, {
      firstName: first_name.trim(),
      lastName: last_name ? last_name.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      company: company ? company.trim() : null,
      jobTitle: job_title ? job_title.trim() : null,
      address: address ? address.trim() : null,
      notes: notes ? notes.trim() : null,
      groupId: group_id || null,
      isFavorite: is_favorite ? 1 : 0,
      userId
    });

    const contactId = insertResult.recordset[0].id;

    // Add tags if provided
    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        // Verify tag belongs to user
        const tagQuery = `
          SELECT id FROM tblContactTags 
          WHERE id = @tagId AND created_by = @userId
        `;
        const tagResult = await databaseService.query(tagQuery, { tagId, userId });
        
        if (tagResult.recordset.length > 0) {
          await databaseService.query(`
            INSERT INTO tblContactTagAssignments (contact_id, tag_id, assigned_at)
            VALUES (@contactId, @tagId, GETDATE())
          `, { contactId, tagId });
        }
      }
    }

    // Fetch the created contact with all details
    const createdContactQuery = `
      SELECT 
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.job_title,
        c.address,
        c.notes,
        c.group_id,
        cg.name as group_name,
        cg.color as group_color,
        c.is_favorite,
        c.created_at,
        c.updated_at
      FROM tblContacts c
      LEFT JOIN tblContactGroups cg ON c.group_id = cg.id
      WHERE c.id = @contactId
    `;

    const createdContact = await databaseService.query(createdContactQuery, { contactId });

    res.status(201).json({
      success: true,
      data: createdContact.recordset[0],
      message: 'Contact created successfully'
    });

  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contact',
      message: error.message
    });
  }
});

/**
 * PUT /api/contacts/:id
 * Update an existing contact
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const userId = req.user.id;
    const userRole = req.user.role;
    const {
      first_name,
      last_name,
      email,
      phone,
      company,
      job_title,
      address,
      notes,
      group_id,
      is_favorite,
      tags = []
    } = req.body;

    // Validate required fields
    if (!first_name || first_name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: 'First name is required'
      });
    }

    // Check if contact exists - admin can update any contact, regular users only their own
    let existingContactQuery = `
      SELECT id, created_by FROM tblContacts
      WHERE id = @contactId AND is_active = 1
    `;
    let queryParams = { contactId };

    if (userRole !== 'admin') {
      existingContactQuery += ` AND created_by = @userId`;
      queryParams.userId = userId;
    }

    const existingContact = await databaseService.query(existingContactQuery, queryParams);

    if (existingContact.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    const contactCreatedBy = existingContact.recordset[0].created_by;

    // Check if email already exists for another contact (if provided)
    if (email) {
      let existingEmailQuery = `
        SELECT id FROM tblContacts
        WHERE email = @email AND is_active = 1 AND id != @contactId
      `;
      let emailQueryParams = { email, contactId };

      // For regular users, only check within their own contacts
      if (userRole !== 'admin') {
        existingEmailQuery += ` AND created_by = @userId`;
        emailQueryParams.userId = userId;
      }

      const existingEmail = await databaseService.query(existingEmailQuery, emailQueryParams);

      if (existingEmail.recordset.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'A contact with this email already exists'
        });
      }
    }

    // Validate group_id if provided
    if (group_id) {
      let groupQuery = `
        SELECT id FROM tblContactGroups
        WHERE id = @groupId
      `;
      let groupQueryParams = { groupId: group_id };

      // For regular users, only allow groups they created
      if (userRole !== 'admin') {
        groupQuery += ` AND created_by = @userId`;
        groupQueryParams.userId = userId;
      }

      const groupResult = await databaseService.query(groupQuery, groupQueryParams);

      if (groupResult.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation error',
          message: 'Invalid group ID'
        });
      }
    }

    // Update the contact
    let updateQuery = `
      UPDATE tblContacts SET
        first_name = @firstName,
        last_name = @lastName,
        email = @email,
        phone = @phone,
        company = @company,
        job_title = @jobTitle,
        address = @address,
        notes = @notes,
        group_id = @groupId,
        is_favorite = @isFavorite,
        updated_at = GETDATE()
      WHERE id = @contactId
    `;

    let updateParams = {
      firstName: first_name.trim(),
      lastName: last_name ? last_name.trim() : null,
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      company: company ? company.trim() : null,
      jobTitle: job_title ? job_title.trim() : null,
      address: address ? address.trim() : null,
      notes: notes ? notes.trim() : null,
      groupId: group_id || null,
      isFavorite: is_favorite ? 1 : 0,
      contactId
    };

    // For regular users, add created_by restriction
    if (userRole !== 'admin') {
      updateQuery += ` AND created_by = @userId`;
      updateParams.userId = userId;
    }

    await databaseService.query(updateQuery, updateParams);

    // Update tags - remove all existing and add new ones
    await databaseService.query(`
      DELETE FROM tblContactTagAssignments WHERE contact_id = @contactId
    `, { contactId });

    if (tags && tags.length > 0) {
      for (const tagId of tags) {
        // Verify tag exists - admin can use any tag, regular users only their own
        let tagQuery = `
          SELECT id FROM tblContactTags
          WHERE id = @tagId
        `;
        let tagQueryParams = { tagId };

        if (userRole !== 'admin') {
          tagQuery += ` AND created_by = @userId`;
          tagQueryParams.userId = userId;
        }

        const tagResult = await databaseService.query(tagQuery, tagQueryParams);

        if (tagResult.recordset.length > 0) {
          await databaseService.query(`
            INSERT INTO tblContactTagAssignments (contact_id, tag_id, assigned_at)
            VALUES (@contactId, @tagId, GETDATE())
          `, { contactId, tagId });
        }
      }
    }

    // Fetch the updated contact with all details
    const updatedContactQuery = `
      SELECT
        c.id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.job_title,
        c.address,
        c.notes,
        c.group_id,
        cg.name as group_name,
        cg.color as group_color,
        c.is_favorite,
        c.created_at,
        c.updated_at
      FROM tblContacts c
      LEFT JOIN tblContactGroups cg ON c.group_id = cg.id
      WHERE c.id = @contactId
    `;

    const updatedContact = await databaseService.query(updatedContactQuery, { contactId });

    res.json({
      success: true,
      data: updatedContact.recordset[0],
      message: 'Contact updated successfully'
    });

  } catch (error) {
    console.error('Update contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
      message: error.message
    });
  }
});

/**
 * DELETE /api/contacts/:id
 * Delete a contact (soft delete)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const userId = req.user.id;

    // Check if contact exists and belongs to user
    const existingContactQuery = `
      SELECT id FROM tblContacts
      WHERE id = @contactId AND created_by = @userId AND is_active = 1
    `;
    const existingContact = await databaseService.query(existingContactQuery, { contactId, userId });

    if (existingContact.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    // Soft delete the contact
    await databaseService.query(`
      UPDATE tblContacts
      SET is_active = 0, updated_at = GETDATE()
      WHERE id = @contactId AND created_by = @userId
    `, { contactId, userId });

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });

  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
      message: error.message
    });
  }
});

module.exports = router;
