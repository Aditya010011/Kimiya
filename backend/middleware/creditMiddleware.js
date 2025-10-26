const CreditService = require('../services/CreditService');

/**
 * Middleware to check if user has sufficient credits and RESERVE them immediately
 * This prevents race conditions by deducting credits upfront
 * @param {number} requiredCredits - Number of credits required for the operation
 * @returns {Function} Express middleware function
 */
function requireCredits(requiredCredits = 1) {
  return async (req, res, next) => {
    try {
      // Skip credit check if user is not authenticated (for backward compatibility)
      if (!req.user || !req.user.id) {
        console.log('⚠️ CREDITS: Skipping credit check - no authenticated user');
        return next();
      }

      const userId = req.user.id;
      console.log(`💳 CREDITS: Checking and reserving ${requiredCredits} credits for user ${userId}`);

      // Get user's current credit balance
      const balanceResult = await CreditService.getUserCreditBalance(userId);

      if (!balanceResult.success) {
        console.error('❌ CREDITS: Failed to get user balance:', balanceResult.error);
        return res.status(500).json({
          success: false,
          error: 'Failed to check credit balance',
          creditError: true
        });
      }

      const currentBalance = balanceResult.data.currentBalance;
      console.log(`💰 CREDITS: User ${userId} has ${currentBalance} credits, needs ${requiredCredits}`);

      // Check if user has sufficient credits
      if (currentBalance < requiredCredits) {
        console.log(`❌ CREDITS: Insufficient credits - User ${userId} has ${currentBalance}, needs ${requiredCredits}`);
        return res.status(402).json({
          success: false,
          error: 'Insufficient credits',
          creditError: true,
          currentBalance,
          requiredCredits,
          message: `You need ${requiredCredits} credit${requiredCredits > 1 ? 's' : ''} to perform this action. You currently have ${currentBalance} credit${currentBalance !== 1 ? 's' : ''}.`
        });
      }

      // IMMEDIATELY reserve credits by deducting them (pessimistic locking)
      const reserveResult = await CreditService.deductCredits(
        userId,
        requiredCredits,
        'reservation',
        { reserved: true, timestamp: new Date().toISOString() },
        null,
        'credit_reservation'
      );

      if (!reserveResult.success) {
        console.error(`❌ CREDITS: Failed to reserve credits for user ${userId}:`, reserveResult.error);
        return res.status(402).json({
          success: false,
          error: 'Failed to reserve credits',
          creditError: true,
          details: reserveResult.error
        });
      }

      console.log(`🔒 CREDITS: Reserved ${requiredCredits} credits for user ${userId} (${reserveResult.data.balanceBefore} → ${reserveResult.data.balanceAfter})`);

      // Store reservation info
      req.creditInfo = {
        requiredCredits,
        userId,
        reservationId: reserveResult.data.transactionId,
        reserved: true,
        balanceBefore: reserveResult.data.balanceBefore,
        balanceAfter: reserveResult.data.balanceAfter
      };

      // On response, handle reservation based on success/failure
      const originalSend = res.send;
      let responseSent = false;

      res.send = function(data) {
        if (!responseSent) {
          responseSent = true;

          // If request failed (4xx, 5xx status), refund the reservation
          if (res.statusCode >= 400 && req.creditInfo && req.creditInfo.reserved) {
            console.log(`🔄 CREDITS: Request failed (${res.statusCode}), refunding ${requiredCredits} credits to user ${userId}`);

            // Refund reserved credits asynchronously
            CreditService.adjustCredits(
              userId,
              requiredCredits,
              userId,
              `Refund for failed operation (status ${res.statusCode})`,
              'reservation_refund'
            ).then(() => {
              console.log(`✅ CREDITS: Refunded ${requiredCredits} credits to user ${userId}`);
            }).catch(err => {
              console.error(`❌ CREDITS: Failed to refund credits:`, err);
            });
          } else if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`✅ CREDITS: Request succeeded (${res.statusCode}), credits deducted for user ${userId}`);
          }
        }

        return originalSend.call(this, data);
      };

      console.log(`✅ CREDITS: User ${userId} has sufficient credits and reservation complete`);
      next();

    } catch (error) {
      console.error('💥 CREDITS: Error in credit middleware:', error);
      res.status(500).json({
        success: false,
        error: 'Credit system error',
        creditError: true
      });
    }
  };
}

/**
 * Helper function to deduct credits after successful operation
 * @param {Object} req - Express request object
 * @param {string} serviceType - Type of service (chat, call, etc.)
 * @param {Object} serviceDetails - Additional service details
 * @param {string} referenceId - Reference to the service record
 * @param {string} referenceType - Type of reference
 * @returns {Promise<Object>} Result of credit deduction
 */
async function deductCreditsAfterSuccess(req, serviceType, serviceDetails = {}, referenceId = null, referenceType = null) {
  try {
    // Skip if no credit info (user not authenticated or credits not checked)
    if (!req.creditInfo) {
      console.log('⚠️ CREDITS: Skipping credit deduction - no credit info');
      return { success: true, skipped: true };
    }

    const { requiredCredits, userId, reservationId } = req.creditInfo;

    // Credits were already reserved/deducted in the requireCredits middleware
    // This function just updates the transaction record with the actual service type and details
    console.log(`💳 CREDITS: Updating reservation ${reservationId} with service details for ${serviceType}`);

    // Update the existing transaction record with actual service details
    // Instead of deducting again, we just update the reservation transaction
    const updateResult = await CreditService.updateTransactionDetails(
      reservationId,
      serviceType,
      serviceDetails,
      referenceId,
      referenceType
    );

    if (updateResult.success) {
      console.log(`✅ CREDITS: Successfully updated transaction ${reservationId} for user ${userId}`);
    } else {
      console.error(`❌ CREDITS: Failed to update transaction for user ${userId}:`, updateResult.error);
    }

    return updateResult;

  } catch (error) {
    console.error('💥 CREDITS: Error updating transaction:', error);
    return {
      success: false,
      error: 'Failed to update transaction'
    };
  }
}

/**
 * Middleware to handle credit deduction after successful chat response
 * This should be used after the chat response is generated but before sending to client
 */
function deductChatCredits(serviceDetails = {}) {
  return async (req, res, next) => {
    try {
      // Store original res.json to intercept successful responses
      const originalJson = res.json.bind(res);
      
      res.json = async function(data) {
        // Only deduct credits if the response was successful
        if (data && data.success !== false) {
          const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const deductResult = await deductCreditsAfterSuccess(
            req,
            'chat',
            {
              ...serviceDetails,
              messageId,
              responseLength: data.response ? data.response.length : 0,
              timestamp: new Date().toISOString()
            },
            messageId,
            'chat_message'
          );

          // Add credit information to response
          if (req.creditInfo && deductResult.success) {
            data.creditInfo = {
              creditsDeducted: req.creditInfo.requiredCredits,
              remainingBalance: deductResult.data ? deductResult.data.balanceAfter : null,
              transactionId: deductResult.data ? deductResult.data.transactionId : null
            };
          }
        }

        // Call original res.json
        return originalJson(data);
      };

      next();

    } catch (error) {
      console.error('💥 CREDITS: Error in credit deduction middleware:', error);
      next(); // Continue even if credit deduction fails
    }
  };
}

module.exports = {
  requireCredits,
  deductCreditsAfterSuccess,
  deductChatCredits
};
