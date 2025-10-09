const emailService = require('./emailService');
const User = require('../models/User');
const Category = require('../models/Category');

class BudgetAlertService {
  /**
   * Check and send budget alerts for a specific budget after transaction update
   * @param {Object} budget - Budget document
   * @param {Object} transaction - Transaction that triggered the update
   */
  static async checkAndSendAlerts(budget, transaction) {
    try {
      // Only process expense transactions
      if (transaction.type !== 'expense') {
        return;
      }

      // Check if budget has email notifications enabled
      if (!budget.notifications.email || !budget.notifications.thresholdAlerts) {
        return;
      }

      // Get user details
      const user = await User.findById(budget.user).lean();
      if (!user) {
        console.error('User not found for budget alert:', budget.user);
        return;
      }

      // Find the category that was affected by this transaction
      const affectedCategory = budget.categories.find(
        cat => cat.category.toString() === transaction.category.toString()
      );

      if (!affectedCategory) {
        return;
      }

      // Calculate utilization percentage for this category
      const utilizationPercentage = (affectedCategory.spentAmount / affectedCategory.budgetAmount) * 100;

      // Check if we need to send alerts
      const shouldSendThresholdAlert = 
        utilizationPercentage >= affectedCategory.alertThreshold && 
        utilizationPercentage < 100;

      const shouldSendOverBudgetAlert = 
        utilizationPercentage >= 100 && 
        budget.notifications.overBudgetAlerts;

      if (shouldSendThresholdAlert || shouldSendOverBudgetAlert) {
        // Get category details
        const categoryDetails = await Category.findById(affectedCategory.category).lean();
        
        if (categoryDetails) {
          const alertType = shouldSendOverBudgetAlert ? 'over_budget' : 'threshold';
          
          // Send budget alert email
          const result = await emailService.sendBudgetAlertEmail(
            user,
            {
              ...budget.toObject(),
              category: affectedCategory,
              utilizationPercentage: Math.round(utilizationPercentage)
            },
            categoryDetails,
            alertType
          );

          if (result.success) {
            console.log(`✅ Budget alert sent to ${user.email} for category ${categoryDetails.name}`);
          } else {
            console.error(`❌ Failed to send budget alert:`, result.error);
          }
        }
      }

    } catch (error) {
      console.error('Budget alert service error:', error);
    }
  }

  /**
   * Check all categories in a budget for alerts
   * @param {Object} budget - Budget document with populated categories
   */
  static async checkAllCategoriesForAlerts(budget) {
    try {
      if (!budget.notifications.email || !budget.notifications.thresholdAlerts) {
        return;
      }

      const user = await User.findById(budget.user).lean();
      if (!user) {
        return;
      }

      for (const budgetCategory of budget.categories) {
        const utilizationPercentage = (budgetCategory.spentAmount / budgetCategory.budgetAmount) * 100;

        const shouldSendThresholdAlert = 
          utilizationPercentage >= budgetCategory.alertThreshold && 
          utilizationPercentage < 100;

        const shouldSendOverBudgetAlert = 
          utilizationPercentage >= 100 && 
          budget.notifications.overBudgetAlerts;

        if (shouldSendThresholdAlert || shouldSendOverBudgetAlert) {
          const categoryDetails = await Category.findById(budgetCategory.category).lean();
          
          if (categoryDetails) {
            const alertType = shouldSendOverBudgetAlert ? 'over_budget' : 'threshold';
            
            const result = await emailService.sendBudgetAlertEmail(
              user,
              {
                ...budget.toObject(),
                category: budgetCategory,
                utilizationPercentage: Math.round(utilizationPercentage)
              },
              categoryDetails,
              alertType
            );

            if (result.success) {
              console.log(`✅ Budget alert sent to ${user.email} for category ${categoryDetails.name}`);
            }
          }
        }
      }

    } catch (error) {
      console.error('Budget alert service error:', error);
    }
  }
}

module.exports = BudgetAlertService;