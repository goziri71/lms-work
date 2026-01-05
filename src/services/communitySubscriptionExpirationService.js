/**
 * Community Subscription Expiration Service
 * Handles subscription expiration checks, email notifications, and auto-renewal
 */

import { CommunitySubscription } from "../models/marketplace/communitySubscription.js";
import { CommunityMember } from "../models/marketplace/communityMember.js";
import { Community } from "../models/marketplace/community.js";
import { Students } from "../models/auth/student.js";
import { Funding } from "../models/payment/funding.js";
import { GeneralSetup } from "../models/settings/generalSetup.js";
import { getWalletBalance } from "./walletBalanceService.js";
import { db } from "../database/database.js";
import { Op } from "sequelize";
import { emailService } from "./emailService.js";
import { Config } from "../config/config.js";

/**
 * Check and process subscription expirations
 * Sends emails at 7, 3, 1 days before expiration
 * Auto-blocks on expiration
 * Processes auto-renewals
 */
export async function checkAndProcessCommunitySubscriptions() {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  try {
    // Find subscriptions expiring in 7 days (not yet notified)
    const expiringIn7Days = await CommunitySubscription.findAll({
      where: {
        status: "active",
        next_billing_date: {
          [Op.between]: [now, sevenDaysFromNow],
        },
        email_sent_7days: false,
      },
      include: [
        {
          model: Community,
          as: "community",
          attributes: ["id", "name", "price", "currency"],
        },
        {
          model: Students,
          as: "student",
          attributes: ["id", "fname", "lname", "mname", "email"],
        },
      ],
    });

    // Send 7-day emails
    for (const subscription of expiringIn7Days) {
      const daysUntilExpiration = Math.ceil(
        (new Date(subscription.next_billing_date) - now) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration <= 7 && daysUntilExpiration > 3) {
        await sendExpirationEmail(subscription, 7);
        await subscription.update({ email_sent_7days: true });
      }
    }

    // Find subscriptions expiring in 3 days (not yet notified)
    const expiringIn3Days = await CommunitySubscription.findAll({
      where: {
        status: "active",
        next_billing_date: {
          [Op.between]: [now, threeDaysFromNow],
        },
        email_sent_3days: false,
      },
      include: [
        {
          model: Community,
          as: "community",
          attributes: ["id", "name", "price", "currency"],
        },
        {
          model: Students,
          as: "student",
          attributes: ["id", "fname", "lname", "mname", "email"],
        },
      ],
    });

    // Send 3-day emails
    for (const subscription of expiringIn3Days) {
      const daysUntilExpiration = Math.ceil(
        (new Date(subscription.next_billing_date) - now) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration <= 3 && daysUntilExpiration > 1) {
        await sendExpirationEmail(subscription, 3);
        await subscription.update({ email_sent_3days: true });
      }
    }

    // Find subscriptions expiring in 1 day (not yet notified)
    const expiringIn1Day = await CommunitySubscription.findAll({
      where: {
        status: "active",
        next_billing_date: {
          [Op.between]: [now, oneDayFromNow],
        },
        email_sent_1day: false,
      },
      include: [
        {
          model: Community,
          as: "community",
          attributes: ["id", "name", "price", "currency"],
        },
        {
          model: Students,
          as: "student",
          attributes: ["id", "fname", "lname", "mname", "email"],
        },
      ],
    });

    // Send 1-day emails
    for (const subscription of expiringIn1Day) {
      const daysUntilExpiration = Math.ceil(
        (new Date(subscription.next_billing_date) - now) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiration <= 1 && daysUntilExpiration > 0) {
        await sendExpirationEmail(subscription, 1);
        await subscription.update({ email_sent_1day: true });
      }
    }

    // Process expired subscriptions
    const expiredSubscriptions = await CommunitySubscription.findAll({
      where: {
        status: "active",
        next_billing_date: {
          [Op.lt]: now,
        },
      },
      include: [
        {
          model: Community,
          as: "community",
          attributes: ["id", "name", "price", "currency", "tutor_id", "tutor_type"],
        },
        {
          model: Students,
          as: "student",
          attributes: ["id", "fname", "lname", "mname", "email"],
        },
      ],
    });

    for (const subscription of expiredSubscriptions) {
      // Try auto-renewal if enabled
      if (subscription.auto_renew) {
        const renewed = await attemptAutoRenewal(subscription);
        if (!renewed) {
          // Auto-renewal failed - expire subscription
          await expireSubscription(subscription);
        }
      } else {
        // Auto-renewal disabled - expire subscription
        await expireSubscription(subscription);
      }
    }

    console.log(`✅ Community subscription expiration check completed`);
  } catch (error) {
    console.error("❌ Error checking community subscriptions:", error);
    throw error;
  }
}

/**
 * Send expiration email
 */
async function sendExpirationEmail(subscription, daysRemaining) {
  try {
    const student = subscription.student;
    const community = subscription.community;
    const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;

    await emailService.sendEmail({
      to: student.email,
      name: studentName,
      subject: `Your ${community.name} subscription expires in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}`,
      htmlBody: `
        <h2>Subscription Expiring Soon</h2>
        <p>Your subscription to <strong>${community.name}</strong> will expire in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}.</p>
        <p><strong>Expiration Date:</strong> ${new Date(subscription.next_billing_date).toLocaleDateString()}</p>
        <p><strong>Monthly Price:</strong> ${community.price} ${community.currency}</p>
        ${subscription.auto_renew ? "<p><strong>Auto-renewal:</strong> Enabled - Your subscription will be automatically renewed if you have sufficient wallet balance.</p>" : "<p><strong>Auto-renewal:</strong> Disabled - Please renew manually to continue access.</p>"}
        <p><a href="${Config.frontendUrl}/communities/${community.id}">Manage Subscription</a></p>
      `,
    });
  } catch (error) {
    console.error(`Error sending ${daysRemaining}-day expiration email:`, error);
  }
}

/**
 * Attempt auto-renewal
 */
async function attemptAutoRenewal(subscription) {
  const transaction = await db.transaction();

  try {
    const student = await Students.findByPk(subscription.student_id, { transaction });
    const community = await Community.findByPk(subscription.community_id, { transaction });

    if (!student || !community) {
      await transaction.rollback();
      return false;
    }

    // Get exchange rate
    const generalSetup = await GeneralSetup.findOne({
      order: [["id", "DESC"]],
    });
    const exchangeRate = parseFloat(generalSetup?.rate || "1500");

    // Get currencies
    const communityCurrency = (community.currency || "NGN").toUpperCase();
    const studentCurrency = (student.currency || "NGN").toUpperCase();
    const communityPrice = parseFloat(community.price);

    // Convert price to student's currency
    let priceInStudentCurrency = communityPrice;
    if (communityCurrency !== studentCurrency) {
      if (communityCurrency === "USD" && studentCurrency === "NGN") {
        priceInStudentCurrency = communityPrice * exchangeRate;
      } else if (communityCurrency === "NGN" && studentCurrency === "USD") {
        priceInStudentCurrency = communityPrice / exchangeRate;
      }
      priceInStudentCurrency = Math.round(priceInStudentCurrency * 100) / 100;
    }

    // Check wallet balance
    const { balance: walletBalance } = await getWalletBalance(student.id, true);

    if (walletBalance < priceInStudentCurrency) {
      // Insufficient funds - cannot renew
      await transaction.rollback();
      return false;
    }

    // Debit wallet
    const newBalance = walletBalance - priceInStudentCurrency;
    const txRef = `COMMUNITY-AUTO-RENEW-${subscription.id}-${Date.now()}`;
    const today = new Date().toISOString().split("T")[0];

    await Funding.create(
      {
        student_id: student.id,
        amount: priceInStudentCurrency,
        type: "Debit",
        service_name: "Community Subscription Auto-Renewal",
        ref: txRef,
        date: today,
        semester: null,
        academic_year: null,
        currency: studentCurrency,
        balance: newBalance.toString(),
      },
      { transaction }
    );

    await student.update({ wallet_balance: newBalance }, { transaction });

    // Update subscription
    const now = new Date();
    const nextBillingDate = new Date(now);
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await subscription.update(
      {
        start_date: now,
        next_billing_date: nextBillingDate,
        email_sent_7days: false,
        email_sent_3days: false,
        email_sent_1day: false,
        email_sent_expired: false,
        payment_reference: txRef,
      },
      { transaction }
    );

    // Update member
    const member = await CommunityMember.findOne({
      where: {
        community_id: community.id,
        student_id: student.id,
      },
      transaction,
    });

    if (member) {
      await member.update(
        {
          subscription_status: "active",
          subscription_start_date: now,
          subscription_end_date: nextBillingDate,
          next_billing_date: nextBillingDate,
          access_blocked_at: null,
        },
        { transaction }
      );
    }

    await transaction.commit();

    // Send renewal confirmation email
    const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;
    await emailService.sendEmail({
      to: student.email,
      name: studentName,
      subject: `Your ${community.name} subscription has been renewed`,
      htmlBody: `
        <h2>Subscription Renewed</h2>
        <p>Your subscription to <strong>${community.name}</strong> has been automatically renewed.</p>
        <p><strong>Amount Charged:</strong> ${priceInStudentCurrency.toFixed(2)} ${studentCurrency}</p>
        <p><strong>Next Billing Date:</strong> ${nextBillingDate.toLocaleDateString()}</p>
        <p><a href="${Config.frontendUrl}/communities/${community.id}">Visit Community</a></p>
      `,
    });

    return true;
  } catch (error) {
    await transaction.rollback();
    console.error("Error attempting auto-renewal:", error);
    return false;
  }
}

/**
 * Expire subscription
 */
async function expireSubscription(subscription) {
  const transaction = await db.transaction();

  try {
    // Update subscription
    await subscription.update(
      {
        status: "expired",
        end_date: new Date(),
      },
      { transaction }
    );

    // Update member
    const member = await CommunityMember.findOne({
      where: {
        community_id: subscription.community_id,
        student_id: subscription.student_id,
      },
      transaction,
    });

    if (member) {
      await member.update(
        {
          subscription_status: "expired",
          access_blocked_at: new Date(),
        },
        { transaction }
      );
    }

    // Decrement community member count
    await Community.increment("member_count", {
      by: -1,
      where: { id: subscription.community_id },
      transaction,
    });

    await transaction.commit();

    // Send expiration email
    if (!subscription.email_sent_expired) {
      const student = await Students.findByPk(subscription.student_id);
      const community = await Community.findByPk(subscription.community_id);

      if (student && community) {
        const studentName = `${student.fname || ""} ${student.mname || ""} ${student.lname || ""}`.trim() || student.email;
        await emailService.sendEmail({
          to: student.email,
          name: studentName,
          subject: `Your ${community.name} subscription has expired`,
          htmlBody: `
            <h2>Subscription Expired</h2>
            <p>Your subscription to <strong>${community.name}</strong> has expired.</p>
            <p>Your access to the community has been blocked. Please renew your subscription to regain access.</p>
            <p><a href="${Config.frontendUrl}/communities/${community.id}">Renew Subscription</a></p>
          `,
        });

        // Notify tutor
        // TODO: Get tutor email and send notification
      }

      await subscription.update({ email_sent_expired: true });
    }
  } catch (error) {
    await transaction.rollback();
    console.error("Error expiring subscription:", error);
    throw error;
  }
}

