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
          cb.organization_id,
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

      console.log(`📊 CreditService.getUserCreditBalance called for userId: ${userId}`);
      console.log(`   Organization ID: ${balance.organization_id}`);
      console.log(`   Current Balance: ${balance.current_balance}`);
      console.log(`   Allocation Reset Date: ${balance.allocation_reset_date}`);

      // Calculate usage projection for current month
      const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const currentDay = new Date().getDate();
      const projectedMonthlyUsage = balance.monthly_used > 0 ?
        Math.round((balance.monthly_used / currentDay) * daysInMonth) : 0;

      return {
        success: true,
        data: {
          userId: userId,
          organizationId: balance.organization_id,
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
            organizationId: balance.organization_id,
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

        // Create usage log (only for valid service types)
        // Map internal service types to valid usage log types
        const validServiceTypes = ['chat', 'inbound_call', 'outbound_call', 'storage', 'transcription', 'ai_service'];
        const logServiceType = validServiceTypes.includes(serviceType) ? serviceType : 'chat';

        // Only log if it's not a reservation or internal operation
        if (!['reservation', 'reservation_refund', 'adjustment'].includes(serviceType)) {
          const request4 = transaction.request();
          request4.input('userId', userId);
          request4.input('organizationId', balance.organization_id);
          request4.input('serviceType', logServiceType);
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
        }

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
   * Update transaction details after successful operation
   * Used to convert a reservation transaction to an actual service transaction
   * @param {string} transactionId - Transaction ID to update
   * @param {string} serviceType - Actual service type
   * @param {Object} serviceDetails - Service details
   * @param {string} referenceId - Reference to the service record
   * @param {string} referenceType - Type of reference
   * @returns {Promise<Object>} Result of update
   */
  static async updateTransactionDetails(transactionId, serviceType, serviceDetails = {}, referenceId = null, referenceType = null) {
    try {
      await databaseService.query(`
        UPDATE tblCreditTransactions
        SET
          service_type = @serviceType,
          service_details = @serviceDetails,
          reference_id = @referenceId,
          reference_type = @referenceType,
          updated_at = GETDATE()
        WHERE transaction_id = @transactionId
      `, {
        transactionId,
        serviceType,
        serviceDetails: JSON.stringify(serviceDetails),
        referenceId,
        referenceType
      });

      console.log(`✅ Updated transaction ${transactionId} with service type: ${serviceType}`);

      return {
        success: true,
        data: {
          transactionId,
          serviceType,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error updating transaction details:', error);
      return {
        success: false,
        error: 'Failed to update transaction details'
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
        id: tx.transaction_id,
        transaction_type: tx.type,
        amount: tx.amount,
        balance_before: tx.balance_before,
        balance_after: tx.balance_after,
        service_type: tx.service_type,
        service_details: tx.service_details ? JSON.parse(tx.service_details) : null,
        reference_id: tx.reference_id,
        reference_type: tx.reference_type,
        notes: tx.notes,
        created_at: tx.created_at,
        created_by_name: tx.created_by_name,
        description: `${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} - ${tx.service_type.replace('_', ' ')}`
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

        let balance;

        if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
          // ✅ FIX: Initialize credit balance if it doesn't exist
          console.log(`   ℹ️  No credit balance found for user ${userId}, initializing...`);

          // Get user's organization
          const userRequest = transaction.request();
          userRequest.input('userId', userId);
          const userResult = await userRequest.query(`
            SELECT organization_id FROM tblUsers WHERE id = @userId
          `);

          if (!userResult.recordset || userResult.recordset.length === 0) {
            await transaction.rollback();
            return {
              success: false,
              error: 'User not found'
            };
          }

          const organizationId = userResult.recordset[0].organization_id || 'org_default_123';

          // Calculate next month's first day for allocation reset
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          nextMonth.setDate(1);
          nextMonth.setHours(0, 0, 0, 0);

          // Create new credit balance record
          const initRequest = transaction.request();
          initRequest.input('userId', userId);
          initRequest.input('organizationId', organizationId);
          initRequest.input('allocationResetDate', nextMonth);
          await initRequest.query(`
            INSERT INTO tblCreditBalances (
              user_id, organization_id, current_balance, allocated_credits,
              used_credits, monthly_allocation, monthly_used, allocation_reset_date
            ) VALUES (
              @userId, @organizationId, 0, 0, 0, 0, 0, @allocationResetDate
            )
          `);

          console.log(`   ✅ Credit balance initialized for user ${userId}`);

          // Set balance for subsequent operations
          balance = {
            current_balance: 0,
            allocated_credits: 0,
            organization_id: organizationId
          };
        } else {
          balance = balanceResult.recordset[0];
        }

        const newBalance = balance.current_balance + amount;
        const newAllocatedCredits = balance.allocated_credits + amount;

        // Update credit balance for recipient
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

        // ✅ FIX: Deduct credits from admin's balance
        console.log(`   💳 Deducting ${amount} credits from admin ${adminUserId}...`);

        const adminBalanceRequest = transaction.request();
        adminBalanceRequest.input('adminUserId', adminUserId);
        const adminBalanceResult = await adminBalanceRequest.query(`
          SELECT current_balance, allocated_credits, organization_id
          FROM tblCreditBalances WITH (UPDLOCK, ROWLOCK)
          WHERE user_id = @adminUserId
        `);

        if (!adminBalanceResult.recordset || adminBalanceResult.recordset.length === 0) {
          await transaction.rollback();
          return {
            success: false,
            error: 'Admin credit balance not found'
          };
        }

        const adminBalance = adminBalanceResult.recordset[0];

        // Check if admin has enough credits
        if (adminBalance.current_balance < amount) {
          await transaction.rollback();
          return {
            success: false,
            error: `Admin does not have enough credits. Available: ${adminBalance.current_balance}, Required: ${amount}`
          };
        }

        const adminNewBalance = adminBalance.current_balance - amount;
        const adminNewUsedCredits = (adminBalance.used_credits || 0) + amount;
        // ✅ FIX: Don't decrease admin's allocated_credits
        // allocated_credits tracks what was allocated TO a user, not what they allocated FROM
        // Only decrease the current_balance and increase used_credits when deducting
        // Handle NULL values for used_credits

        // Update admin's balance
        const adminUpdateRequest = transaction.request();
        adminUpdateRequest.input('adminUserId', adminUserId);
        adminUpdateRequest.input('adminNewBalance', adminNewBalance);
        adminUpdateRequest.input('adminNewUsedCredits', adminNewUsedCredits);
        await adminUpdateRequest.query(`
          UPDATE tblCreditBalances
          SET
            current_balance = @adminNewBalance,
            used_credits = @adminNewUsedCredits,
            last_updated = GETDATE()
          WHERE user_id = @adminUserId
        `);

        console.log(`   ✅ Admin balance updated: ${adminBalance.current_balance} → ${adminNewBalance}`);

        // Create transaction record for recipient
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

        // Create transaction record for admin (deduction)
        const adminTransactionId = `alloc_deduct_${Date.now()}_${adminUserId}`;
        const adminTransactionRequest = transaction.request();
        adminTransactionRequest.input('adminTransactionId', adminTransactionId);
        adminTransactionRequest.input('adminUserId', adminUserId);
        adminTransactionRequest.input('organizationId', adminBalance.organization_id);
        adminTransactionRequest.input('amount', amount);
        adminTransactionRequest.input('adminBalanceBefore', adminBalance.current_balance);
        adminTransactionRequest.input('adminBalanceAfter', adminNewBalance);
        adminTransactionRequest.input('notes', notes);
        await adminTransactionRequest.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type,
            reference_type, created_by, notes
          ) VALUES (
            @adminTransactionId, @adminUserId, @organizationId, 'debit', @amount,
            @adminBalanceBefore, @adminBalanceAfter, 'manual',
            'admin_allocation_deduction', @adminUserId, @notes
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
            adminBalanceBefore: adminBalance.current_balance,
            adminBalanceAfter: adminNewBalance,
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

  /**
   * Replace credits for a user (used for plan changes)
   * This sets the balance to a specific amount instead of adding to it
   */
  static async replaceCredits(userId, newAmount, adminId, reason = '') {
    try {
      const sql = require('mssql');
      const transaction = await databaseService.beginTransaction(sql.ISOLATION_LEVEL.SERIALIZABLE);

      try {
        // Get current balance
        const request = transaction.request();
        request.input('userId', userId);
        const balanceResult = await request.query(`
          SELECT id, current_balance, allocated_credits, organization_id
          FROM tblCreditBalances
          WHERE user_id = @userId
        `);

        let balance;
        if (!balanceResult.recordset || balanceResult.recordset.length === 0) {
          // Initialize if doesn't exist
          console.log(`   ℹ️  No credit balance found for user ${userId}, initializing...`);

          const userRequest = transaction.request();
          userRequest.input('userId', userId);
          const userResult = await userRequest.query(`
            SELECT organization_id FROM tblUsers WHERE id = @userId
          `);

          if (!userResult.recordset || userResult.recordset.length === 0) {
            await transaction.rollback();
            return {
              success: false,
              error: 'User not found'
            };
          }

          const organizationId = userResult.recordset[0].organization_id || 'org_default_123';

          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          nextMonth.setDate(1);
          nextMonth.setHours(0, 0, 0, 0);

          const initRequest = transaction.request();
          initRequest.input('userId', userId);
          initRequest.input('organizationId', organizationId);
          initRequest.input('allocationResetDate', nextMonth);
          await initRequest.query(`
            INSERT INTO tblCreditBalances (
              user_id, organization_id, current_balance, allocated_credits,
              used_credits, monthly_allocation, monthly_used, allocation_reset_date
            ) VALUES (
              @userId, @organizationId, 0, 0, 0, 0, 0, @allocationResetDate
            )
          `);

          balance = {
            current_balance: 0,
            allocated_credits: 0,
            organization_id: organizationId
          };
        } else {
          balance = balanceResult.recordset[0];
        }

        const balanceBefore = balance.current_balance;

        // ✅ FIX: Replace credits (set to new amount instead of adding)
        const request2 = transaction.request();
        request2.input('userId', userId);
        request2.input('newBalance', newAmount);
        request2.input('newAllocatedCredits', newAmount);
        await request2.query(`
          UPDATE tblCreditBalances
          SET
            current_balance = @newBalance,
            allocated_credits = @newAllocatedCredits,
            last_updated = GETDATE()
          WHERE user_id = @userId
        `);

        // Create transaction record
        const transactionId = `replace_${Date.now()}_${userId}`;
        const request3 = transaction.request();
        request3.input('transactionId', transactionId);
        request3.input('userId', userId);
        request3.input('organizationId', balance.organization_id);
        request3.input('amount', newAmount);
        request3.input('type', 'allocation');
        request3.input('serviceType', 'system');
        request3.input('notes', reason);
        request3.input('createdBy', adminId);
        request3.input('balanceBefore', balanceBefore);
        request3.input('balanceAfter', newAmount);
        await request3.query(`
          INSERT INTO tblCreditTransactions (
            transaction_id, user_id, organization_id, type, amount,
            balance_before, balance_after, service_type, notes, created_by, created_at
          ) VALUES (
            @transactionId, @userId, @organizationId, @type, @amount,
            @balanceBefore, @balanceAfter, @serviceType, @notes, @createdBy, GETDATE()
          )
        `);

        await transaction.commit();

        return {
          success: true,
          data: {
            transactionId,
            balanceBefore,
            balanceAfter: newAmount,
            amountReplaced: newAmount
          }
        };
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error replacing credits:', error);
      return {
        success: false,
        error: 'Failed to replace credits'
      };
    }
  }
}

module.exports = CreditService;
