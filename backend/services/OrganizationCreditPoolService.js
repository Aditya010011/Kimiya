const databaseService = require('./database');

/**
 * Organization Credit Pool Service
 * Manages organization-level credit pooling and credit transfers between users
 */
class OrganizationCreditPoolService {
  
  /**
   * Initialize organization credit pool
   * @param {string} organizationId - Organization ID
   * @param {number} initialCredits - Initial credits to allocate
   * @returns {Promise<Object>} Result of initialization
   */
  static async initializeOrganizationPool(organizationId, initialCredits = 0) {
    try {
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
      
      try {
        // Check if pool already exists
        const request1 = transaction.request();
        request1.input('organizationId', organizationId);
        const existingPool = await request1.query(`
          SELECT id FROM tblOrganizationCreditPools 
          WHERE organization_id = @organizationId
        `);
        
        if (existingPool.recordset && existingPool.recordset.length > 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Organization pool already exists'
          };
        }
        
        // Calculate next month's first day for allocation reset
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        
        // Create new pool
        const request2 = transaction.request();
        request2.input('organizationId', organizationId);
        request2.input('totalCredits', initialCredits);
        request2.input('availableCredits', initialCredits);
        request2.input('monthlyAllocation', initialCredits);
        request2.input('allocationResetDate', nextMonth);
        
        await request2.query(`
          INSERT INTO tblOrganizationCreditPools (
            organization_id, total_credits, available_credits, 
            monthly_allocation, allocation_reset_date
          ) VALUES (
            @organizationId, @totalCredits, @availableCredits,
            @monthlyAllocation, @allocationResetDate
          )
        `);
        
        await transaction.commit();
        
        return {
          success: true,
          data: {
            organizationId,
            totalCredits: initialCredits,
            availableCredits: initialCredits
          }
        };
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      console.error('Error initializing organization pool:', error);
      return {
        success: false,
        error: 'Failed to initialize organization pool'
      };
    }
  }
  
  /**
   * Get organization credit pool
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Pool information
   */
  static async getOrganizationPool(organizationId) {
    try {
      const result = await databaseService.query(`
        SELECT 
          id, organization_id, total_credits, used_credits, available_credits,
          monthly_allocation, monthly_used, allocation_reset_date,
          created_at, updated_at
        FROM tblOrganizationCreditPools
        WHERE organization_id = @organizationId
      `, { organizationId });
      
      if (!result.recordset || result.recordset.length === 0) {
        return {
          success: false,
          error: 'Organization pool not found'
        };
      }
      
      const pool = result.recordset[0];
      
      return {
        success: true,
        data: {
          organizationId: pool.organization_id,
          totalCredits: pool.total_credits,
          usedCredits: pool.used_credits,
          availableCredits: pool.available_credits,
          monthlyAllocation: pool.monthly_allocation,
          monthlyUsed: pool.monthly_used,
          allocationResetDate: pool.allocation_reset_date,
          createdAt: pool.created_at,
          updatedAt: pool.updated_at
        }
      };
      
    } catch (error) {
      console.error('Error getting organization pool:', error);
      return {
        success: false,
        error: 'Failed to get organization pool'
      };
    }
  }
  
  /**
   * Allocate credits to organization pool
   * @param {string} organizationId - Organization ID
   * @param {number} amount - Credits to allocate
   * @param {number} adminUserId - Admin performing allocation
   * @param {string} notes - Optional notes
   * @returns {Promise<Object>} Result of allocation
   */
  static async allocateToPool(organizationId, amount, adminUserId, notes = null) {
    try {
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
      
      try {
        // Get current pool with lock
        const request1 = transaction.request();
        request1.input('organizationId', organizationId);
        const poolResult = await request1.query(`
          SELECT total_credits, available_credits, used_credits
          FROM tblOrganizationCreditPools WITH (UPDLOCK, ROWLOCK)
          WHERE organization_id = @organizationId
        `);
        
        if (!poolResult.recordset || poolResult.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Organization pool not found'
          };
        }
        
        const pool = poolResult.recordset[0];
        const newTotalCredits = pool.total_credits + amount;
        const newAvailableCredits = pool.available_credits + amount;
        
        // Update pool
        const request2 = transaction.request();
        request2.input('organizationId', organizationId);
        request2.input('totalCredits', newTotalCredits);
        request2.input('availableCredits', newAvailableCredits);
        
        await request2.query(`
          UPDATE tblOrganizationCreditPools
          SET total_credits = @totalCredits, available_credits = @availableCredits
          WHERE organization_id = @organizationId
        `);
        
        // Create transaction record
        const transactionId = `pool_alloc_${Date.now()}_${organizationId}`;
        const request3 = transaction.request();
        request3.input('transactionId', transactionId);
        request3.input('organizationId', organizationId);
        request3.input('amount', amount);
        request3.input('adminUserId', adminUserId);
        request3.input('notes', notes);
        
        await request3.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, organization_id, type, amount,
            service_type, reference_type, created_by, notes
          ) VALUES (
            @transactionId, @organizationId, 'allocation', @amount,
            'organization_pool', 'admin_allocation', @adminUserId, @notes
          )
        `);
        
        await transaction.commit();
        
        return {
          success: true,
          data: {
            transactionId,
            organizationId,
            amountAllocated: amount,
            newTotalCredits,
            newAvailableCredits,
            timestamp: new Date().toISOString()
          }
        };
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      console.error('Error allocating to pool:', error);
      return {
        success: false,
        error: 'Failed to allocate credits to pool'
      };
    }
  }
  
  /**
   * Transfer credits between users in same organization
   * @param {string} organizationId - Organization ID
   * @param {number} fromUserId - Source user ID
   * @param {number} toUserId - Destination user ID
   * @param {number} amount - Credits to transfer
   * @param {string} reason - Reason for transfer
   * @returns {Promise<Object>} Result of transfer
   */
  static async transferCredits(organizationId, fromUserId, toUserId, amount, reason = null) {
    try {
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
      
      try {
        // Get source user balance with lock
        const request1 = transaction.request();
        request1.input('userId', fromUserId);
        const fromBalance = await request1.query(`
          SELECT current_balance FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @userId
        `);
        
        if (!fromBalance.recordset || fromBalance.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Source user balance not found'
          };
        }
        
        if (fromBalance.recordset[0].current_balance < amount) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Insufficient credits for transfer'
          };
        }
        
        // Get destination user balance with lock
        const request2 = transaction.request();
        request2.input('userId', toUserId);
        const toBalance = await request2.query(`
          SELECT current_balance FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @userId
        `);
        
        if (!toBalance.recordset || toBalance.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Destination user balance not found'
          };
        }
        
        // Deduct from source
        const request3 = transaction.request();
        request3.input('userId', fromUserId);
        request3.input('amount', amount);
        
        await request3.query(`
          UPDATE tblCreditBalances
          SET current_balance = current_balance - @amount
          WHERE user_id = @userId
        `);
        
        // Add to destination
        const request4 = transaction.request();
        request4.input('userId', toUserId);
        request4.input('amount', amount);
        
        await request4.query(`
          UPDATE tblCreditBalances
          SET current_balance = current_balance + @amount
          WHERE user_id = @userId
        `);
        
        // Record transfer
        const transferId = `transfer_${Date.now()}_${fromUserId}_${toUserId}`;
        const request5 = transaction.request();
        request5.input('transferId', transferId);
        request5.input('organizationId', organizationId);
        request5.input('fromUserId', fromUserId);
        request5.input('toUserId', toUserId);
        request5.input('amount', amount);
        request5.input('reason', reason);
        
        await request5.query(`
          INSERT INTO tblCreditPoolTransfers (
            organization_id, from_user_id, to_user_id, amount, reason, status
          ) VALUES (
            @organizationId, @fromUserId, @toUserId, @amount, @reason, 'completed'
          )
        `);
        
        await transaction.commit();
        
        return {
          success: true,
          data: {
            transferId,
            fromUserId,
            toUserId,
            amount,
            timestamp: new Date().toISOString()
          }
        };
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      console.error('Error transferring credits:', error);
      return {
        success: false,
        error: 'Failed to transfer credits'
      };
    }
  }
}

module.exports = OrganizationCreditPoolService;

