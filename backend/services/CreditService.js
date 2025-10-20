const databaseService = require('./database');

/**
 * Credit Service for managing user credits and transactions
 * Handles credit balance, deduction, allocation, and transaction history
 */
class CreditService {
  
  /**
   * Get user's current credit balance
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Credit balance information
   */
  static async getUserCreditBalance(userId) {
    try {
      const result = await databaseService.query(`
        SELECT 
          cb.current_balance,
          cb.allocated_credits,
          cb.used_credits,
          cb.monthly_allocation,
          cb.monthly_used,
          cb.allocation_reset_date,
          cb.last_updated,
          u.email,
          u.first_name,
          u.last_name,
          o.name as organization_name
        FROM tblCreditBalances cb
        INNER JOIN tblUsers u ON cb.user_id = u.id
        INNER JOIN tblOrganizations o ON cb.organization_id = o.id
        WHERE cb.user_id = @userId
      `, { userId });

      if (!result.recordset || result.recordset.length === 0) {
        // Create initial credit balance record if it doesn't exist
        await this.initializeUserCreditBalance(userId);
        return await this.getUserCreditBalance(userId);
      }

      const balance = result.recordset[0];
      
      // Calculate usage projection for current month
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const currentDay = new Date().getDate();
      const projectedMonthlyUsage = balance.monthly_used > 0 ? 
        Math.round((balance.monthly_used / currentDay) * daysInMonth) : 0;

      return {
        success: true,
        data: {
          userId: userId,
          currentBalance: balance.current_balance,
          allocatedCredits: balance.allocated_credits,
          usedCredits: balance.used_credits,
          monthlyAllocation: balance.monthly_allocation,
          monthlyUsed: balance.monthly_used,
          projectedMonthlyUsage,
          allocationResetDate: balance.allocation_reset_date,
          lastUpdated: balance.last_updated,
          user: {
            email: balance.email,
            firstName: balance.first_name,
            lastName: balance.last_name,
            organizationName: balance.organization_name
          }
        }
      };
    } catch (error) {
      console.error('Error getting user credit balance:', error);
      return {
        success: false,
        error: 'Failed to get credit balance'
      };
    }
  }

  /**
   * Initialize credit balance for a new user
   * @param {number} userId - User ID
   * @returns {Promise<Object>} Result of initialization
   */
  static async initializeUserCreditBalance(userId) {
    try {
      // Get user's organization
      const userResult = await databaseService.query(`
        SELECT organization_id FROM tblUsers WHERE id = @userId
      `, { userId });

      if (!userResult.recordset || userResult.recordset.length === 0) {
        throw new Error('User not found');
      }

      const organizationId = userResult.recordset[0].organization_id || 'org_default_123';
      
      // Calculate next month's first day for allocation reset
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      await databaseService.query(`
        INSERT INTO tblCreditBalances (
          user_id, organization_id, current_balance, allocated_credits, 
          used_credits, monthly_allocation, monthly_used, allocation_reset_date
        ) VALUES (
          @userId, @organizationId, 0, 0, 0, 0, 0, @allocationResetDate
        )
      `, { 
        userId, 
        organizationId,
        allocationResetDate: nextMonth
      });

      return { success: true };
    } catch (error) {
      console.error('Error initializing user credit balance:', error);
      return {
        success: false,
        error: 'Failed to initialize credit balance'
      };
    }
  }

  /**
   * Deduct credits from user's balance
   * @param {number} userId - User ID
   * @param {number} amount - Credits to deduct
   * @param {string} serviceType - Type of service (chat, inbound_call, outbound_call, etc.)
   * @param {Object} serviceDetails - Additional service details
   * @param {string} referenceId - Reference to the service record
   * @param {string} referenceType - Type of reference (chat_message, call_session, etc.)
   * @returns {Promise<Object>} Result of deduction
   */
  static async deductCredits(userId, amount, serviceType, serviceDetails = {}, referenceId = null, referenceType = null) {
    try {
      // Start transaction with SERIALIZABLE isolation
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
      
      try {
        // Get current balance with row lock
        const request1 = transaction.request();
        request1.input('userId', userId);
        const balanceResult = await request1.query(`
          SELECT
            current_balance, allocated_credits, used_credits,
            monthly_used, organization_id
          FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @userId
        `);

        if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Credit balance not found'
          };
        }

        const balance = balanceResult.recordset[0];
        
        // Check if user has sufficient credits
        if (balance.current_balance < amount) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Insufficient credits',
            currentBalance: balance.current_balance,
            requiredAmount: amount
          };
        }

        const newBalance = balance.current_balance - amount;
        const newUsedCredits = balance.used_credits + amount;
        const newMonthlyUsed = balance.monthly_used + amount;

        // Update credit balance
        const request2 = transaction.request();
        request2.input('userId', userId);
        request2.input('newBalance', newBalance);
        request2.input('newUsedCredits', newUsedCredits);
        request2.input('newMonthlyUsed', newMonthlyUsed);
        await request2.query(`
          UPDATE tblCreditBalances
          SET
            current_balance = @newBalance,
            used_credits = @newUsedCredits,
            monthly_used = @newMonthlyUsed,
            last_updated = GETDATE()
          WHERE user_id = @userId
        `);

        // Create transaction record
        const transactionId = `txn_${Date.now()}_${userId}`;
        const request3 = transaction.request();
        request3.input('transactionId', transactionId);
        request3.input('userId', userId);
        request3.input('organizationId', balance.organization_id);
        request3.input('amount', amount);
        request3.input('balanceBefore', balance.current_balance);
        request3.input('balanceAfter', newBalance);
        request3.input('serviceType', serviceType);
        request3.input('serviceDetails', JSON.stringify(serviceDetails));
        request3.input('referenceId', referenceId);
        request3.input('referenceType', referenceType);
        await request3.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type, service_details,
            reference_id, reference_type
          ) VALUES (
            @transactionId, @userId, @organizationId, 'debit', @amount,
            @balanceBefore, @balanceAfter, @serviceType, @serviceDetails,
            @referenceId, @referenceType
          )
        `);

        // Create usage log
        const request4 = transaction.request();
        request4.input('userId', userId);
        request4.input('organizationId', balance.organization_id);
        request4.input('serviceType', serviceType);
        request4.input('usageAmount', amount);
        request4.input('serviceMetadata', JSON.stringify(serviceDetails));
        request4.input('referenceId', referenceId);
        request4.input('referenceType', referenceType);
        request4.input('creditCost', amount);
        await request4.query(`
          INSERT INTO tblUsageLogs (
            user_id, organization_id, service_type, usage_amount,
            usage_units, service_metadata, reference_id, reference_type,
            credit_cost, rate_applied
          ) VALUES (
            @userId, @organizationId, @serviceType, @usageAmount,
            'credits', @serviceMetadata, @referenceId, @referenceType,
            @creditCost, 1.0
          )
        `);

        await transaction.commit();

        return {
          success: true,
          data: {
            transactionId,
            balanceBefore: balance.current_balance,
            balanceAfter: newBalance,
            amountDeducted: amount,
            serviceType,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Error deducting credits:', error);
      return {
        success: false,
        error: 'Failed to deduct credits'
      };
    }
  }

  /**
   * Get user's credit transaction history
   * @param {number} userId - User ID
   * @param {number} limit - Number of transactions to return (default: 50)
   * @param {number} offset - Offset for pagination (default: 0)
   * @returns {Promise<Object>} Transaction history
   */
  static async getUserTransactionHistory(userId, limit = 50, offset = 0) {
    try {
      const result = await databaseService.query(`
        SELECT 
          ct.transaction_id,
          ct.type,
          ct.amount,
          ct.balance_before,
          ct.balance_after,
          ct.service_type,
          ct.service_details,
          ct.reference_id,
          ct.reference_type,
          ct.notes,
          ct.created_at,
          creator.first_name + ' ' + creator.last_name as created_by_name
        FROM tblCreditTransactions ct
        LEFT JOIN tblUsers creator ON ct.created_by = creator.id
        WHERE ct.user_id = @userId
        ORDER BY ct.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `, { userId, limit, offset });

      // Get total count for pagination
      const countResult = await databaseService.query(`
        SELECT COUNT(*) as total FROM tblCreditTransactions WHERE user_id = @userId
      `, { userId });

      const transactions = result.recordset.map(tx => ({
        transactionId: tx.transaction_id,
        type: tx.type,
        amount: tx.amount,
        balanceBefore: tx.balance_before,
        balanceAfter: tx.balance_after,
        serviceType: tx.service_type,
        serviceDetails: tx.service_details ? JSON.parse(tx.service_details) : null,
        referenceId: tx.reference_id,
        referenceType: tx.reference_type,
        notes: tx.notes,
        createdAt: tx.created_at,
        createdByName: tx.created_by_name
      }));

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            total: countResult.recordset[0].total,
            limit,
            offset,
            hasMore: (offset + limit) < countResult.recordset[0].total
          }
        }
      };

    } catch (error) {
      console.error('Error getting transaction history:', error);
      return {
        success: false,
        error: 'Failed to get transaction history'
      };
    }
  }

  /**
   * Allocate credits to a user (Admin function)
   * @param {number} userId - User ID to allocate credits to
   * @param {number} amount - Credits to allocate
   * @param {number} adminUserId - Admin user performing the allocation
   * @param {string} notes - Optional notes for the allocation
   * @returns {Promise<Object>} Result of allocation
   */
  static async allocateCredits(userId, amount, adminUserId, notes = null) {
    try {
      // Start transaction with SERIALIZABLE isolation
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);
      
      try {
        // Get current balance with row lock
        const request1 = transaction.request();
        request1.input('userId', userId);
        const balanceResult = await request1.query(`
          SELECT
            current_balance, allocated_credits, organization_id
          FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @userId
        `);

        if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'User credit balance not found'
          };
        }

        const balance = balanceResult.recordset[0];
        const newBalance = balance.current_balance + amount;
        const newAllocatedCredits = balance.allocated_credits + amount;

        // Update credit balance
        const request2 = transaction.request();
        request2.input('userId', userId);
        request2.input('newBalance', newBalance);
        request2.input('newAllocatedCredits', newAllocatedCredits);
        await request2.query(`
          UPDATE tblCreditBalances
          SET
            current_balance = @newBalance,
            allocated_credits = @newAllocatedCredits,
            last_updated = GETDATE()
          WHERE user_id = @userId
        `);

        // Create transaction record
        const transactionId = `alloc_${Date.now()}_${userId}`;
        const request3 = transaction.request();
        request3.input('transactionId', transactionId);
        request3.input('userId', userId);
        request3.input('organizationId', balance.organization_id);
        request3.input('amount', amount);
        request3.input('balanceBefore', balance.current_balance);
        request3.input('balanceAfter', newBalance);
        request3.input('adminUserId', adminUserId);
        request3.input('notes', notes);
        await request3.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type,
            reference_type, created_by, notes
          ) VALUES (
            @transactionId, @userId, @organizationId, 'allocation', @amount,
            @balanceBefore, @balanceAfter, 'manual',
            'admin_allocation', @adminUserId, @notes
          )
        `);

        await transaction.commit();

        return {
          success: true,
          data: {
            transactionId,
            balanceBefore: balance.current_balance,
            balanceAfter: newBalance,
            amountAllocated: amount,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Error allocating credits:', error);
      return {
        success: false,
        error: 'Failed to allocate credits'
      };
    }
  }

  /**
   * Adjust credits (positive or negative)
   * Used for plan changes, refunds, corrections
   * @param {number} userId - User ID
   * @param {number} amount - Amount to adjust (can be negative)
   * @param {number} adminUserId - Admin performing adjustment
   * @param {string} reason - Reason for adjustment
   * @param {string} adjustmentType - Type of adjustment
   * @returns {Promise<Object>} Result of adjustment
   */
  static async adjustCredits(userId, amount, adminUserId, reason, adjustmentType = 'manual') {
    try {
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);

      try {
        // Get current balance with row lock
        const request1 = transaction.request();
        request1.input('userId', userId);
        const balanceResult = await request1.query(`
          SELECT
            current_balance, allocated_credits, used_credits, organization_id
          FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @userId
        `);

        if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'User credit balance not found'
          };
        }

        const balance = balanceResult.recordset[0];
        const newBalance = balance.current_balance + amount;

        // Prevent negative balance
        if (newBalance < 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Adjustment would result in negative balance',
            currentBalance: balance.current_balance,
            adjustmentAmount: amount,
            shortfall: Math.abs(newBalance)
          };
        }

        // Update allocated_credits only if adding credits
        const newAllocatedCredits = amount > 0
          ? balance.allocated_credits + amount
          : balance.allocated_credits;

        // Update credit balance
        const request2 = transaction.request();
        request2.input('userId', userId);
        request2.input('newBalance', newBalance);
        request2.input('newAllocatedCredits', newAllocatedCredits);
        await request2.query(`
          UPDATE tblCreditBalances
          SET
            current_balance = @newBalance,
            allocated_credits = @newAllocatedCredits,
            last_updated = GETDATE()
          WHERE user_id = @userId
        `);

        // Create transaction record
        const transactionId = `adj_${Date.now()}_${userId}`;
        const request3 = transaction.request();
        request3.input('transactionId', transactionId);
        request3.input('userId', userId);
        request3.input('organizationId', balance.organization_id);
        request3.input('type', amount > 0 ? 'credit' : 'adjustment');
        request3.input('amount', Math.abs(amount));
        request3.input('balanceBefore', balance.current_balance);
        request3.input('balanceAfter', newBalance);
        request3.input('serviceType', adjustmentType);
        request3.input('adminUserId', adminUserId);
        request3.input('notes', reason);
        await request3.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type,
            reference_type, created_by, notes
          ) VALUES (
            @transactionId, @userId, @organizationId, @type, @amount,
            @balanceBefore, @balanceAfter, @serviceType,
            'credit_adjustment', @adminUserId, @notes
          )
        `);

        await transaction.commit();

        console.log(`✅ Adjusted credits for user ${userId}: ${amount > 0 ? '+' : ''}${amount} (${balance.current_balance} → ${newBalance})`);

        return {
          success: true,
          data: {
            transactionId,
            balanceBefore: balance.current_balance,
            balanceAfter: newBalance,
            amountAdjusted: amount,
            timestamp: new Date().toISOString()
          }
        };

      } catch (error) {
        await transaction.rollback();
        throw error;
      }

    } catch (error) {
      console.error('Error adjusting credits:', error);
      return {
        success: false,
        error: 'Failed to adjust credits'
      };
    }
  }
}

module.exports = CreditService;
