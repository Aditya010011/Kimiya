const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const databaseService = require('../services/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * POST /api/contacts/import
 * Import contacts from CSV file
 */
router.post('/import', authenticateToken, upload.single('csvFile'), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { groupId, duplicateAction = 'skip' } = req.body; // skip, update, create

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate group if provided
    if (groupId) {
      let groupQuery = `
        SELECT id FROM tblContactGroups
        WHERE id = @groupId
      `;
      let groupParams = { groupId };

      if (userRole !== 'admin') {
        groupQuery += ` AND created_by = @userId`;
        groupParams.userId = userId;
      }

      const groupResult = await databaseService.query(groupQuery, groupParams);
      if (groupResult.recordset.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid group ID'
        });
      }
    }

    const results = [];
    const errors = [];
    let processedCount = 0;
    let successCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // Parse CSV from buffer
    const csvData = [];
    const stream = Readable.from(req.file.buffer.toString());
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => csvData.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    // Process each row
    for (const row of csvData) {
      processedCount++;

      try {
        // Normalize column names (handle both "First Name" and "first_name" formats)
        const normalizedRow = {};
        for (const [key, value] of Object.entries(row)) {
          let normalizedKey = key.toLowerCase()
            .replace(/\s+/g, '_')           // Replace spaces with underscores
            .replace(/[()]/g, '')           // Remove parentheses
            .replace(/[^a-z0-9_]/g, '')     // Remove special characters except underscores
            .replace(/_+/g, '_')            // Replace multiple underscores with single
            .replace(/^_|_$/g, '');         // Remove leading/trailing underscores

          // Handle specific known mappings
          if (normalizedKey === 'is_favorite_truefalse') {
            normalizedKey = 'is_favorite';
          }

          normalizedRow[normalizedKey] = value;
        }

        // Validate required fields
        if (!normalizedRow.first_name || normalizedRow.first_name.trim().length === 0) {
          errors.push({
            row: processedCount,
            error: 'First name is required',
            data: row
          });
          continue;
        }

        // Validate email format if provided
        if (normalizedRow.email && normalizedRow.email.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(normalizedRow.email.trim())) {
            errors.push({
              row: processedCount,
              error: 'Invalid email format',
              data: row
            });
            continue;
          }
        }

        // Check for existing contact by email
        let existingContact = null;
        if (normalizedRow.email && normalizedRow.email.trim()) {
          let existingQuery = `
            SELECT id, first_name, last_name FROM tblContacts
            WHERE email = @email AND is_active = 1
          `;
          let existingParams = { email: normalizedRow.email.trim() };

          if (userRole !== 'admin') {
            existingQuery += ` AND created_by = @userId`;
            existingParams.userId = userId;
          }

          const existingResult = await databaseService.query(existingQuery, existingParams);
          if (existingResult.recordset.length > 0) {
            existingContact = existingResult.recordset[0];
          }
        }

        // Handle duplicates based on action
        if (existingContact) {
          if (duplicateAction === 'skip') {
            skippedCount++;
            results.push({
              row: processedCount,
              action: 'skipped',
              reason: 'Email already exists',
              data: row
            });
            continue;
          } else if (duplicateAction === 'update') {
            // Update existing contact
            const updateQuery = `
              UPDATE tblContacts SET
                first_name = @firstName,
                last_name = @lastName,
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

            await databaseService.query(updateQuery, {
              firstName: normalizedRow.first_name.trim(),
              lastName: normalizedRow.last_name ? normalizedRow.last_name.trim() : null,
              phone: normalizedRow.phone ? normalizedRow.phone.trim() : null,
              company: normalizedRow.company ? normalizedRow.company.trim() : null,
              jobTitle: normalizedRow.job_title ? normalizedRow.job_title.trim() : null,
              address: normalizedRow.address ? normalizedRow.address.trim() : null,
              notes: normalizedRow.notes ? normalizedRow.notes.trim() : null,
              groupId: groupId || null,
              isFavorite: normalizedRow.is_favorite === 'true' || normalizedRow.is_favorite === '1' ? 1 : 0,
              contactId: existingContact.id
            });

            updatedCount++;
            results.push({
              row: processedCount,
              action: 'updated',
              contactId: existingContact.id,
              data: row
            });
            continue;
          }
          // If duplicateAction is 'create', continue to create new contact
        }

        // Create new contact
        const insertQuery = `
          INSERT INTO tblContacts (
            first_name, last_name, email, phone, company, job_title,
            address, notes, group_id, is_favorite, created_by, created_at, updated_at
          )
          OUTPUT INSERTED.id
          VALUES (
            @firstName, @lastName, @email, @phone, @company, @jobTitle,
            @address, @notes, @groupId, @isFavorite, @userId, GETDATE(), GETDATE()
          )
        `;

        const insertResult = await databaseService.query(insertQuery, {
          firstName: normalizedRow.first_name.trim(),
          lastName: normalizedRow.last_name ? normalizedRow.last_name.trim() : null,
          email: normalizedRow.email ? normalizedRow.email.trim() : null,
          phone: normalizedRow.phone ? normalizedRow.phone.trim() : null,
          company: normalizedRow.company ? normalizedRow.company.trim() : null,
          jobTitle: normalizedRow.job_title ? normalizedRow.job_title.trim() : null,
          address: normalizedRow.address ? normalizedRow.address.trim() : null,
          notes: normalizedRow.notes ? normalizedRow.notes.trim() : null,
          groupId: groupId || null,
          isFavorite: normalizedRow.is_favorite === 'true' || normalizedRow.is_favorite === '1' ? 1 : 0,
          userId
        });

        const contactId = insertResult.recordset[0].id;
        successCount++;
        
        results.push({
          row: processedCount,
          action: 'created',
          contactId,
          data: row
        });

      } catch (error) {
        console.error(`Error processing row ${processedCount}:`, error);
        errors.push({
          row: processedCount,
          error: error.message,
          data: row
        });
      }
    }

    res.json({
      success: true,
      summary: {
        totalRows: processedCount,
        successful: successCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length
      },
      results,
      errors
    });

  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/export
 * Export contacts to CSV
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const {
      format = 'csv',
      groupId = null,
      isFavorite = null,
      search = '',
      fields = 'all'
    } = req.query;

    // Build query
    let whereClause = 'WHERE c.is_active = 1';
    let params = {};

    // Role-based access control
    if (userRole !== 'admin') {
      whereClause += ' AND c.created_by = @userId';
      params.userId = userId;
    }

    // Apply filters
    if (search) {
      whereClause += ` AND (c.first_name LIKE @search OR c.last_name LIKE @search OR c.email LIKE @search OR c.phone LIKE @search OR c.company LIKE @search)`;
      params.search = `%${search}%`;
    }

    if (groupId) {
      whereClause += ` AND c.group_id = @groupId`;
      params.groupId = groupId;
    }

    if (isFavorite !== null) {
      whereClause += ` AND c.is_favorite = @isFavorite`;
      params.isFavorite = isFavorite === 'true' ? 1 : 0;
    }

    // Define available fields
    const availableFields = {
      first_name: 'c.first_name',
      last_name: 'c.last_name',
      email: 'c.email',
      phone: 'c.phone',
      company: 'c.company',
      job_title: 'c.job_title',
      address: 'c.address',
      notes: 'c.notes',
      group_name: 'cg.name as group_name',
      is_favorite: 'c.is_favorite',
      created_at: 'c.created_at',
      updated_at: 'c.updated_at',
      created_by_name: `u.first_name + ' ' + ISNULL(u.last_name, '') as created_by_name`
    };

    // Select fields
    let selectedFields;
    if (fields === 'all') {
      selectedFields = Object.values(availableFields).join(', ');
    } else {
      const requestedFields = fields.split(',').map(f => f.trim());
      selectedFields = requestedFields
        .filter(field => availableFields[field])
        .map(field => availableFields[field])
        .join(', ');
      
      if (!selectedFields) {
        return res.status(400).json({
          success: false,
          error: 'No valid fields specified'
        });
      }
    }

    const query = `
      SELECT ${selectedFields}
      FROM tblContacts c
      LEFT JOIN tblContactGroups cg ON c.group_id = cg.id
      LEFT JOIN tblUsers u ON c.created_by = u.id
      ${whereClause}
      ORDER BY c.first_name, c.last_name
    `;

    const result = await databaseService.query(query, params);
    const contacts = result.recordset;

    if (format === 'csv') {
      // Generate CSV
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `contacts-export-${timestamp}.csv`;
      const filepath = path.join(__dirname, '../temp', filename);

      // Ensure temp directory exists
      const tempDir = path.dirname(filepath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Prepare CSV headers and data
      const headers = Object.keys(contacts[0] || {}).map(key => ({
        id: key,
        title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }));

      const csvWriter = createCsvWriter({
        path: filepath,
        header: headers,
        encoding: 'utf8'
      });

      await csvWriter.writeRecords(contacts);

      // Send file
      res.download(filepath, filename, (err) => {
        if (err) {
          console.error('Download error:', err);
        }
        // Clean up temp file
        fs.unlink(filepath, (unlinkErr) => {
          if (unlinkErr) console.error('Cleanup error:', unlinkErr);
        });
      });

    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported export format'
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: 'Export failed',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/template
 * Download CSV template for import
 */
router.get('/template', authenticateToken, async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `contacts-import-template-${timestamp}.csv`;
    const filepath = path.join(__dirname, '../temp', filename);

    // Ensure temp directory exists
    const tempDir = path.dirname(filepath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Define template headers and sample data
    const headers = [
      { id: 'first_name', title: 'First Name' },
      { id: 'last_name', title: 'Last Name' },
      { id: 'email', title: 'Email' },
      { id: 'phone', title: 'Phone' },
      { id: 'company', title: 'Company' },
      { id: 'job_title', title: 'Job Title' },
      { id: 'address', title: 'Address' },
      { id: 'notes', title: 'Notes' },
      { id: 'is_favorite', title: 'Is Favorite (true/false)' }
    ];

    const sampleData = [
      {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-0123',
        company: 'Acme Corp',
        job_title: 'Software Engineer',
        address: '123 Main St, City, State 12345',
        notes: 'Sample contact for demonstration',
        is_favorite: 'false'
      },
      {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+1-555-0124',
        company: 'Tech Solutions Inc',
        job_title: 'Product Manager',
        address: '456 Oak Ave, City, State 12346',
        notes: 'Another sample contact',
        is_favorite: 'true'
      }
    ];

    const csvWriter = createCsvWriter({
      path: filepath,
      header: headers,
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(sampleData);

    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Template download error:', err);
      }
      // Clean up temp file
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) console.error('Template cleanup error:', unlinkErr);
      });
    });

  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Template generation failed',
      message: error.message
    });
  }
});

module.exports = router;
