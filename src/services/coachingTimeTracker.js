import { CoachingSession } from "../models/marketplace/coachingSession.js";
import { CoachingSettings } from "../models/marketplace/coachingSettings.js";
import { CoachingHoursBalance } from "../models/marketplace/coachingHoursBalance.js";
import { TutorSubscription, SUBSCRIPTION_TIERS } from "../models/marketplace/tutorSubscription.js";
import { streamVideoService } from "./streamVideoService.js";
import { refundHours } from "../controllers/marketplace/coachingHours.js";
import { Op } from "sequelize";
import { db } from "../database/database.js";

/**
 * Background job to track active coaching sessions
 * Should be called periodically (e.g., every minute via cron)
 * 
 * This function:
 * 1. Checks all active sessions
 * 2. Sends warnings at 10min and 5min remaining
 * 3. Ends sessions when time is up
 * 4. Checks wallet balance and sends low balance warnings
 */
export async function trackActiveSessions() {
  try {
    const now = new Date();

    // Get all active sessions
    const activeSessions = await CoachingSession.findAll({
      where: {
        status: "active",
        actual_start_time: {
          [Op.not]: null,
        },
      },
    });

    const settings = await CoachingSettings.findOne();
    if (!settings) {
      console.error("Coaching settings not found");
      return;
    }

    for (const session of activeSessions) {
      try {
        const actualStartTime = new Date(session.actual_start_time);
        const scheduledEndTime = new Date(session.end_time);
        const elapsedMs = now.getTime() - actualStartTime.getTime();
        const elapsedMinutes = Math.round(elapsedMs / (1000 * 60));
        const remainingMs = scheduledEndTime.getTime() - now.getTime();
        const remainingMinutes = Math.round(remainingMs / (1000 * 60));

        // Check if session should be ended
        if (now >= scheduledEndTime) {
          await endSessionAutomatically(session);
          continue;
        }

        // Send 10-minute warning
        if (remainingMinutes <= 10 && remainingMinutes > 5 && !session.warning_sent_10min) {
          await sendWarning(session, "10 minutes remaining");
          await session.update({ warning_sent_10min: true });
        }

        // Send 5-minute warning
        if (remainingMinutes <= 5 && remainingMinutes > 0 && !session.warning_sent_5min) {
          await sendWarning(session, "5 minutes remaining");
          await session.update({ warning_sent_5min: true });
        }

        // Check wallet balance for pay-as-you-go tutors
        if (!session.warning_sent_low_balance) {
          const subscription = await TutorSubscription.findOne({
            where: {
              tutor_id: session.tutor_id,
              tutor_type: session.tutor_type,
              status: "active",
            },
          });

          const tierInfo = subscription
            ? SUBSCRIPTION_TIERS[subscription.subscription_tier]
            : SUBSCRIPTION_TIERS.free;

          if (!tierInfo.unlimited_coaching) {
            const balance = await CoachingHoursBalance.findOne({
              where: {
                tutor_id: session.tutor_id,
                tutor_type: session.tutor_type,
              },
            });

            if (balance) {
              const hoursRemaining = parseFloat(balance.hours_balance);
              const estimatedHoursNeeded = remainingMinutes / 60;

              // Warn if balance is low (less than 1 hour or less than what's needed)
              if (hoursRemaining < 1 || hoursRemaining < estimatedHoursNeeded) {
                await sendLowBalanceWarning(session, hoursRemaining);
                await session.update({ warning_sent_low_balance: true });
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error tracking session ${session.id}:`, error);
        // Continue with other sessions
      }
    }
  } catch (error) {
    console.error("Error in trackActiveSessions:", error);
  }
}

/**
 * Automatically end a session when time is up
 */
async function endSessionAutomatically(session) {
  const transaction = await db.transaction();

  try {
    const now = new Date();
    const actualStartTime = session.actual_start_time || session.start_time;
    const actualDurationMs = now.getTime() - new Date(actualStartTime).getTime();
    const actualDurationHours = actualDurationMs / (1000 * 60 * 60);

    // End Stream.io call
    if (session.stream_call_id) {
      try {
        await streamVideoService.endCall("default", session.stream_call_id);
      } catch (error) {
        console.error(`Failed to end Stream.io call ${session.stream_call_id}:`, error);
      }
    }

    // Update session
    await session.update(
      {
        status: "ended",
        actual_end_time: now,
        hours_used: actualDurationHours,
      },
      { transaction }
    );

    // Adjust hours balance if actual duration is less than reserved
    const reservedHours = parseFloat(session.hours_reserved);
    if (actualDurationHours < reservedHours) {
      // Refund the difference
      const hoursToRefund = reservedHours - actualDurationHours;
      await refundHours(session.tutor_id, session.tutor_type, hoursToRefund, transaction);
    }

    await transaction.commit();
    console.log(`✅ Automatically ended session ${session.id}`);
  } catch (error) {
    await transaction.rollback();
    console.error(`Failed to automatically end session ${session.id}:`, error);
  }
}

/**
 * Send warning notification (can be extended to send emails/push notifications)
 */
async function sendWarning(session, message) {
  console.log(`⚠️ Warning for session ${session.id}: ${message}`);
  // TODO: Implement email/push notification to tutor and students
  // For now, just log the warning
}

/**
 * Send low balance warning
 */
async function sendLowBalanceWarning(session, hoursRemaining) {
  console.log(
    `⚠️ Low balance warning for session ${session.id}: ${hoursRemaining.toFixed(2)} hours remaining`
  );
  // TODO: Implement email/push notification to tutor
  // For now, just log the warning
}


