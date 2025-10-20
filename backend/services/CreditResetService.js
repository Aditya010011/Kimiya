const databaseService = require('./database');
const CreditService = require('./CreditService');

/**
 * Service for handling monthly credit resets and allocations
 */
class CreditResetService {
  /**
   * Reset monthly credits for all active subscriptions
   * This should be run daily via cron job
   */
  static async resetMonthlyCredits() {
    try {
      console.log('🔄 Starting monthly credit reset job...');
      
      const now = new Date();
      
      // Find all balances that need reset (allocation_reset_date has passed)
      const balancesResult = await databaseService.query(`
        SELECT 
          cb.user_id,
          cb.current_balance,
          cb.allocated_credits,
          cb.monthly_allocation,
          cb.monthly_used,
          cb.allocation_reset_date,
          cb.organization_id,
          s.plan_id,
          s.status as subscription_status,
          u.email,
          u.first_name,
          u.last_name
        FROM tblCreditBalances cb
        INNER JOIN tblUsers u ON cb.user_id = u.id
        INNER JOIN tblSubscriptions s ON u.organization_id = s.organization_id
        WHERE cb.allocation_reset_date <= @now
          AND s.status = 'active'
          AND u.is_active = 1
      `, { now });

      const balances = balancesResult.recordset || [];
      
      if (balances.length === 0) {
        console.log('✅ No credit resets needed at this time');
        return {
          success: true,
          resetsProcessed: 0,
          message: 'No resets needed'
        };
      }

      console.log(`📊 Found ${balances.length} users needing credit reset`);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      // Process each user
      for (const balance of balances) {
        try {
          // Get plan details
          const planResult = await databaseService.query(`
            SELECT * FROM tblCreditPlans WHERE id = @planId AND is_active = 1
          `, { planId: balance.plan_id });

          if (!planResult.recordset || planResult.recordset.length === 0) {
            console.error(`❌ Plan not found for user ${balance.user_id}: ${balance.plan_id}`);
            errorCount++;
            errors.push({
              userId: balance.user_id,
              error: 'Plan not found'
            });
            continue;
          }

          const plan = planResult.recordset[0];
          const monthlyCredits = plan.monthly_credits;

          // Calculate next reset date (first day of next month)
          const nextResetDate = new Date(balance.allocation_reset_date);
          nextResetDate.setMonth(nextResetDate.getMonth() + 1);
          nextResetDate.setDate(1);
          nextResetDate.setHours(0, 0, 0, 0);

          // Reset monthly_used and allocate new credits
          await databaseService.query(`
            UPDATE tblCreditBalances
            SET 
              monthly_used = 0,
              monthly_allocation = @monthlyCredits,
              current_balance = current_balance + @monthlyCredits,
              allocated_credits = allocated_credits + @monthlyCredits,
              allocation_reset_date = @nextResetDate,
              last_updated = GETDATE()
            WHERE user_id = @userId
          `, {
            userId: balance.user_id,
            monthlyCredits,
            nextResetDate
          });

          // Create transaction record
          const transactionId = `reset_${Date.now()}_${balance.user_id}`;
          await databaseService.query(`
            INSERT INTO tblCreditTransactions (
              transaction_id, user_id, organization_id, type, amount,
              balance_before, balance_after, service_type,
              reference_type, notes
            ) VALUES (
              @transactionId, @userId, @organizationId, 'allocation', @amount,
              @balanceBefore, @balanceAfter, 'monthly_reset',
              'system_allocation', @notes
            )
          `, {
            transactionId,
            userId: balance.user_id,
            organizationId: balance.organization_id,
            amount: monthlyCredits,
            balanceBefore: balance.current_balance,
            balanceAfter: balance.current_balance + monthlyCredits,
            notes: `Monthly credit allocation for ${plan.name} plan`
          });

          console.log(`  ✅ Reset credits for user ${balance.user_id} (${balance.email}): +${monthlyCredits} credits`);
          successCount++;

        } catch (error) {
          console.error(`❌ Error resetting credits for user ${balance.user_id}:`, error);
          errorCount++;
          errors.push({
            userId: balance.user_id,
            error: error.message
          });
        }
      }

      console.log(`✅ Monthly credit reset complete: ${successCount} successful, ${errorCount} errors`);

      return {
        success: true,
        resetsProcessed: successCount,
        errors: errorCount,
        errorDetails: errors,
        message: `Reset ${successCount} user credit balances`
      };

    } catch (error) {
      console.error('❌ Error in monthly credit reset job:', error);
      return {
        success: false,
        error: 'Failed to reset monthly credits',
        details: error.message
      };
    }
  }

  /**
   * Clean up expired credits
   * Credits older than 365 days should be expired
   */
  static async cleanupExpiredCredits() {
    try {
      console.log('🧹 Starting expired credits cleanup...');

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - 365); // 365 days ago

      // Find transactions older than 365 days that haven't been marked as expired
      const expiredResult = await databaseService.query(`
        SELECT 
          ct.user_id,
          ct.organization_id,
          SUM(ct.amount) as expired_amount
        FROM tblCreditTransactions ct
        WHERE ct.type = 'allocation'
          AND ct.created_at < @expirationDate
          AND ct.reference_type != 'expired'
        GROUP BY ct.user_id, ct.organization_id
      `, { expirationDate });

      const expiredCredits = expiredResult.recordset || [];

      if (expiredCredits.length === 0) {
        console.log('✅ No expired credits to clean up');
        return {
          success: true,
          creditsExpired: 0
        };
      }

      console.log(`📊 Found ${expiredCredits.length} users with expired credits`);

      let totalExpired = 0;

      for (const expired of expiredCredits) {
        // Deduct expired credits
        const adjustResult = await CreditService.adjustCredits(
          expired.user_id,
          -expired.expired_amount,
          null, // system
          `Expired credits cleanup (older than 365 days)`,
          'credit_expiration'
        );

        if (adjustResult.success) {
          totalExpired += expired.expired_amount;
          console.log(`  ✅ Expired ${expired.expired_amount} credits for user ${expired.user_id}`);
        } else {
          console.error(`  ❌ Failed to expire credits for user ${expired.user_id}`);
        }
      }

      console.log(`✅ Expired credits cleanup complete: ${totalExpired} total credits expired`);

      return {
        success: true,
        creditsExpired: totalExpired,
        usersAffected: expiredCredits.length
      };

    } catch (error) {
      console.error('❌ Error in expired credits cleanup:', error);
      return {
        success: false,
        error: 'Failed to cleanup expired credits',
        details: error.message
      };
    }
  }

  /**
   * Get statistics about upcoming credit resets
   */
  static async getUpcomingResets() {
    try {
      const now = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const result = await databaseService.query(`
        SELECT 
          COUNT(*) as total_resets,
          SUM(cp.monthly_credits) as total_credits_to_allocate
        FROM tblCreditBalances cb
        INNER JOIN tblUsers u ON cb.user_id = u.id
        INNER JOIN tblSubscriptions s ON u.organization_id = s.organization_id
        INNER JOIN tblCreditPlans cp ON s.plan_id = cp.id
        WHERE cb.allocation_reset_date BETWEEN @now AND @nextWeek
          AND s.status = 'active'
          AND u.is_active = 1
      `, { now, nextWeek });

      return {
        success: true,
        data: result.recordset[0]
      };

    } catch (error) {
      console.error('Error getting upcoming resets:', error);
      return {
        success: false,
        error: 'Failed to get upcoming resets'
      };
    }
  }

  /**
   * Manually trigger reset for a specific user (admin function)
   */
  static async manualResetForUser(userId, adminUserId) {
    try {
      console.log(`🔄 Manual credit reset for user ${userId} by admin ${adminUserId}`);

      // Get user's subscription and plan
      const userResult = await databaseService.query(`
        SELECT 
          u.organization_id,
          s.plan_id,
          cb.current_balance
        FROM tblUsers u
        INNER JOIN tblSubscriptions s ON u.organization_id = s.organization_id
        INNER JOIN tblCreditBalances cb ON u.id = cb.user_id
        WHERE u.id = @userId
      `, { userId });

      if (!userResult.recordset || userResult.recordset.length === 0) {
        return {
          success: false,
          error: 'User not found or no active subscription'
        };
      }

      const user = userResult.recordset[0];

      // Get plan details
      const planResult = await databaseService.query(`
        SELECT * FROM tblCreditPlans WHERE id = @planId
      `, { planId: user.plan_id });

      const plan = planResult.recordset[0];

      // Allocate monthly credits
      const allocateResult = await CreditService.allocateCredits(
        userId,
        plan.monthly_credits,
        adminUserId,
        `Manual monthly credit allocation by admin`
      );

      if (allocateResult.success) {
        // Reset monthly_used
        await databaseService.query(`
          UPDATE tblCreditBalances
          SET monthly_used = 0,
              monthly_allocation = @monthlyCredits
          WHERE user_id = @userId
        `, {
          userId,
          monthlyCredits: plan.monthly_credits
        });
      }

      return allocateResult;

    } catch (error) {
      console.error('Error in manual reset:', error);
      return {
        success: false,
        error: 'Failed to manually reset credits'
      };
    }
  }
}

module.exports = CreditResetService;

