import { TutorSubscription, SUBSCRIPTION_TIERS } from "../models/marketplace/tutorSubscription.js";
import { SoleTutor } from "../models/marketplace/soleTutor.js";
import { Organization } from "../models/marketplace/organization.js";
import { db } from "../database/database.js";
import { Op } from "sequelize";
import { emailService } from "./emailService.js";

/**
 * Process auto-renewal for subscriptions expiring in the next 3 days
 * This should be run daily via cron job
 */
export async function processAutoRenewals() {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Find subscriptions expiring in the next 3 days with auto_renew enabled
    const expiringSubscriptions = await TutorSubscription.findAll({
      where: {
        status: "active",
        auto_renew: true,
        end_date: {
          [Op.between]: [now, threeDaysFromNow],
        },
      },
    });

    console.log(`Found ${expiringSubscriptions.length} subscriptions to renew`);

    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const subscription of expiringSubscriptions) {
      try {
        await renewSubscription(subscription);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          subscription_id: subscription.id,
          tutor_id: subscription.tutor_id,
          tutor_type: subscription.tutor_type,
          error: error.message,
        });
        console.error(`Failed to renew subscription ${subscription.id}:`, error);
      }
    }

    return results;
  } catch (error) {
    console.error("Error processing auto-renewals:", error);
    throw error;
  }
}

/**
 * Renew a single subscription
 * @param {TutorSubscription} subscription - The subscription to renew
 */
async function renewSubscription(subscription) {
  const tierInfo = SUBSCRIPTION_TIERS[subscription.subscription_tier];
  const subscriptionPrice = tierInfo.price;
  const currency = "NGN";

  // Free tier doesn't need renewal payment
  if (subscriptionPrice === 0) {
    // Just extend the end_date by 30 days
    const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await subscription.update({
      end_date: newEndDate,
      start_date: new Date(), // Update start date to now
    });
    return;
  }

  // Get tutor wallet balance
  let tutor;
  if (subscription.tutor_type === "sole_tutor") {
    tutor = await SoleTutor.findByPk(subscription.tutor_id);
  } else {
    tutor = await Organization.findByPk(subscription.tutor_id);
  }

  if (!tutor) {
    throw new Error(`Tutor not found: ${subscription.tutor_id} (${subscription.tutor_type})`);
  }

  const walletBalance = parseFloat(tutor.wallet_balance || 0);

  // Use transaction to ensure atomicity
  const transaction = await db.transaction();

  try {
    if (walletBalance >= subscriptionPrice) {
      // Sufficient balance - process renewal
      const newBalance = walletBalance - subscriptionPrice;
      await tutor.update({ wallet_balance: newBalance }, { transaction });

      // Extend subscription by 30 days
      const newEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await subscription.update(
        {
          end_date: newEndDate,
          start_date: new Date(), // Update start date to now
        },
        { transaction }
      );

      await transaction.commit();

      // Send renewal confirmation email
      try {
        await emailService.sendEmail({
          to: tutor.email,
          name: subscription.tutor_type === "sole_tutor" 
            ? `${tutor.fname} ${tutor.lname}` 
            : tutor.name,
          subject: "Subscription Renewed Successfully",
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Subscription Renewed</h2>
              <p>Hello ${subscription.tutor_type === "sole_tutor" ? `${tutor.fname} ${tutor.lname}` : tutor.name},</p>
              <p>Your ${tierInfo.name} subscription has been automatically renewed for another 30 days.</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Subscription Tier:</strong> ${tierInfo.name}</p>
                <p><strong>Amount Paid:</strong> ${subscriptionPrice} ${currency}</p>
                <p><strong>New End Date:</strong> ${newEndDate.toLocaleDateString()}</p>
                <p><strong>New Wallet Balance:</strong> ${newBalance} ${currency}</p>
              </div>
              <p>Thank you for your continued subscription!</p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error(`Failed to send renewal email to ${tutor.email}:`, emailError);
        // Don't fail the renewal if email fails
      }
    } else {
      // Insufficient balance - mark subscription as expired
      await subscription.update(
        {
          status: "expired",
          auto_renew: false, // Disable auto-renew if payment failed
        },
        { transaction }
      );

      await transaction.commit();

      // Send payment required email
      try {
        await emailService.sendEmail({
          to: tutor.email,
          name: subscription.tutor_type === "sole_tutor" 
            ? `${tutor.fname} ${tutor.lname}` 
            : tutor.name,
          subject: "Subscription Renewal Failed - Payment Required",
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #d32f2f;">Subscription Renewal Failed</h2>
              <p>Hello ${subscription.tutor_type === "sole_tutor" ? `${tutor.fname} ${tutor.lname}` : tutor.name},</p>
              <p>We attempted to automatically renew your ${tierInfo.name} subscription, but your wallet has insufficient balance.</p>
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p><strong>Required Amount:</strong> ${subscriptionPrice} ${currency}</p>
                <p><strong>Available Balance:</strong> ${walletBalance} ${currency}</p>
                <p><strong>Shortfall:</strong> ${subscriptionPrice - walletBalance} ${currency}</p>
              </div>
              <p>Your subscription has been marked as expired. Please fund your wallet and renew your subscription to continue using premium features.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://app.knomada.co'}/tutor/subscription" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Renew Subscription
                </a>
              </div>
            </div>
          `,
        });
      } catch (emailError) {
        console.error(`Failed to send renewal failure email to ${tutor.email}:`, emailError);
      }

      throw new Error(
        `Insufficient wallet balance for renewal. Required: ${subscriptionPrice} ${currency}, Available: ${walletBalance} ${currency}`
      );
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Check and expire subscriptions that have passed their end_date
 * This should be run daily via cron job
 */
export async function expireSubscriptions() {
  const now = new Date();

  try {
    const expiredSubscriptions = await TutorSubscription.findAll({
      where: {
        status: "active",
        end_date: {
          [Op.lt]: now,
        },
      },
    });

    console.log(`Found ${expiredSubscriptions.length} expired subscriptions to update`);

    for (const subscription of expiredSubscriptions) {
      await subscription.update({ status: "expired" });
    }

    return {
      expired: expiredSubscriptions.length,
    };
  } catch (error) {
    console.error("Error expiring subscriptions:", error);
    throw error;
  }
}

